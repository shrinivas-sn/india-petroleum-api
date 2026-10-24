import { test } from 'node:test';
import assert from 'node:assert/strict';
import { niceScale, stepPath, timeTicks, valueAt } from './chart.js';
import { formatChange, formatDate, formatDateTime } from './format.js';

test('niceScale puts the ticks on round numbers and covers the data', () => {
  const s = niceScale(53.33, 110.04);
  assert.ok(s.min <= 53.33 && s.max >= 110.04);
  assert.deepEqual(s.ticks, [50, 60, 70, 80, 90, 100, 110, 120].filter((t) => t >= s.min && t <= s.max));
});

test('niceScale widens a flat series instead of dividing by zero', () => {
  const s = niceScale(96.72, 96.72);
  assert.ok(s.min < 96.72 && s.max > 96.72);
  assert.ok(s.ticks.length >= 2);
});

test('long spans get one tick per year, starting after the first January', () => {
  const ticks = timeTicks('2017-06-16', 3417, 12);
  assert.equal(ticks[0].label, '2018');
  assert.equal(ticks.at(-1).label, '2026');
  assert.equal(ticks[0].index, 199); // 2017-06-16 to 2018-01-01
});

test('months for a few-month span, days for a fortnight', () => {
  assert.deepEqual(timeTicks('2026-01-10', 100, 8).map((t) => t.label).slice(0, 2), ['2026-02', '2026-03']);
  const days = timeTicks('2022-05-15', 14, 6);
  assert.equal(days[0].label, '05-15');
  assert.ok(days.length <= 6);
});

test('a step path holds each price until the next change', () => {
  const points = [[0, 100], [3, 98], [6, 99]];
  const d = stepPath(points, 9, (i) => i * 10, (p) => 200 - p);
  assert.equal(d, 'M0 100H30V102H60V101H90');
});

test('valueAt returns the price in force on a day', () => {
  const points = [[0, 100], [3, 98], [6, 99]];
  assert.equal(valueAt(points, 0), 100);
  assert.equal(valueAt(points, 2), 100);
  assert.equal(valueAt(points, 3), 98);
  assert.equal(valueAt(points, 99), 99);
  assert.equal(valueAt([[2, 5]], 1), undefined);
});

test('dates and changes format the same everywhere', () => {
  assert.equal(formatDate('2022-05-22'), '22 May 2022');
  assert.equal(formatChange(-8.69), '−8.69');
  assert.equal(formatChange(3), '+3.00');
  assert.equal(formatChange(0), '0.00');
  assert.equal(formatDateTime('2026-10-24T07:13:20.524Z'), '24 Oct 2026, 07:13 UTC');
});
