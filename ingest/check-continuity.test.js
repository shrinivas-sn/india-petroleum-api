import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseMetroText } from './parse-metro.js';
import { checkContinuity } from './check-continuity.js';

const fixtureText = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const rows = () => parseMetroText(fixtureText('raw-may-2026.txt')).petrol;
const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const cli = path('./check-continuity.js');

test('a complete run of days is ok and counted', () => {
  const r = checkContinuity(rows());
  assert.deepEqual(r, { ok: true, missing: [], duplicates: [], incomplete: [], count: 10 });
});

test('a removed day is reported as missing', () => {
  const r = checkContinuity(rows().filter((x) => x.date !== '2026-05-22'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['2026-05-22']);
});

test('a duplicated day is reported', () => {
  const r = rows();
  const r2 = checkContinuity([...r, r[3]]);
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.duplicates, [r[3].date]);
});

test('a row with a missing city price is incomplete', () => {
  const r = rows();
  delete r[2].chennai;
  const out = checkContinuity(r);
  assert.equal(out.ok, false);
  assert.deepEqual(out.incomplete, [r[2].date]);
});

test('a non-numeric or non-positive price is incomplete', () => {
  const a = rows();
  a[0].delhi = NaN;
  const b = rows();
  b[1].mumbai = 0;
  assert.deepEqual(checkContinuity(a).incomplete, [a[0].date]);
  assert.deepEqual(checkContinuity(b).incomplete, [b[1].date]);
});

test('from: days before the first row are missing', () => {
  const out = checkContinuity(rows(), { from: '2026-05-15' });
  assert.deepEqual(out.missing, ['2026-05-15', '2026-05-16', '2026-05-17']);
});

test('a known gap for that fuel and date no longer fails; another fuel does', () => {
  const r = rows().filter((x) => x.date !== '2026-05-22');
  const gaps = [{ date: '2026-05-22', fuel: 'petrol', reason: 'test' }];
  assert.equal(checkContinuity(r, { fuel: 'petrol', knownGaps: gaps }).ok, true);
  assert.equal(checkContinuity(r, { fuel: 'diesel', knownGaps: gaps }).ok, false);
});

test('rows given in any order are checked by date', () => {
  const shuffled = [...rows()].reverse();
  assert.equal(checkContinuity(shuffled).ok, true);
});

test('cli: exits 0 and prints counts for a complete file', () => {
  const run = spawnSync(process.execPath, [cli, path('./fixtures/raw-may-2026.txt')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /petrol 10 ok, diesel 10 ok/);
});

test('cli: exits 1 and names the missing day when a row is removed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cc-'));
  const file = join(dir, 'gap.txt');
  const text = fixtureText('raw-may-2026.txt').split('\n').filter((l) => !l.startsWith('22-May-26')).join('\n');
  writeFileSync(file, text);
  const run = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout + run.stderr, /missing.*2026-05-22/s);
});
