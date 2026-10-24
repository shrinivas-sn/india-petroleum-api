import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMetroText } from './parse-metro.js';
import { toDays } from './days.js';

const parsed = () =>
  parseMetroText(readFileSync(new URL('./fixtures/raw-first-lines.txt', import.meta.url), 'utf8'));

test('toDays joins both fuels per date and sorts ascending', () => {
  const days = toDays(parsed());
  assert.equal(days.length, 6);
  assert.equal(days[0].date, '2026-10-17');
  assert.equal(days.at(-1).date, '2026-10-22');
  assert.deepEqual(days.at(-1), {
    date: '2026-10-22',
    petrol: { delhi: 102.12, mumbai: 111.21, chennai: 107.77, kolkata: 113.51 },
    diesel: { delhi: 95.2, mumbai: 97.83, chennai: 99.55, kolkata: 99.82 },
  });
});

test('toDays throws when the fuels do not cover the same dates', () => {
  const p = parsed();
  p.diesel.pop();
  assert.throws(() => toDays(p), /same dates/);
});
