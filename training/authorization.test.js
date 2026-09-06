import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageClient, roleForUser } from './authorization.js';

test('role is restricted to supported server roles', () => {
  assert.equal(roleForUser('trainer'), 'trainer');
  assert.equal(roleForUser('self'), 'self');
  assert.equal(roleForUser('admin'), 'self');
});

test('trainer can access only owned clients', () => {
  const actor = { id: '100', role: 'trainer' };
  assert.equal(canManageClient(actor, { trainerId: '100' }), true);
  assert.equal(canManageClient(actor, { trainerId: '200' }), false);
  assert.equal(canManageClient({ id: '200', role: 'self' }, { trainerId: '200' }), false);
});
