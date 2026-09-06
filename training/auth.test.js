import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from './auth.js';

const botToken = '123456:TEST_TOKEN';
const now = 1_700_000_000;

function makeInitData(authDate = now) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAH-test-query',
    user: JSON.stringify({ id: 42, first_name: 'Test' })
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('accepts valid Telegram initData', () => {
  const result = verifyTelegramInitData(makeInitData(), botToken, now);
  assert.deepEqual(result.user, { id: 42, first_name: 'Test' });
});

test('rejects tampered initData', () => {
  const tampered = makeInitData().replace('AAH-test-query', 'AAH-tampered');
  assert.equal(verifyTelegramInitData(tampered, botToken, now), null);
});

test('rejects expired initData', () => {
  assert.equal(verifyTelegramInitData(makeInitData(now - 86_401), botToken, now), null);
});
