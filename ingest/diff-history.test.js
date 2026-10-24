import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMetroText } from './parse-metro.js';
import { toDays } from './days.js';
import { diffHistory, revisions, revisionDays } from './diff-history.js';

const days = (name) =>
  toDays(parseMetroText(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')));
const may = () => days('raw-may-2026.txt');
const clone = (x) => JSON.parse(JSON.stringify(x));

test('one new day at the end is appended and nothing else changes', () => {
  const parsed = may();
  const stored = parsed.slice(0, -1);
  const d = diffHistory(stored, parsed);
  assert.equal(d.ok, true);
  assert.deepEqual(d.appended.map((x) => x.date), [parsed.at(-1).date]);
  assert.deepEqual(d.changedOld, []);
  assert.deepEqual(d.removed, []);
});

test('an unchanged series appends nothing', () => {
  const d = diffHistory(may(), may());
  assert.equal(d.ok, true);
  assert.deepEqual(d.appended, []);
});

test('a restated old price is reported with date, fuel, city, old and new', () => {
  const stored = may();
  const parsed = clone(stored);
  parsed[3].diesel.mumbai = 96.01;
  const d = diffHistory(stored, parsed);
  assert.equal(d.ok, false);
  assert.deepEqual(d.changedOld, [
    { date: stored[3].date, fuel: 'diesel', city: 'mumbai', old: stored[3].diesel.mumbai, new: 96.01 },
  ]);
});

test('a stored day that the new file no longer has is reported as removed', () => {
  const stored = may();
  const parsed = stored.filter((x) => x.date !== '2026-05-22');
  const d = diffHistory(stored, parsed);
  assert.equal(d.ok, false);
  assert.deepEqual(d.removed, ['2026-05-22']);
});

test('an approved restatement date does not block and is listed apart', () => {
  const stored = may();
  const parsed = clone(stored);
  parsed[3].petrol.delhi += 0.5;
  const d = diffHistory(stored, parsed, { approved: [stored[3].date] });
  assert.equal(d.ok, true);
  assert.deepEqual(d.changedOld, []);
  assert.equal(d.approvedChanges.length, 1);
  assert.equal(d.approvedChanges[0].date, stored[3].date);
});

test('revisions list every price that moved from the previous day', () => {
  const r = revisions(may()).filter((x) => x.fuel === 'petrol' && x.city === 'delhi');
  assert.deepEqual(r, [
    { date: '2026-05-19', fuel: 'petrol', city: 'delhi', from: 97.77, to: 98.64 },
    { date: '2026-05-23', fuel: 'petrol', city: 'delhi', from: 98.64, to: 99.51 },
    { date: '2026-05-25', fuel: 'petrol', city: 'delhi', from: 99.51, to: 102.12 },
  ]);
});

test('revisionDays are the distinct dates where any price moved', () => {
  assert.deepEqual(revisionDays(may()), ['2026-05-19', '2026-05-23', '2026-05-25']);
});

test('the first day of a series has no previous day and is never a revision', () => {
  assert.deepEqual(revisionDays(may().slice(0, 1)), []);
});
