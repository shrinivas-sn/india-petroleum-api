import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBehind, isStale } from './freshness.js';

const meta = { last_date: '2026-10-20' };

test('three days behind is 3 and stale', () => {
  const now = new Date('2026-10-23T06:00:00Z');
  assert.equal(daysBehind(meta, now), 3);
  assert.equal(isStale(meta, now), true);
});

test('one day behind is 1 and fine', () => {
  const now = new Date('2026-10-21T06:00:00Z');
  assert.equal(daysBehind(meta, now), 1);
  assert.equal(isStale(meta, now), false);
});

test('two days behind still passes (a Sunday or holiday gap), three does not', () => {
  assert.equal(isStale(meta, new Date('2026-10-22T06:00:00Z')), false);
  assert.equal(isStale(meta, new Date('2026-10-23T00:00:00Z')), true);
});

test('the day is counted in IST: 20:00 UTC is already the next day in India', () => {
  assert.equal(daysBehind(meta, new Date('2026-10-20T20:00:00Z')), 1);
  assert.equal(daysBehind(meta, new Date('2026-10-20T10:00:00Z')), 0);
});

test('a last_date in the future counts as 0 days behind', () => {
  assert.equal(daysBehind(meta, new Date('2026-10-18T10:00:00Z')), 0);
});

test('a limit can be raised', () => {
  assert.equal(isStale(meta, new Date('2026-10-23T06:00:00Z'), { limit: 3 }), false);
});
