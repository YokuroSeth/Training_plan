export function roleForUser(storedRole) {
  return storedRole === 'trainer' ? 'trainer' : 'self';
}

export function canManageClient(actor, client) {
  return actor?.role === 'trainer' && client?.trainerId === String(actor.id);
}
