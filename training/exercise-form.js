import { $ } from './dom.js';

export function initExerciseForm({ getSelectedDate, getState, saveState, onSaved }) {
  let setDraft = [{ reps: 10 }];
  let editingIndex = null;

  const renderSetDraft = () => {
    $('#setsList').innerHTML = setDraft.map((set, index) => `<div class="set-row"><span class="set-number">Подход ${index + 1}</span><input class="number-input" type="number" min="1" max="999" value="${set.reps}" data-set="${index}" aria-label="Повторения в подходе ${index + 1}" required><button class="remove-set" type="button" data-remove-set="${index}" aria-label="Удалить подход" ${setDraft.length === 1 ? 'disabled' : ''}>×</button></div>`).join('');
    document.querySelectorAll('[data-set]').forEach((input) => input.addEventListener('input', () => { setDraft[Number(input.dataset.set)].reps = Number(input.value); }));
    document.querySelectorAll('[data-remove-set]').forEach((button) => button.addEventListener('click', () => { setDraft.splice(Number(button.dataset.removeSet), 1); renderSetDraft(); }));
  };

  const openForm = (index = null) => {
    editingIndex = index;
    const exercise = index === null ? null : (getState()[getSelectedDate()] || [])[index];
    $('#formTitle').textContent = exercise ? 'Изменить упражнение' : 'Новое упражнение';
    $('#saveExerciseButton').textContent = exercise ? 'Сохранить изменения' : 'Сохранить упражнение';
    $('#exerciseName').value = exercise?.name || '';
    $('#exerciseWeight').value = exercise?.weight ?? '';
    $('#exerciseComment').value = exercise?.comment || '';
    setDraft = exercise ? exercise.sets.map((reps) => ({ reps })) : [{ reps: 10 }];
    renderSetDraft();
    $('#modalBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#exerciseName').focus();
  };
  const closeForm = () => { $('#modalBackdrop').hidden = true; document.body.style.overflow = ''; };

  $('#openFormButton').addEventListener('click', () => openForm());
  $('#closeFormButton').addEventListener('click', closeForm);
  $('#modalBackdrop').addEventListener('click', (event) => { if (event.target === $('#modalBackdrop')) closeForm(); });
  $('#addSetButton').addEventListener('click', () => { setDraft.push({ reps: 10 }); renderSetDraft(); });
  $('#exerciseForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#exerciseName').value.trim();
    const weightValue = $('#exerciseWeight').value.trim();
    const weight = weightValue ? Number(weightValue) : null;
    const comment = $('#exerciseComment').value.trim();
    if (!name || setDraft.some((set) => !set.reps || set.reps < 1)) return;
    const key = getSelectedDate();
    const state = getState();
    const exercises = state[key] || [];
    const previousExercise = editingIndex === null ? null : exercises[editingIndex];
    const updatedExercise = { name, weight, comment, sets: setDraft.map((set) => set.reps), completed: previousExercise?.completed !== false };
    if (editingIndex === null) exercises.push(updatedExercise);
    else exercises[editingIndex] = updatedExercise;
    state[key] = exercises;
    saveState(state);
    $('#exerciseForm').reset();
    setDraft = [{ reps: 10 }];
    renderSetDraft();
    closeForm();
    onSaved();
  });

  renderSetDraft();
  return { openForm };
}
