import { dateAtMonday, dateKey, dayIndexFor, addDays, formatDate } from './date-utils.js';
import { fullDayNames } from './constants.js';
import { loadPlans, savePlans, loadProfile, saveProfile, loadClients, saveClients, loadSchedule, saveSchedule, clearLocalData } from './storage.js';
import { renderDay, renderWeek } from './render.js';
import { initExerciseForm } from './exercise-form.js';
import { initPersonForm } from './profile-form.js';
import { renderClients } from './clients-view.js';
import { renderSchedule } from './schedule-view.js';
import { initScheduleForm } from './schedule-form.js';
import { initTelegramTheme } from './telegram-theme.js';
import { isSafeImageSource } from './security.js';

const today = new Date();
const currentWeek = dateAtMonday(today);
const plans = loadPlans();
const clients = loadClients();
const schedule = loadSchedule();
let profile = loadProfile();
let selectedWeek = new Date(currentWeek);
let selectedDay = dayIndexFor(today);
let scheduleWeek = new Date(currentWeek);
let scheduleDay = dayIndexFor(today);
let selectedClientId = null;
let currentView = 'plan';

const ensurePlan = (planId) => {
  if (!plans[planId]) plans[planId] = { state: {}, dayComments: {} };
  return plans[planId];
};
const activePlanId = () => selectedClientId || 'personal';
const activePlan = () => ensurePlan(activePlanId());
const selectedDate = () => addDays(selectedWeek, selectedDay);
const saveActivePlan = () => savePlans(plans);

function renderProfileHeader() {
  const avatar = document.querySelector('#profileAvatar');
  if (isSafeImageSource(profile?.photo)) avatar.innerHTML = `<img src="${escapeAttribute(profile.photo)}" alt="">`;
  else avatar.textContent = profile?.name ? initials(profile.name) : '?';
}

function render() {
  renderProfileHeader();
  const isTrainer = profile?.role === 'trainer';
  document.querySelector('#modeTabs').hidden = !isTrainer || currentView === 'schedule';
  document.querySelector('#planView').hidden = currentView !== 'plan';
  document.querySelector('#clientsView').hidden = currentView !== 'clients';
  document.querySelector('#scheduleView').hidden = currentView !== 'schedule';
  document.querySelector('#clientContext').hidden = !selectedClientId || currentView !== 'plan';
  document.querySelector('#menuPlan').classList.toggle('active', currentView === 'plan' || currentView === 'clients');
  document.querySelector('#menuClients').hidden = !isTrainer;
  document.querySelector('#menuClients').classList.toggle('active', currentView === 'clients');
  document.querySelector('#menuSchedule').classList.toggle('active', currentView === 'schedule');

  if (isTrainer) {
    document.querySelector('#planTab').classList.toggle('active', currentView === 'plan');
    document.querySelector('#clientsTab').classList.toggle('active', currentView === 'clients');
    renderClients({ clients, activeClientId: selectedClientId, onSelect: selectClient, onEdit: editClient, onDelete: deleteClient, onAdd: () => personForm.open('client') });
  }

  if (currentView === 'schedule') {
    renderCurrentSchedule();
    return;
  }
  if (currentView !== 'plan') return;
  const plan = activePlan();
  const activeClient = clients.find((client) => client.id === selectedClientId);
  document.querySelector('#activeClientName').textContent = activeClient?.name || '';
  renderWeek({ selectedWeek, selectedDay, today, state: plan.state, onDaySelect: (day) => { selectedDay = day; render(); } });
  renderDay({ selectedDate: selectedDate(), selectedDay, today, state: plan.state, dayComment: plan.dayComments[dateKey(selectedDate())], onDelete: deleteExercise, onEdit: exerciseForm.openForm, onToggle: toggleExercise });
}

function renderCurrentSchedule() {
  renderSchedule({ weekStart: scheduleWeek, selectedDay: scheduleDay, today, schedule, clients, onDaySelect: (day) => { scheduleDay = day; render(); }, onDelete: deleteSchedule, onEdit: editSchedule, onMove: moveSchedule });
}

function deleteExercise(index) {
  const plan = activePlan();
  const key = dateKey(selectedDate());
  plan.state[key].splice(index, 1);
  if (!plan.state[key].length) delete plan.state[key];
  saveActivePlan();
  render();
}

function toggleExercise(index) {
  const plan = activePlan();
  const exercise = plan.state[dateKey(selectedDate())][index];
  exercise.completed = exercise.completed === false;
  saveActivePlan();
  render();
}

function saveSelectedDayComment() {
  const plan = activePlan();
  const key = dateKey(selectedDate());
  const comment = document.querySelector('#dayCommentInput').value.trim();
  if (comment) plan.dayComments[key] = comment;
  else delete plan.dayComments[key];
  saveActivePlan();
}

function selectClient(clientId) {
  selectedClientId = clientId;
  currentView = 'plan';
  render();
}

function editClient(clientId) {
  const client = clients.find((item) => item.id === clientId);
  if (client) personForm.open('client', client);
}

function deleteClient(clientId) {
  const client = clients.find((item) => item.id === clientId);
  if (!client || !window.confirm(`Удалить клиента ${client.name}?`)) return;
  const index = clients.findIndex((item) => item.id === clientId);
  clients.splice(index, 1);
  delete plans[clientId];
  if (selectedClientId === clientId) selectedClientId = null;
  saveClients(clients);
  savePlans(plans);
  render();
}

function deleteSchedule(eventId) {
  const index = schedule.findIndex((event) => event.id === eventId);
  if (index === -1) return;
  schedule.splice(index, 1);
  saveSchedule(schedule);
  render();
}

function editSchedule(eventId) {
  const event = schedule.find((item) => item.id === eventId);
  if (event) scheduleForm.open(event);
}

function moveSchedule(eventId, dayIndex, time) {
  const event = schedule.find((item) => item.id === eventId);
  if (!event) return;
  event.date = dateKey(addDays(scheduleWeek, dayIndex));
  event.time = time;
  scheduleDay = dayIndex;
  saveSchedule(schedule);
  render();
}

function handleProfileSaved() {
  if (profile.role !== 'trainer') {
    selectedClientId = null;
    currentView = 'plan';
  }
  render();
}

function handleClientSaved() {
  saveClients(clients);
  render();
}

async function ensureApiSession() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return false;
  const response = await fetch('/api/auth', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) });
  if (!response.ok) throw new Error('Не удалось подтвердить Telegram-пользователя.');
  return true;
}

async function saveClientBackend(client, editingClientId) {
  const localClient = { ...client, id: editingClientId || `client-${Date.now()}` };
  if (!window.Telegram?.WebApp?.initData) return localClient;
  try {
    await ensureApiSession();
    const response = await fetch(editingClientId ? `/api/clients/${encodeURIComponent(editingClientId)}` : '/api/clients', {
      method: editingClientId ? 'PUT' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(client)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить клиента.');
    return result.client;
  } catch (error) {
    return localClient;
  }
}

async function syncBackendAccount() {
  if (!window.Telegram?.WebApp?.initData) return;
  try {
    await ensureApiSession();
    const meResponse = await fetch('/api/me', { credentials: 'include' });
    if (!meResponse.ok) return;
    const me = await meResponse.json();
    profile = { ...(profile || {}), name: me.user.name || profile?.name || me.user.firstName, role: me.user.role, height: me.user.height, weight: me.user.weight };
    saveProfile(profile);

    if (profile.role === 'trainer') {
      const clientsResponse = await fetch('/api/clients', { credentials: 'include' });
      if (clientsResponse.ok) {
        const remoteClients = await clientsResponse.json();
        clients.splice(0, clients.length, ...remoteClients.clients);
        saveClients(clients);
      }
    } else {
      const plansResponse = await fetch('/api/my/plans', { credentials: 'include' });
      if (plansResponse.ok) {
        const remotePlans = await plansResponse.json();
        if (remotePlans.plans[0]) {
          plans.personal = remotePlans.plans[0].plan;
          savePlans(plans);
        }
      }
    }
    render();
  } catch {
    // Local-only mode remains available when the API is not configured.
  }
}

async function deleteAccount() {
  try {
    const response = await fetch('/api/account', { method: 'DELETE', credentials: 'include' });
    if (!response.ok && ![401, 404].includes(response.status)) {
      window.alert('Не удалось удалить аккаунт на сервере.');
      return false;
    }
  } catch {
    // Local-only mode has no API; local personal data is still removed below.
  }
  clearLocalData();
  window.location.reload();
  return true;
}

async function saveProfileWithBackend(nextProfile) {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return saveProfile(nextProfile);
  try {
    const authResponse = await fetch('/api/auth', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) });
    if (!authResponse.ok) throw new Error('Не удалось подтвердить Telegram-пользователя.');
    const response = await fetch('/api/profile', { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: nextProfile.name, height: nextProfile.height, weight: nextProfile.weight, role: nextProfile.role }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить роль.');
    nextProfile.role = result.user.role;
    return saveProfile(nextProfile);
  } catch (error) {
    return saveProfile(nextProfile);
  }
}

document.querySelector('#previousWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, -7); render(); });
document.querySelector('#nextWeek').addEventListener('click', () => { selectedWeek = addDays(selectedWeek, 7); render(); });
document.querySelector('#todayButton').addEventListener('click', () => { selectedWeek = new Date(currentWeek); selectedDay = dayIndexFor(today); render(); });
document.querySelector('#saveDayComment').addEventListener('click', saveSelectedDayComment);
document.querySelector('#planTab').addEventListener('click', () => { currentView = 'plan'; render(); });
document.querySelector('#clientsTab').addEventListener('click', () => { currentView = 'clients'; render(); });
document.querySelector('#backToClients').addEventListener('click', () => { currentView = 'clients'; selectedClientId = null; render(); });

const menuBackdrop = document.querySelector('#menuBackdrop');
const closeMenu = () => { menuBackdrop.hidden = true; document.querySelector('#menuButton').setAttribute('aria-expanded', 'false'); };
document.querySelector('#menuButton').addEventListener('click', () => { menuBackdrop.hidden = false; document.querySelector('#menuButton').setAttribute('aria-expanded', 'true'); });
document.querySelector('#closeMenu').addEventListener('click', closeMenu);
menuBackdrop.addEventListener('click', (event) => { if (event.target === menuBackdrop) closeMenu(); });
document.querySelector('#menuPlan').addEventListener('click', () => { currentView = 'plan'; closeMenu(); render(); });
document.querySelector('#menuClients').addEventListener('click', () => { currentView = 'clients'; closeMenu(); render(); });
document.querySelector('#menuSchedule').addEventListener('click', () => { currentView = 'schedule'; closeMenu(); render(); });
document.querySelector('#previousScheduleWeek').addEventListener('click', () => { scheduleWeek = addDays(scheduleWeek, -7); render(); });
document.querySelector('#nextScheduleWeek').addEventListener('click', () => { scheduleWeek = addDays(scheduleWeek, 7); render(); });

const personForm = initPersonForm({ profile: profile || {}, hasExistingProfile: Boolean(profile), clients, saveProfile: saveProfileWithBackend, saveClients, saveClient: saveClientBackend, onProfileSaved: () => { profile = loadProfile(); handleProfileSaved(); }, onClientSaved: handleClientSaved, onDeleteAccount: deleteAccount });
const exerciseForm = initExerciseForm({ getSelectedDate: () => dateKey(selectedDate()), getState: () => activePlan().state, saveState: saveActivePlan, onSaved: render });
const scheduleForm = initScheduleForm({ clients, isTrainer: () => profile?.role === 'trainer', getDate: () => ({ key: dateKey(addDays(scheduleWeek, scheduleDay)), label: `${fullDayNames[scheduleDay]}, ${formatDate(addDays(scheduleWeek, scheduleDay))}` }), schedule, saveSchedule, onSaved: render });

initTelegramTheme();
render();
if (!profile) personForm.open('profile');
syncBackendAccount();

function initials(name) {
  return String(name ?? '').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function escapeAttribute(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])).replace(/`/g, '&#096;');
}
