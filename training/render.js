import { dayNames, fullDayNames, monthNames } from './constants.js';
import { addDays, dateKey, formatDate } from './date-utils.js';
import { $ } from './dom.js';

export function renderWeek({ selectedWeek, selectedDay, today, state, onDaySelect }) {
  const endOfWeek = addDays(selectedWeek, 6);
  $('#weekTitle').textContent = selectedWeek.getMonth() === endOfWeek.getMonth()
    ? `${selectedWeek.getDate()} — ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]}`
    : `${formatDate(selectedWeek)} — ${formatDate(endOfWeek)}`;

  $('#daysList').innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(selectedWeek, index);
    const isToday = dateKey(date) === dateKey(today);
    const isSelected = index === selectedDay;
    const count = (state[dateKey(date)] || []).length;
    return `<button class="day-button ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" type="button" data-day="${index}">
      <span class="day-name">${dayNames[index]}</span><span class="day-number">${date.getDate()}</span>${count ? '<span class="day-mark">•</span>' : ''}
    </button>`;
  }).join('');

  document.querySelectorAll('.day-button').forEach((button) => {
    button.addEventListener('click', () => onDaySelect(Number(button.dataset.day)));
  });
}

export function renderDay({ selectedDate, selectedDay, today, state, dayComment, onDelete, onEdit, onToggle }) {
  const exercises = state[dateKey(selectedDate)] || [];
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const totalReps = exercises.reduce((sum, exercise) => sum + exercise.sets.reduce((setSum, reps) => setSum + reps, 0), 0);
  const completedCount = exercises.filter((exercise) => exercise.completed !== false).length;
  const progress = exercises.length ? Math.round((completedCount / exercises.length) * 100) : 0;

  $('#selectedDateLabel').textContent = `${fullDayNames[selectedDay]}, ${formatDate(selectedDate).toUpperCase()}`;
  $('#selectedDayTitle').textContent = selectedDay === Math.max((today.getDay() || 7) - 1, 0) && dateKey(selectedDate) === dateKey(today) ? 'План на сегодня' : 'План тренировки';
  $('#exerciseCount').textContent = exercises.length;
  $('#setCount').textContent = totalSets;
  $('#repCount').textContent = totalReps;
  $('#progressValue').textContent = `${progress}%`;
  $('#progressRing').style.setProperty('--progress', `${progress}%`);
  $('#dayCommentInput').value = dayComment || '';

  $('#exerciseList').innerHTML = exercises.length ? exercises.map((exercise, index) => `
    <article class="exercise-card ${exercise.completed === false ? 'not-completed' : ''}" style="animation-delay: ${index * 50}ms">
      <div class="exercise-card-top"><div><h3>${escapeHtml(exercise.name)}${exercise.weight ? ` <span class="weight-label">${exercise.weight} кг</span>` : ''}</h3><p>${exercise.sets.length} подхода · ${exercise.sets.reduce((sum, reps) => sum + reps, 0)} повторений</p></div>
      <div class="exercise-actions"><button class="status-toggle" type="button" data-toggle="${index}" aria-label="${exercise.completed === false ? 'Отметить выполненным' : 'Отметить невыполненным'}"><span>✓</span> ${exercise.completed === false ? 'Не выполнено' : 'Выполнено'}</button><button class="edit-button" type="button" data-edit="${index}" aria-label="Изменить упражнение">✎</button><button class="delete-button" type="button" data-delete="${index}" aria-label="Удалить упражнение">×</button></div></div>
      ${exercise.comment ? `<p class="exercise-comment">${escapeHtml(exercise.comment)}</p>` : ''}
      <div class="set-pills">${exercise.sets.map((reps, setIndex) => `<span class="set-pill">${setIndex + 1} подход · ${reps} повт.</span>`).join('')}</div>
    </article>`).join('') : '<div class="empty-state"><strong>Пока ничего нет</strong><p>Добавьте выполненное упражнение, чтобы вести историю прогресса.</p></div>';

  document.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => onDelete(Number(button.dataset.delete)));
  });
  document.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => onEdit(Number(button.dataset.edit)));
  });
  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => onToggle(Number(button.dataset.toggle)));
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}
