import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, parsePosted } from './summarize-proof.js';

const rec = (day, hour, over = {}) => ({
  run_id: `${day}-${hour}`, trigger: 'schedule', started_at_utc: `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:30:00Z`,
  complete: true, tls_verified: true, table_posted: `${String(day).padStart(2, '0')}-Oct-26`, error: null, ...over,
});
const failed = (day, hour) => rec(day, hour, { complete: false, table_posted: null, error: 'INCOMPLETE: got 1 of 2 bytes' });

test('parsePosted reads DD-Mon-YY', () => {
  assert.equal(parsePosted('22-Oct-26'), '2026-10-22');
  assert.equal(parsePosted(null), null);
});

test('seven good days, one failed run on day 3 with a good run the same day -> 7 passed, PASS', () => {
  const recs = [];
  for (let d = 1; d <= 7; d++) recs.push(rec(d, 1), rec(d, 8));
  recs[4] = failed(3, 1);
  const s = summarize(recs);
  assert.equal(s.days.filter((x) => x.status === 'pass').length, 7);
  assert.equal(s.verdict, 'PASS');
  assert.match(s.days[2].errors.join(' '), /INCOMPLETE/);
});

test('a day with no scheduled run is reported "no run" and blocks PASS', () => {
  const recs = [];
  for (const d of [1, 2, 3, 4, 6, 7, 8]) recs.push(rec(d, 1));
  const s = summarize(recs);
  assert.equal(s.days.find((x) => x.date === '2026-10-05').status, 'no run');
  assert.equal(s.verdict, 'IN PROGRESS');
});

test('two days with only failed runs -> FAIL', () => {
  const s = summarize([failed(1, 1), failed(1, 8), failed(2, 1), failed(2, 8), rec(3, 1)]);
  assert.equal(s.verdict, 'FAIL');
});

test('manual runs are ignored', () => {
  const s = summarize([rec(1, 1, { trigger: 'manual' })]);
  assert.equal(s.days.length, 0);
});

test('a page that failed but was covered by the fallback still counts as a pass and is listed in the day\'s errors', () => {
  const recs = [rec(1, 1, { page_errors: ['https://ppac.gov.in/retail: fetch failed (ECONNRESET)'] }), rec(1, 8)];
  const s = summarize(recs);
  assert.equal(s.days[0].status, 'pass');
  assert.match(s.days[0].errors.join(' '), /ECONNRESET/);
});

test('records written before page_errors existed still summarise', () => {
  const s = summarize([rec(1, 1)]);
  assert.deepEqual(s.days[0].errors, []);
});
