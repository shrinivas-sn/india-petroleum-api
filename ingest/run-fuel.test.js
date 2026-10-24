import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFuel } from './run-fuel.js';

const text = () =>
  readFileSync(new URL('./fixtures/raw-30-days-2022.txt', import.meta.url), 'utf8');
const record = {
  file_url: 'https://ppac.gov.in/uploads/page-images/1_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf',
  sha256: 'aaa',
  started_at_utc: '2026-10-22T10:00:00Z',
};
const job = (over = {}) => ({
  record,
  pdfSha256: 'aaa',
  rawText: text(),
  outDir: mkdtempSync(join(tmpdir(), 'run-fuel-')),
  ...over,
});

test('an empty data folder gets the three files and exit code 0', () => {
  const j = job();
  const r = runFuel(j);
  assert.equal(r.code, 0);
  assert.equal(r.status, 'written');
  assert.deepEqual(readdirSync(j.outDir).sort(), ['changes.json', 'daily.json', 'meta.json']);
  assert.match(r.summary, /30 days/);
});

test('a second run with no new day reports no change and exits 0', () => {
  const j = job();
  runFuel(j);
  const again = runFuel(j);
  assert.equal(again.code, 0);
  assert.equal(again.status, 'no-change');
});

test('a restated stored row exits 3, writes nothing, and names the date', () => {
  const j = job();
  runFuel(j);
  const before = readFileSync(join(j.outDir, 'daily.json'), 'utf8');
  const r = runFuel({ ...j, rawText: text().replace('96.21 110.82', '96.31 110.82') });
  assert.equal(r.code, 3);
  assert.match(r.report, /2022-03-22/);
  assert.equal(readFileSync(join(j.outDir, 'daily.json'), 'utf8'), before);
});

test('a gap in the new file exits 3 and leaves the folder empty', () => {
  const j = job();
  const gappy = text().split('\n').filter((l) => !l.startsWith('20-Mar-22')).join('\n');
  const r = runFuel({ ...j, rawText: gappy });
  assert.equal(r.code, 3);
  assert.match(r.report, /2022-03-20/);
  assert.equal(existsSync(join(j.outDir, 'daily.json')), false);
});

test('a hash that differs from the download record is refused before anything is built', () => {
  const j = job({ pdfSha256: 'bbb' });
  assert.throws(() => runFuel(j), /PROVENANCE/);
  assert.deepEqual(readdirSync(j.outDir), []);
});

test('a run that adds one day carries a commit message with the new date and posted date', () => {
  const j = job();
  const older = text().split('\n').filter((l) => !l.startsWith('7-Apr-22')).join('\n');
  runFuel({ ...j, rawText: older });
  const r = runFuel(j);
  assert.equal(r.commitMessage, 'ingest(fuel): 2022-04-07..2022-04-07, 1 day(s), posted 2026-10-22');
});

test('a first run lists the whole range in the commit message', () => {
  const r = runFuel(job());
  assert.equal(r.commitMessage, 'ingest(fuel): 2022-03-09..2022-04-07, 30 day(s), posted 2026-10-22');
});

test('a published shock exits 3 and lists its dates, and goes through once those dates are in approvedMoves', () => {
  const typo = text().replace(/^(7-Apr-22 )(\d+\.\d+)/m, (_, date, price) => `${date}${(Number(price) * 10).toFixed(2)}`);
  const j = job();
  const refused = runFuel({ ...j, rawText: typo });
  assert.equal(refused.code, 3);
  assert.match(refused.report, /IMPLAUSIBLE/);
  assert.match(refused.report, /dates: 2022-04-07/);
  assert.deepEqual(readdirSync(j.outDir), []);
  const ok = runFuel({ ...j, rawText: typo, approvedMoves: ['2022-04-07'] });
  assert.equal(ok.code, 0);
  assert.equal(ok.status, 'written');
});
