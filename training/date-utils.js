import { monthNames } from './constants.js';

export const dateAtMonday = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
};

export const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export const formatDate = (date) => `${date.getDate()} ${monthNames[date.getMonth()]}`;
export const dayIndexFor = (date) => Math.max((date.getDay() || 7) - 1, 0);

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
