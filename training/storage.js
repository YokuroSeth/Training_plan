import { storageKey } from './constants.js';
import { readJson, writeJson } from './security.js';

const dayCommentsKey = 'training-day-comments-v1';
const profileKey = 'training-profile-v1';
const clientsKey = 'training-clients-v1';
const plansKey = 'training-plans-v1';
const scheduleKey = 'training-schedule-v1';

export const loadState = () => objectOrEmpty(readJson(storageKey, {}));
export const saveState = (state) => writeJson(storageKey, state);
export const loadDayComments = () => objectOrEmpty(readJson(dayCommentsKey, {}));
export const saveDayComments = (comments) => writeJson(dayCommentsKey, comments);
export const loadProfile = () => objectOrNull(readJson(profileKey, null));
export const saveProfile = (profile) => writeJson(profileKey, profile);
export const loadClients = () => arrayOrEmpty(readJson(clientsKey, []));
export const saveClients = (clients) => writeJson(clientsKey, clients);

export const loadPlans = () => {
	const storedPlans = readJson(plansKey, null);
	if (storedPlans && typeof storedPlans === 'object' && !Array.isArray(storedPlans)) return storedPlans;
	const personalPlan = { state: loadState(), dayComments: loadDayComments() };
	const plans = { personal: personalPlan };
	savePlans(plans);
	return plans;
};

export const savePlans = (plans) => writeJson(plansKey, plans);
export const loadSchedule = () => arrayOrEmpty(readJson(scheduleKey, []));
export const saveSchedule = (schedule) => writeJson(scheduleKey, schedule);
export const clearLocalData = () => [storageKey, dayCommentsKey, profileKey, clientsKey, plansKey, scheduleKey].forEach((key) => localStorage.removeItem(key));

const objectOrEmpty = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const objectOrNull = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const arrayOrEmpty = (value) => Array.isArray(value) ? value : [];
