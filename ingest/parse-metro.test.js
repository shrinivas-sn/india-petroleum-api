import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMetroText } from './parse-metro.js';

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('first lines: posted date and the first rows with both fuels', () => {
  const out = parseMetroText(fixture('raw-first-lines.txt'));
  assert.equal(out.posted, '2026-10-22');
  assert.equal(out.petrol.length, 6);
  assert.equal(out.diesel.length, 6);
  assert.deepEqual(out.petrol[0], {
    date: '2026-10-22', delhi: 102.12, mumbai: 111.21, chennai: 107.77, kolkata: 113.51,
  });
  assert.deepEqual(out.diesel[0], {
    date: '2026-10-22', delhi: 95.2, mumbai: 97.83, chennai: 99.55, kolkata: 99.82,
  });
  assert.equal(out.petrol[5].date, '2026-10-17');
});

test('page break: header blocks and the form feed add no rows and lose none', () => {
  const out = parseMetroText(fixture('raw-page-break.txt'));
  assert.deepEqual(out.petrol.map((r) => r.date), [
    '2026-06-17', '2026-06-16', '2026-06-15', '2026-06-14', '2026-06-13', '2026-06-12', '2026-06-11',
  ]);
  assert.deepEqual(out.diesel.map((r) => r.date), out.petrol.map((r) => r.date));
});

test('last page: footnotes are ignored and the series ends on 16-Jun-17', () => {
  const out = parseMetroText(fixture('raw-last-page.txt'));
  const last = out.petrol.at(-1);
  assert.deepEqual(last, {
    date: '2017-06-16', delhi: 65.48, mumbai: 76.7, chennai: 68.02, kolkata: 68.03,
  });
  assert.equal(out.diesel.at(-1).delhi, 54.49);
  assert.equal(out.petrol.length, 5);
});

test('line endings and line breaks do not change the result', () => {
  const text = fixture('raw-may-2026.txt');
  const lf = parseMetroText('Table Posted: 22-Oct-26\n' + text);
  const crlf = parseMetroText('Table Posted: 22-Oct-26\r\n' + text.replace(/\n/g, '\r\n'));
  const oneLine = parseMetroText('Table Posted: 22-Oct-26 ' + text.replace(/\n/g, ' '));
  assert.deepEqual(crlf, lf);
  assert.deepEqual(oneLine, lf);
  assert.equal(lf.petrol.length, 10);
});

test('a garbled price throws PARSE_ERROR with the line', () => {
  const text = fixture('raw-first-lines.txt').replace('111.21', '11l.21');
  assert.throws(() => parseMetroText(text), (e) => e.code === 'PARSE_ERROR' && /line 3/.test(e.message));
});

test('a zero or negative price throws PARSE_ERROR', () => {
  const zero = fixture('raw-first-lines.txt').replace('113.51', '0.00');
  assert.throws(() => parseMetroText(zero), (e) => e.code === 'PARSE_ERROR');
  const negative = fixture('raw-first-lines.txt').replace('99.82', '-99.82');
  assert.throws(() => parseMetroText(negative), (e) => e.code === 'PARSE_ERROR');
});

test('a diesel date that differs from the petrol date throws PARSE_ERROR', () => {
  const text = fixture('raw-first-lines.txt').replace('22-Oct-26 95.20', '21-Oct-26 95.20');
  assert.throws(() => parseMetroText(text), (e) => e.code === 'PARSE_ERROR' && /diesel date/.test(e.message));
});

test('text with no rows throws PARSE_ERROR instead of returning an empty series', () => {
  assert.throws(() => parseMetroText('Table Posted: 22-Oct-26\nDelhi Mumbai'), (e) => e.code === 'PARSE_ERROR');
});

test('a missing Table Posted line gives posted null', () => {
  const body = fixture('raw-first-lines.txt').split('\n').slice(1).join('\n');
  assert.equal(parseMetroText(body).posted, null);
});

test('an impossible calendar date throws PARSE_ERROR', () => {
  const text = fixture('raw-first-lines.txt').replaceAll('22-Oct-26', '31-Nov-26');
  assert.throws(() => parseMetroText(text), (e) => e.code === 'PARSE_ERROR');
});
