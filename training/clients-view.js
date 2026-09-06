import { $ } from './dom.js';
import { isSafeImageSource } from './security.js';

export function renderClients({ clients, activeClientId, onSelect, onEdit, onDelete, onAdd }) {
  $('#clientList').innerHTML = clients.length ? clients.map((client) => `
    <article class="client-card ${client.id === activeClientId ? 'selected' : ''}">
      <div class="client-avatar">${isSafeImageSource(client.photo) ? `<img src="${escapeAttribute(client.photo)}" alt="">` : initials(client.name)}</div>
      <div class="client-info"><h3>${escapeHtml(client.name)}</h3><p>${client.height ? `${client.height} см` : 'Рост не указан'}${client.weight ? ` · ${client.weight} кг` : ''}${client.telegramId ? ` · ID ${escapeHtml(client.telegramId)}` : ''}</p></div>
      <div class="client-actions"><button class="client-select" type="button" data-select-client="${escapeAttribute(client.id)}">${client.id === activeClientId ? 'Открыт' : 'План'}</button><button class="edit-button" type="button" data-edit-client="${escapeAttribute(client.id)}" aria-label="Изменить клиента">✎</button><button class="delete-button" type="button" data-delete-client="${escapeAttribute(client.id)}" aria-label="Удалить клиента">×</button></div>
    </article>`).join('') : '<div class="empty-state"><strong>Клиентов пока нет</strong><p>Добавьте первого клиента, чтобы вести его план отдельно.</p></div>';

  $('#clientList').querySelectorAll('[data-select-client]').forEach((button) => button.addEventListener('click', () => onSelect(button.dataset.selectClient)));
  $('#clientList').querySelectorAll('[data-edit-client]').forEach((button) => button.addEventListener('click', () => onEdit(button.dataset.editClient)));
  $('#clientList').querySelectorAll('[data-delete-client]').forEach((button) => button.addEventListener('click', () => onDelete(button.dataset.deleteClient)));
  $('#addClientButton').onclick = onAdd;
}

function initials(name) {
  return String(name ?? '').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
