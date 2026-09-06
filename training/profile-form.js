import { $ } from './dom.js';
import { isSafeImageSource } from './security.js';

export function initPersonForm({ profile, hasExistingProfile, clients, saveProfile, saveClients, saveClient, onProfileSaved, onClientSaved, onDeleteAccount }) {
  let mode = 'profile';
  let editingClientId = null;
  let selectedPhoto = '';
  let photoReadPromise = Promise.resolve();

  const open = (nextMode = 'profile', client = null) => {
    mode = nextMode;
    editingClientId = client?.id || null;
    const person = mode === 'profile' ? profile : client;
    $('#personFormTitle').textContent = mode === 'profile'
      ? (hasExistingProfile ? 'Мой профиль' : 'Настройка профиля')
      : (client ? 'Изменить клиента' : 'Новый клиент');
    $('#personFormSubtitle').textContent = mode === 'profile'
      ? 'Данные помогут настроить приложение под вас'
      : 'У клиента будет собственный план тренировок';
    $('#personName').value = person?.name || '';
    selectedPhoto = person?.photo || '';
    photoReadPromise = Promise.resolve();
    $('#personPhoto').value = '';
    $('#personPhotoName').textContent = selectedPhoto ? 'Текущее фото' : 'Файл не выбран';
    renderPhotoPreview(selectedPhoto);
    $('#personHeight').value = person?.height || '';
    $('#personWeight').value = person?.weight || '';
    $('#personTelegramId').value = person?.telegramId || '';
    $('#personTelegramField').hidden = mode !== 'client';
    $('#personTelegramId').required = mode === 'client';
    $('#personRole').value = person?.role || (mode === 'profile' ? 'self' : 'client');
    $('#personRoleField').hidden = mode !== 'profile';
    $('#personFormSubmit').textContent = mode === 'profile' ? 'Сохранить профиль' : 'Сохранить клиента';
    $('#deleteAccountButton').hidden = mode !== 'profile' || !hasExistingProfile;
    $('#personBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#personName').focus();
  };

  const close = () => {
    $('#personBackdrop').hidden = true;
    document.body.style.overflow = '';
  };

  $('#profileButton').addEventListener('click', () => open('profile'));
  $('#personPhoto').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      window.alert('Выберите PNG, JPG, GIF или WebP размером до 2 МБ.');
      event.target.value = '';
      return;
    }
    photoReadPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => { selectedPhoto = reader.result; $('#personPhotoName').textContent = file.name; renderPhotoPreview(selectedPhoto); resolve(); });
      reader.readAsDataURL(file);
    });
  });
  $('#closePersonForm').addEventListener('click', close);
  $('#personBackdrop').addEventListener('click', (event) => { if (event.target === $('#personBackdrop')) close(); });
  $('#deleteAccountButton').addEventListener('click', async () => {
    if (!window.confirm('Удалить аккаунт и все персональные данные? Это действие нельзя отменить.')) return;
    const deleted = await onDeleteAccount();
    if (deleted) close();
  });
  $('#personForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    await photoReadPromise;
    const person = {
      name: $('#personName').value.trim(),
      photo: selectedPhoto,
      height: $('#personHeight').value ? Number($('#personHeight').value) : null,
      weight: $('#personWeight').value ? Number($('#personWeight').value) : null,
      telegramId: $('#personTelegramId').value.trim(),
      role: $('#personRole').value
    };
    if (!person.name) return;

    if (mode === 'profile') {
      Object.assign(profile, person);
      const saved = await saveProfile(profile);
      if (saved === false) return;
      close();
      onProfileSaved();
      return;
    }

    const savedClient = await saveClient(person, editingClientId);
    if (savedClient === false) return;
    if (editingClientId) Object.assign(clients.find((item) => item.id === editingClientId), savedClient || person, { role: 'client' });
    else clients.push(savedClient || { ...person, role: 'client', id: `client-${Date.now()}` });
    saveClients(clients);
    close();
    onClientSaved(savedClient || person, editingClientId);
  });

  return { open, close };
}

function renderPhotoPreview(photo) {
  const preview = $('#personPhotoPreview');
  preview.innerHTML = '';
  if (!isSafeImageSource(photo)) {
    preview.innerHTML = '<span>Фото не выбрано</span>';
    return;
  }
  const image = document.createElement('img');
  image.src = photo;
  image.alt = 'Предпросмотр фото';
  preview.append(image);
}
