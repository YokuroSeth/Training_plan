import { dayNames, fullDayNames, monthNames } from './constants.js';
import { addDays, dateKey, formatDate } from './date-utils.js';
import { $ } from './dom.js';

const startHour = 6;
const endHour = 23;
const hourHeight = 72;

export function renderSchedule({ weekStart, selectedDay, today, schedule, clients, onDaySelect, onDelete, onEdit, onMove }) {
  const weekEnd = addDays(weekStart, 6);
  $('#scheduleWeekTitle').textContent = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`
    : `${formatDate(weekStart)} — ${formatDate(weekEnd)}`;

  $('#scheduleHeader').innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const eventsCount = schedule.filter((event) => event.date === dateKey(date)).length;
    return `<button class="calendar-day-header ${index === selectedDay ? 'selected' : ''} ${dateKey(date) === dateKey(today) ? 'today' : ''}" type="button" data-schedule-day="${index}"><span>${dayNames[index]}</span><strong>${date.getDate()}</strong>${eventsCount ? `<em>${eventsCount}</em>` : ''}</button>`;
  }).join('');
  document.querySelectorAll('[data-schedule-day]').forEach((button) => button.addEventListener('click', () => onDaySelect(Number(button.dataset.scheduleDay))));

  $('#scheduleTimeAxis').innerHTML = Array.from({ length: endHour - startHour + 1 }, (_, index) => `<span style="top: ${index * hourHeight}px">${String(startHour + index).padStart(2, '0')}:00</span>`).join('');
  $('#scheduleBoard').innerHTML = Array.from({ length: 7 }, (_, dayIndex) => renderDayColumn({ dayIndex, weekStart, schedule, clients, onDelete, onEdit, onMove })).join('');
  bindDragAndDrop({ onMove });
}

function renderDayColumn({ dayIndex, weekStart, schedule, clients, onDelete, onEdit }) {
  const date = addDays(weekStart, dayIndex);
  const events = schedule.filter((event) => event.date === dateKey(date)).sort((left, right) => left.time.localeCompare(right.time));
  const layout = getEventLayout(events);
  const cards = layout.map(({ event, column, columns }) => {
    const client = clients.find((item) => item.id === event.clientId);
    const top = (timeToMinutes(event.time) - startHour * 60) / 60 * hourHeight;
    const height = Math.max((event.duration / 60) * hourHeight - 6, 48);
    const width = 100 / columns;
    return `<article class="calendar-event" draggable="true" data-event-id="${escapeAttribute(event.id)}" style="top:${top}px;height:${height}px;left:calc(${column * width}% + 4px);width:calc(${width}% - 8px)"><div class="calendar-event-time">${escapeHtml(event.time)} · ${event.duration} мин</div><strong>${escapeHtml(event.title || 'Тренировка')}</strong>${client ? `<span>${escapeHtml(client.name)}</span>` : '<span>Личная тренировка</span>'}<div class="calendar-event-actions"><button class="edit-button" type="button" data-edit-event="${escapeAttribute(event.id)}" aria-label="Изменить тренировку">✎</button><button class="delete-button" type="button" data-delete-event="${escapeAttribute(event.id)}" aria-label="Удалить тренировку">×</button></div></article>`;
  }).join('');
  return `<div class="calendar-column" data-drop-day="${dayIndex}">${cards}</div>`;
}

function getEventLayout(events) {
  const columns = [];
  return events.map((event) => {
    const start = timeToMinutes(event.time);
    const end = start + event.duration;
    let column = columns.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) { column = columns.length; columns.push(end); } else columns[column] = end;
    const overlapping = events.filter((other) => timeToMinutes(other.time) < end && timeToMinutes(other.time) + other.duration > start);
    return { event, column, columns: Math.max(columns.length, overlapping.length) };
  });
}

function bindDragAndDrop({ onMove }) {
  document.querySelectorAll('[data-event-id]').forEach((eventCard) => {
    eventCard.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', eventCard.dataset.eventId);
      eventCard.classList.add('dragging');
    });
    eventCard.addEventListener('dragend', () => eventCard.classList.remove('dragging'));
  });
  document.querySelectorAll('[data-drop-day]').forEach((column) => {
    column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('drag-over'); });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('drag-over');
      const eventId = event.dataTransfer.getData('text/plain');
      const rect = column.getBoundingClientRect();
      const rawMinutes = startHour * 60 + ((event.clientY - rect.top) / hourHeight) * 60;
      const roundedMinutes = Math.max(startHour * 60, Math.min((endHour * 60) - 30, Math.round(rawMinutes / 30) * 30));
      onMove(eventId, Number(column.dataset.dropDay), minutesToTime(roundedMinutes));
    });
  });
  document.querySelectorAll('[data-delete-event]').forEach((button) => button.addEventListener('click', () => onDelete(button.dataset.deleteEvent)));
  document.querySelectorAll('[data-edit-event]').forEach((button) => button.addEventListener('click', () => onEdit(button.dataset.editEvent)));
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
