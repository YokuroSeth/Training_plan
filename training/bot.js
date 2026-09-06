import https from 'node:https';
import { UserRateLimiter } from './rate-limit.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const apiBase = `https://api.telegram.org/bot${token}`;
const limiter = new UserRateLimiter();
let offset = 0;

if (!token || token === 'replace_after_rotation') {
  throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
}

function telegram(method, payload) {
  return new Promise((resolve, reject) => {
    const request = https.request(`${apiBase}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeout: 35_000
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (!result.ok) reject(new Error(result.description || `Telegram API error: ${response.statusCode}`));
          else resolve(result.result);
        } catch {
          reject(new Error('Invalid Telegram API response.'));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Telegram API request timed out.')));
    request.on('error', reject);
    request.end(JSON.stringify(payload));
  });
}

async function handleUpdate(update) {
  const message = update.message;
  const userId = message?.from?.id;
  if (!userId) return;

  const rate = limiter.check(userId);
  if (rate.blocked) {
    if (rate.newlyBlocked) {
      await telegram('sendMessage', {
        chat_id: message.chat.id,
        text: 'Слишком много сообщений. Бот временно игнорирует ваши команды на 5 минут.'
      });
    }
    return;
  }

  if (message.text === '/start') {
    await telegram('sendMessage', {
      chat_id: message.chat.id,
      text: 'Откройте Mini App, чтобы вести план тренировок и расписание.'
    });
  }
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message']
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(`[bot] ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}

setInterval(() => limiter.cleanup(), 10 * 60 * 1000).unref();
poll();
