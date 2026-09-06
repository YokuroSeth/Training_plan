import crypto from 'node:crypto';
import http from 'node:http';
import { verifyTelegramInitData } from './auth.js';
import { canManageClient } from './authorization.js';
import { loadDatabase, saveDatabase } from './server-store.js';

const port = Number(process.env.PORT || 8787);
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const appOrigin = process.env.APP_ORIGIN;
const maxBodyBytes = 64 * 1024;
const sessionTtlMs = 24 * 60 * 60 * 1000;
const sessions = new Map();
const database = loadDatabase();

if (!botToken || botToken === 'replace_after_rotation') throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
if (process.env.NODE_ENV === 'production' && !appOrigin) throw new Error('APP_ORIGIN is required in production.');

const server = http.createServer(async (request, response) => {
  try {
    if (!isAllowedOrigin(request)) return sendJson(response, 403, { success: false, error: 'Origin is not allowed' });
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'POST' && url.pathname === '/api/auth') return await authenticate(request, response);

    const session = requireSession(request, response);
    if (!session) return;
    if (request.method === 'DELETE' && url.pathname === '/api/account') return deleteAccount(response, session);
    if (request.method === 'GET' && url.pathname === '/api/me') return sendJson(response, 200, { success: true, user: publicUser(session.user) });
    if (request.method === 'PUT' && url.pathname === '/api/profile') return await updateProfile(request, response, session);
    if (request.method === 'GET' && url.pathname === '/api/clients') return listClients(response, session);
    if (request.method === 'POST' && url.pathname === '/api/clients') return await createClient(request, response, session);
    if (request.method === 'GET' && url.pathname === '/api/my/plans') return listMyPlans(response, session);

    const clientMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/);
    if (clientMatch && request.method === 'GET') return getClient(response, session, clientMatch[1]);
    if (clientMatch && request.method === 'PUT') return await updateClient(request, response, session, clientMatch[1]);
    if (clientMatch && request.method === 'DELETE') return deleteClient(response, session, clientMatch[1]);

    const planMatch = url.pathname.match(/^\/api\/plans\/([^/]+)$/);
    if (planMatch && request.method === 'GET') return getPlan(response, session, planMatch[1]);
    if (planMatch && request.method === 'PUT') return await updatePlan(request, response, session, planMatch[1]);
    sendJson(response, 404, { success: false, error: 'Not found' });
  } catch (error) {
    const status = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    sendJson(response, status, { success: false, error: status === 413 ? 'Payload too large' : 'Invalid request' });
  }
});

server.listen(port, () => console.log(`Authorized API listening on port ${port}`));

async function authenticate(request, response) {
  if (request.headers['content-type']?.startsWith('application/json') !== true) return sendJson(response, 415, { success: false, error: 'Content-Type must be application/json' });
  const payload = JSON.parse(await readBody(request));
  const auth = verifyTelegramInitData(payload.initData, botToken);
  if (!auth?.user?.id) return sendJson(response, 401, { success: false, error: 'Invalid initData' });

  const userId = String(auth.user.id);
  const existing = database.users[userId] || {};
  const role = existing.role === 'trainer' ? 'trainer' : 'self';
  database.users[userId] = {
    ...existing,
    id: userId,
    role,
    firstName: String(auth.user.first_name || existing.firstName || '').slice(0, 80),
    lastName: String(auth.user.last_name || existing.lastName || '').slice(0, 80),
    username: String(auth.user.username || existing.username || '').slice(0, 80)
  };
  saveDatabase(database);

  const sessionId = crypto.randomBytes(32).toString('base64url');
  sessions.set(sessionId, { userId, expiresAt: Date.now() + sessionTtlMs });
  response.setHeader('set-cookie', `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  sendJson(response, 200, { success: true, user: publicUser(database.users[userId]) });
}

function requireSession(request, response) {
  const sessionId = parseCookies(request.headers.cookie || '').session;
  const session = sessionId && sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    sendJson(response, 401, { success: false, error: 'Authentication required' });
    return null;
  }
  const user = database.users[session.userId];
  if (!user) return sendJson(response, 401, { success: false, error: 'Authentication required' });
  return { ...session, user };
}

function requireTrainer(response, session) {
  if (session.user.role !== 'trainer') {
    sendJson(response, 403, { success: false, error: 'Trainer role required' });
    return false;
  }
  return true;
}

async function updateProfile(request, response, session) {
  const payload = await readJson(request);
  const user = database.users[session.user.id];
  if (payload.role === 'self' || payload.role === 'trainer') user.role = payload.role;
  user.name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 80) : user.name;
  user.height = numberOrNull(payload.height, 50, 250);
  user.weight = numberOrNull(payload.weight, 20, 400);
  saveDatabase(database);
  sendJson(response, 200, { success: true, user: publicUser(user) });
}

function deleteAccount(response, session) {
  const userId = session.user.id;
  const ownedClientIds = Object.values(database.clients).filter((client) => client.trainerId === userId).map((client) => client.id);
  ownedClientIds.forEach((clientId) => {
    delete database.clients[clientId];
    delete database.plans[`client:${clientId}`];
  });
  delete database.users[userId];
  delete database.plans[`user:${userId}`];
  for (const [sessionId, storedSession] of sessions) {
    if (storedSession.userId === userId) sessions.delete(sessionId);
  }
  saveDatabase(database);
  response.setHeader('set-cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  sendJson(response, 200, { success: true });
}

function listClients(response, session) {
  if (!requireTrainer(response, session)) return;
  const clients = Object.values(database.clients).filter((client) => client.trainerId === session.user.id);
  sendJson(response, 200, { success: true, clients });
}

async function createClient(request, response, session) {
  if (!requireTrainer(response, session)) return;
  const payload = await readJson(request);
  if (typeof payload.name !== 'string' || !payload.name.trim()) return sendJson(response, 400, { success: false, error: 'Client name is required' });
  if (!isTelegramId(payload.telegramId)) return sendJson(response, 400, { success: false, error: 'Valid Telegram ID is required' });
  const existingLink = Object.values(database.clients).find((client) => client.trainerId === session.user.id && client.telegramId === String(payload.telegramId));
  if (existingLink) return sendJson(response, 409, { success: false, error: 'This Telegram user is already your client' });
  const id = crypto.randomUUID();
  const client = { id, trainerId: session.user.id, telegramId: String(payload.telegramId), name: payload.name.trim().slice(0, 80), height: numberOrNull(payload.height, 50, 250), weight: numberOrNull(payload.weight, 20, 400) };
  database.clients[id] = client;
  saveDatabase(database);
  sendJson(response, 201, { success: true, client });
}

async function updateClient(request, response, session, clientId) {
  if (!requireTrainer(response, session)) return;
  const client = database.clients[clientId];
  if (!canManageClient(session.user, client)) return sendJson(response, 404, { success: false, error: 'Client not found' });
  const payload = await readJson(request);
  if (!isTelegramId(payload.telegramId)) return sendJson(response, 400, { success: false, error: 'Valid Telegram ID is required' });
  client.telegramId = String(payload.telegramId);
  if (typeof payload.name === 'string' && payload.name.trim()) client.name = payload.name.trim().slice(0, 80);
  client.height = numberOrNull(payload.height, 50, 250);
  client.weight = numberOrNull(payload.weight, 20, 400);
  saveDatabase(database);
  sendJson(response, 200, { success: true, client });
}

function listMyPlans(response, session) {
  const linkedClients = Object.values(database.clients).filter((client) => client.telegramId === session.user.id);
  sendJson(response, 200, {
    success: true,
    plans: linkedClients.map((client) => ({
      client: { id: client.id, name: client.name, trainerId: client.trainerId },
      plan: database.plans[`client:${client.id}`] || { state: {}, dayComments: {} }
    }))
  });
}

function getClient(response, session, clientId) {
  if (!requireTrainer(response, session)) return;
  const client = database.clients[clientId];
  if (!canManageClient(session.user, client)) return sendJson(response, 404, { success: false, error: 'Client not found' });
  sendJson(response, 200, { success: true, client });
}

function deleteClient(response, session, clientId) {
  if (!requireTrainer(response, session)) return;
  const client = database.clients[clientId];
  if (!canManageClient(session.user, client)) return sendJson(response, 404, { success: false, error: 'Client not found' });
  delete database.clients[clientId];
  delete database.plans[`client:${clientId}`];
  saveDatabase(database);
  sendJson(response, 200, { success: true });
}

function getPlan(response, session, ownerId) {
  const allowed = ownerId === session.user.id || isLinkedClient(session.user.id, ownerId) || (session.user.role === 'trainer' && canManageClient(session.user, database.clients[ownerId]));
  if (!allowed) return sendJson(response, 403, { success: false, error: 'Plan access denied' });
  sendJson(response, 200, { success: true, plan: database.plans[planKey(session, ownerId)] || { state: {}, dayComments: {} } });
}

async function updatePlan(request, response, session, ownerId) {
  const allowed = ownerId === session.user.id || isLinkedClient(session.user.id, ownerId) || (session.user.role === 'trainer' && canManageClient(session.user, database.clients[ownerId]));
  if (!allowed) return sendJson(response, 403, { success: false, error: 'Plan access denied' });
  const payload = await readJson(request);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return sendJson(response, 400, { success: false, error: 'Invalid plan' });
  database.plans[planKey(session, ownerId)] = { state: payload.state && typeof payload.state === 'object' ? payload.state : {}, dayComments: payload.dayComments && typeof payload.dayComments === 'object' ? payload.dayComments : {} };
  saveDatabase(database);
  sendJson(response, 200, { success: true });
}

function planKey(session, ownerId) {
  return ownerId === session.user.id ? `user:${session.user.id}` : `client:${ownerId}`;
}

function isLinkedClient(userId, clientId) {
  return database.clients[clientId]?.telegramId === String(userId);
}

function publicUser(user) {
  return { id: user.id, role: user.role, name: user.name || '', firstName: user.firstName || '', lastName: user.lastName || '', username: user.username || '', height: user.height ?? null, weight: user.weight ?? null };
}

function numberOrNull(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function isTelegramId(value) {
  return /^(?:0|[1-9]\d{4,14})$/.test(String(value ?? ''));
}

function parseCookies(header) {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value));
}

async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    const error = new Error('Content-Type must be application/json');
    error.code = 'INVALID_CONTENT_TYPE';
    throw error;
  }
  return JSON.parse(await readBody(request));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxBodyBytes) {
        const error = new Error('Payload too large');
        error.code = 'PAYLOAD_TOO_LARGE';
        reject(error);
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function isAllowedOrigin(request) {
  return !request.headers.origin || !appOrigin || request.headers.origin === appOrigin;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}
