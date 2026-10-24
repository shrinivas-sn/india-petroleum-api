import { test } from 'node:test';
import assert from 'node:assert/strict';
import { examplePaths } from './example-paths.mjs';

const meta = (last) => ({ first_date: '2017-06-16', last_date: last });
const query = (path) => Object.fromEntries(new URL(path, 'https://example.test').searchParams);

test('every example window ends on the newest stored day', () => {
  const paths = examplePaths(meta('2026-10-23'));
  for (const key of ['range', 'changes', 'playground', 'recent', 'board', 'unknownFuel']) {
    assert.equal(query(paths[key]).to, '2026-10-23', key);
  }
});

test('the docs examples cover 7 days, 365 days of changes and 5 days; the playground 30 days; the chart 3 months', () => {
  const paths = examplePaths(meta('2026-10-23'));
  assert.equal(query(paths.range).from, '2026-10-17');
  assert.equal(query(paths.changes).from, '2025-10-24');
  assert.equal(query(paths.unknownFuel).from, '2026-10-19');
  assert.equal(query(paths.playground).from, '2026-09-24');
  assert.equal(query(paths.recent).from, '2026-07-23');
  assert.equal(query(paths.board).from, '2026-09-23', 'the board needs 30 days back from the newest day, so 31 days');
  assert.equal(query(paths.board).city, undefined, 'the board covers every city');
});

test('the examples follow the data: a later newest day moves every window', () => {
  const a = examplePaths(meta('2026-10-23'));
  const b = examplePaths(meta('2026-11-02'));
  for (const key of ['range', 'changes', 'playground', 'recent', 'board']) assert.notEqual(a[key], b[key], key);
  assert.equal(a.latest, b.latest);
});

test('no example hardcodes a calendar date', () => {
  const source = JSON.stringify(examplePaths(meta('2031-01-09')));
  assert.doesNotMatch(source, /2022|2026/, 'a date from another year leaked in');
});
