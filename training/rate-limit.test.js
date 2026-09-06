import test from 'node:test';
import assert from 'node:assert/strict';
import { UserRateLimiter } from './rate-limit.js';

test('blocks on the fourth message inside one second', () => {
  const limiter = new UserRateLimiter({ blockMs: 300_000 });
  const start = 1_000_000;
  assert.equal(limiter.check(42, start).allowed, true);
  assert.equal(limiter.check(42, start + 100).allowed, true);
  assert.equal(limiter.check(42, start + 200).allowed, true);
  assert.equal(limiter.check(42, start + 300).newlyBlocked, true);
  assert.equal(limiter.check(42, start + 400).blocked, true);
});

test('allows messages after the five-minute block expires', () => {
  const limiter = new UserRateLimiter({ blockMs: 300_000 });
  const start = 2_000_000;
  for (let index = 0; index < 4; index += 1) limiter.check(7, start + index);
  assert.equal(limiter.check(7, start + 300_004).allowed, true);
});

test('keeps users isolated', () => {
  const limiter = new UserRateLimiter();
  const start = 3_000_000;
  for (let index = 0; index < 4; index += 1) limiter.check(1, start + index);
  assert.equal(limiter.check(2, start + 4).allowed, true);
});
