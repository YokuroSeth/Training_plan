import { $ } from './dom.js';

export function initScheduleForm({ clients, isTrainer, getDate, schedule, saveSchedule, onSaved }) {
  let editingEventId = null;
  const close = () => { $('#scheduleBackdrop').hidden = true; document.body.style.overflow = ''; };

  const open = (event = null) => {
    editingEventId = event?.id || null;
    $('#scheduleForm').reset();
    const currentDate = getDate();
    const date = event ? { key: event.date, label: event.date === currentDate.key ? currentDate.label : event.date } : currentDate;
    $('#scheduleFormDate').textContent = date.label;
    $('#scheduleFormTitle').textContent = event ? 'Изменить тренировку' : 'Запланировать тренировку';
    $('#scheduleFormSubmit').textContent = event ? 'Сохранить изменения' : 'Добавить в расписание';
    $('#scheduleTitle').value = event?.title || '';
    $('#scheduleDate').value = event?.date || currentDate.key;
    $('#scheduleTime').value = event?.time || '';
    $('#scheduleDuration').value = event?.duration || '';
    const trainerMode = typeof isTrainer === 'function' ? isTrainer() : isTrainer;
    $('#scheduleClientField').hidden = !trainerMode;
    $('#scheduleClient').required = trainerMode;
    $('#scheduleClient').innerHTML = '<option value="">Выберите клиента</option>' + clients.map((client) => `<option value="${escapeAttribute(client.id)}">${escapeHtml(client.name)}</option>`).join('');
    $('#scheduleClient').value = event?.clientId || '';
    $('#scheduleBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#scheduleTitle').focus();
  };

  $('#addScheduleButton').addEventListener('click', () => open());
  $('#closeScheduleForm').addEventListener('click', close);
  $('#scheduleBackdrop').addEventListener('click', (event) => { if (event.target === $('#scheduleBackdrop')) close(); });
  $('#scheduleForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const dateKey = $('#scheduleDate').value;
    const title = $('#scheduleTitle').value.trim() || 'Тренировка';
    const time = $('#scheduleTime').value;
    const duration = Number($('#scheduleDuration').value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !time || !duration || duration < 1) return;
    const trainerMode = typeof isTrainer === 'function' ? isTrainer() : isTrainer;
    const updatedEvent = { id: editingEventId || `event-${Date.now()}`, date: dateKey, time, duration, title, clientId: trainerMode ? $('#scheduleClient').value : null };
    if (editingEventId) {
      const eventIndex = schedule.findIndex((event) => event.id === editingEventId);
      schedule[eventIndex] = updatedEvent;
    } else schedule.push(updatedEvent);
    saveSchedule(schedule);
    close();
    onSaved();
  });

  return { open };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
