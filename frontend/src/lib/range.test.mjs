import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_REQUEST_DAYS, addMonths, chunks, daysBehind, exampleWindow, istToday, windowFor } from './range.js';

test('addMonths moves by calendar months and clamps to the end of a shorter month', () => {
  assert.equal(addMonths('2026-10-23', -3), '2026-07-23');
  assert.equal(addMonths('2026-12-31', -1), '2026-11-30');
  assert.equal(addMonths('2024-03-31', -1), '2024-02-29');
  assert.equal(addMonths('2025-03-31', -1), '2025-02-28');
  assert.equal(addMonths('2026-01-15', -12), '2025-01-15');
  assert.equal(addMonths('2026-01-15', -2), '2025-11-15');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
});

test('windowFor gives 3 months, 1 year or everything, ending on the newest date', () => {
  assert.deepEqual(windowFor('3m', '2017-06-16', '2026-10-23'), { from: '2026-07-23', to: '2026-10-23' });
  assert.deepEqual(windowFor('1y', '2017-06-16', '2026-10-23'), { from: '2025-10-23', to: '2026-10-23' });
  assert.deepEqual(windowFor('all', '2017-06-16', '2026-10-23'), { from: '2017-06-16', to: '2026-10-23' });
});

test('windowFor never starts before the first stored day', () => {
  assert.deepEqual(windowFor('1y', '2026-08-01', '2026-10-23'), { from: '2026-08-01', to: '2026-10-23' });
  assert.deepEqual(windowFor('3m', '2026-10-01', '2026-10-23'), { from: '2026-10-01', to: '2026-10-23' });
});

test('windowFor rejects an unknown range instead of guessing', () => {
  assert.throws(() => windowFor('5y', '2017-06-16', '2026-10-23'), /unknown range/i);
});

test('chunks returns one window when the span fits and contiguous windows when it does not', () => {
  assert.deepEqual(chunks('2026-01-01', '2026-01-31'), [{ from: '2026-01-01', to: '2026-01-31' }]);
  const long = chunks('2017-06-16', '2028-06-16');
  assert.ok(long.length >= 2);
  assert.equal(long[0].from, '2017-06-16');
  assert.equal(long[long.length - 1].to, '2028-06-16');
  for (let i = 0; i < long.length; i += 1) {
    const days = (Date.parse(long[i].to) - Date.parse(long[i].from)) / 86400000 + 1;
    assert.ok(days <= MAX_REQUEST_DAYS, `chunk ${i} spans ${days} days`);
    if (i > 0) assert.equal(Date.parse(long[i].from) - Date.parse(long[i - 1].to), 86400000, 'no gap and no overlap');
  }
});

test('chunks keeps a span of exactly the API limit in one request and splits one day more', () => {
  const from = '2017-06-16';
  const lastOfOne = new Date(Date.parse(`${from}T00:00:00Z`) + (MAX_REQUEST_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  assert.equal(chunks(from, lastOfOne).length, 1);
  const lastOfTwo = new Date(Date.parse(`${from}T00:00:00Z`) + MAX_REQUEST_DAYS * 86400000).toISOString().slice(0, 10);
  assert.equal(chunks(from, lastOfTwo).length, 2);
});

test('chunks refuses an inverted range', () => {
  assert.throws(() => chunks('2026-02-01', '2026-01-01'), /after/);
});

test('exampleWindow counts back from the newest date, both ends included', () => {
  assert.deepEqual(exampleWindow('2026-10-23', 7), { from: '2026-10-17', to: '2026-10-23' });
  assert.deepEqual(exampleWindow('2026-10-23', 1), { from: '2026-10-23', to: '2026-10-23' });
  assert.deepEqual(exampleWindow('2026-03-02', 30), { from: '2026-02-01', to: '2026-03-02' });
});

test('istToday is the calendar date in India, which is ahead of UTC by 5h30', () => {
  assert.equal(istToday(new Date('2026-10-23T18:29:59Z')), '2026-10-23');
  assert.equal(istToday(new Date('2026-10-23T18:30:00Z')), '2026-10-24');
});

test('daysBehind counts India calendar days and never goes below zero', () => {
  const now = new Date('2026-10-24T03:00:00Z'); // 08:30 on 24 October in India
  assert.equal(daysBehind('2026-10-23', now), 1);
  assert.equal(daysBehind('2026-10-24', now), 0);
  assert.equal(daysBehind('2026-10-25', now), 0);
  assert.equal(daysBehind('2026-10-19', now), 5);
});
