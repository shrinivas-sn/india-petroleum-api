// The API's second lock on the data it reads from the repository at run time (the first is ingest). Each
// test names one way a bad or merely stale dataset could get through; a good one must still pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatasetError, validateDataset } from '../src/dataset.js';

const read = (dir, name) => JSON.parse(readFileSync(fileURLToPath(new URL(`${dir}/${name}`, import.meta.url)), 'utf8'));
const load = (dir) => ({ days: read(dir, 'daily.json').days, moves: read(dir, 'changes.json').changes, meta: read(dir, 'meta.json') });
const fixture = () => structuredClone(load('./fixtures/fuel'));
const bundled = () => structuredClone(load('../../data/fuel'));
const NOW = new Date('2026-06-06T05:00:00Z'); // the fixture ends 2026-06-05

const rejects = (dataset, pattern, options = {}) =>
  assert.throws(() => validateDataset(dataset, { now: NOW, ...options }), (error) => error instanceof DatasetError && pattern.test(error.message), String(pattern));

/** Keeps meta in step after days were changed. */
const resync = (d) => {
  d.meta.first_date = d.days[0].date;
  d.meta.last_date = d.days.at(-1).date;
  d.meta.day_count = d.days.length;
  return d;
};

test('the fixture and the real stored data both pass, so the checks below are not rejecting everything', () => {
  assert.doesNotThrow(() => validateDataset(fixture(), { now: NOW }));
  // The stored data grows every day, so it is checked against the real clock, not a fixed date.
  assert.doesNotThrow(() => validateDataset(bundled()));
});

test('a dataset that ends in the future is refused, so one bad file cannot lock out every real one', () => {
  const d = fixture();
  for (let i = 0; i < 400; i += 1) {
    const last = d.days.at(-1);
    const next = structuredClone(last);
    next.date = new Date(Date.parse(`${last.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    d.days.push(next);
  }
  resync(d);
  rejects(d, /future/i);
});

test('a day or two ahead of today in India is allowed, three is not', () => {
  const d = fixture(); // newest day 2026-06-05
  assert.doesNotThrow(() => validateDataset(d, { now: new Date('2026-06-03T05:00:00Z') }), 'two days ahead');
  rejects(d, /future/i, { now: new Date('2026-06-02T05:00:00Z') });
});

test('the same IST calendar day decides: 18:30 UTC is already the next day in India', () => {
  const d = fixture();
  assert.doesNotThrow(() => validateDataset(d, { now: new Date('2026-06-02T18:30:00Z') }), 'IST 2026-06-03, two days ahead');
  rejects(d, /future/i, { now: new Date('2026-06-02T18:29:00Z') });
});

test('a dataset that starts later than the loaded one (history cut off) is refused', () => {
  const d = fixture();
  const current = structuredClone(d.meta);
  d.days = d.days.slice(5);
  d.moves = d.moves.filter((m) => m.date > d.days[0].date);
  resync(d);
  rejects(d, /starts (later|after)|fewer days/i, { current });
});

test('a dataset with fewer days than the loaded one is refused even if it ends later', () => {
  const d = fixture();
  const current = { ...d.meta, day_count: d.meta.day_count + 10, first_date: d.meta.first_date };
  rejects(d, /fewer days/i, { current });
});

test('a longer dataset that extends the loaded one is accepted', () => {
  const d = fixture();
  const current = { ...d.meta, last_date: '2026-06-04', day_count: d.meta.day_count - 1 };
  assert.doesNotThrow(() => validateDataset(d, { now: NOW, current }));
});

test('changes.json that lacks the newest move is refused: it is stale next to daily.json', () => {
  const d = fixture();
  const last = d.days.at(-1);
  const next = structuredClone(last);
  next.date = '2026-06-06';
  next.petrol.delhi = Number((last.petrol.delhi + 1).toFixed(2));
  d.days.push(next);
  resync(d); // a new day with a price step, but the moves list was not updated
  rejects(d, /changes\.json.*(daily\.json|newest|missing)|move.*missing/i, { now: new Date('2026-06-07T05:00:00Z') });
});

test('a move that no pair of days supports is refused', () => {
  const invented = fixture();
  invented.moves.push({ date: '2026-06-02', fuel: 'diesel', city: 'delhi', from: 95.2, to: 96.2 });
  invented.moves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  rejects(invented, /changes\.json/i);
  const wrongPrice = fixture();
  wrongPrice.moves[wrongPrice.moves.length - 1].to += 1;
  rejects(wrongPrice, /changes\.json/i);
});

test('a duplicated move is refused', () => {
  const d = fixture();
  d.moves.push(structuredClone(d.moves.at(-1)));
  rejects(d, /changes\.json/i);
});

test('moves out of date order are refused: "last change" relies on the order', () => {
  const d = fixture();
  const end = d.moves.length - 1;
  [d.moves[0], d.moves[end]] = [d.moves[end], d.moves[0]];
  rejects(d, /order/i);
});

test('a move on the first stored day must end at that day\'s price', () => {
  const d = fixture();
  assert.equal(d.moves[0].date, d.days[0].date, 'the fixture has first-day moves');
  d.moves[0].to += 5;
  rejects(d, /changes\.json/i);
});

test('the returned meta keeps only the known fields, as plain values', () => {
  const d = fixture();
  d.meta.evil = '<img src=x onerror=alert(1)>';
  d.meta.nested = { a: 1 };
  const clean = validateDataset(d, { now: NOW });
  assert.deepEqual(Object.keys(clean.meta).sort(), ['attribution', 'day_count', 'fetched_at', 'first_date', 'last_date', 'sha256', 'source', 'source_posted_date', 'source_url']);
  assert.equal(clean.days, d.days);
  assert.equal(clean.moves, d.moves);
});

test('a source_url that is not https is refused (a javascript: link would reach the status page)', () => {
  for (const url of ['javascript:alert(1)', 'http://ppac.gov.in/x.pdf', 'data:text/html,hi', '//ppac.gov.in/x.pdf', 42, null, 'https://']) {
    const d = fixture();
    d.meta.source_url = url;
    rejects(d, /source_url/i);
  }
});

test('meta strings must be the right kind and size', () => {
  const cases = [
    ['sha256', '<script>', /sha256/i],
    ['sha256', undefined, /sha256/i],
    ['sha256', 'a'.repeat(200), /sha256/i],
    ['attribution', 'x'.repeat(2000), /attribution/i],
    ['attribution', 5, /attribution/i],
    ['source', { a: 1 }, /source\b/i],
    ['source_posted_date', 'yesterday', /source_posted_date/i],
    ['fetched_at', 'not a time', /fetched_at/i],
    ['fetched_at', 'x'.repeat(500), /fetched_at/i],
  ];
  for (const [key, value, pattern] of cases) {
    const d = fixture();
    if (value === undefined) delete d.meta[key];
    else d.meta[key] = value;
    rejects(d, pattern);
  }
});

test('an error never repeats long text from the file: refresh_error is public', () => {
  const d = fixture();
  d.meta.first_date = 'x'.repeat(5000);
  try {
    validateDataset(d, { now: NOW });
    assert.fail('should have been refused');
  } catch (error) {
    assert.ok(error instanceof DatasetError);
    assert.ok(error.message.length < 300, `message is ${error.message.length} characters`);
    assert.doesNotMatch(error.message, /x{60}/);
  }
});
