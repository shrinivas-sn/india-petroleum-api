import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STALE_AFTER_DAYS, bannerFor, loadLive, offlineState, readLive, snapshotState } from './live-state.js';

const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];
const prices = (base) => Object.fromEntries(CITIES.map((c, i) => [c, base + i]));
const day = (date, base = 90) => ({ date, petrol: prices(base + 10), diesel: prices(base) });
const noMoves = () => ({ petrol: Object.fromEntries(CITIES.map((c) => [c, null])), diesel: Object.fromEntries(CITIES.map((c) => [c, null])) });

const snapshot = {
  meta: { first_date: '2017-06-16', last_date: '2026-10-21', day_count: 3415 },
  latest: day('2026-10-21'),
  last_moves: noMoves(),
};

const metaBody = (over = {}) => ({
  success: true,
  data: {
    source_url: 'https://ppac.gov.in/uploads/daily.pdf',
    source_posted_date: '2026-10-23',
    sha256: 'e6ee76b1b284ee713eca62cf30b60001acd32f50a36c933dc024350fa5c8cdc6',
    fetched_at: '2026-10-24T07:13:20.524Z',
    first_date: '2017-06-16',
    last_date: '2026-10-23',
    day_count: 3417,
    days_behind: 0,
    data_source: 'remote',
    ...over,
  },
  meta: {},
});
const latestBody = (over = {}) => ({
  success: true,
  data: day('2026-10-23'),
  meta: { count: 1, last_change: noMoves(), ...over },
});

const now = new Date('2026-10-24T03:00:00Z'); // 24 October, 08:30 in India

test('the snapshot state shows build-time data and claims nothing about freshness', () => {
  const state = snapshotState(snapshot);
  assert.equal(state.status, 'snapshot');
  assert.equal(state.meta.last_date, '2026-10-21');
  assert.equal(state.daysBehind, null);
  assert.equal(bannerFor(state), null, 'no banner before the API has answered, or the prerendered page would carry one');
});

test('readLive takes the API answers, the server days_behind and the last changes', () => {
  const state = readLive(metaBody({ days_behind: 1 }), latestBody(), now);
  assert.equal(state.status, 'live');
  assert.equal(state.meta.last_date, '2026-10-23');
  assert.equal(state.latest.date, '2026-10-23');
  assert.equal(state.daysBehind, 1);
  assert.equal(state.checkedAt, now.toISOString());
  assert.deepEqual(state.lastMoves, noMoves());
});

test('readLive keeps going without last_change (an older API) and marks it unknown', () => {
  const state = readLive(metaBody(), { success: true, data: day('2026-10-23'), meta: { count: 1 } }, now);
  assert.equal(state.lastMoves, null);
});

test('readLive refuses answers of the wrong shape instead of rendering NaN', () => {
  assert.throws(() => readLive({ success: true, data: {} }, latestBody(), now), /meta/i);
  assert.throws(() => readLive(metaBody({ last_date: 'soon' }), latestBody(), now), /meta/i);
  assert.throws(() => readLive(metaBody({ days_behind: 'many' }), latestBody(), now), /meta/i);
  assert.throws(() => readLive(metaBody(), { success: true, data: { date: '2026-10-23' } }, now), /latest/i);
  const broken = day('2026-10-23');
  broken.diesel.kolkata = '99.1';
  assert.throws(() => readLive(metaBody(), { success: true, data: broken, meta: {} }, now), /latest/i);
  assert.throws(() => readLive(null, latestBody(), now), /meta/i);
});

test('readLive refuses meta the status page could not show safely: no javascript: link, a text sha256', () => {
  for (const url of ['javascript:alert(1)', 'http://ppac.gov.in/x.pdf', 'data:text/html,hi', '//ppac.gov.in/x.pdf', 42, undefined]) {
    assert.throws(() => readLive(metaBody({ source_url: url }), latestBody(), now), /meta/i, String(url));
  }
  for (const sha of [undefined, 42, '', 'a'.repeat(300), '<script>']) {
    assert.throws(() => readLive(metaBody({ sha256: sha }), latestBody(), now), /meta/i, String(sha));
  }
  assert.throws(() => readLive(metaBody({ fetched_at: undefined }), latestBody(), now), /meta/i);
  assert.throws(() => readLive(metaBody({ source_posted_date: 'soon' }), latestBody(), now), /meta/i);
});

test('loadLive asks for meta and the newest day, and returns a live state', async () => {
  const asked = [];
  const get = async (path) => {
    asked.push(path);
    return { body: path === '/v1/meta' ? metaBody() : latestBody(), status: 200, ms: 5 };
  };
  const state = await loadLive(get, { now });
  assert.deepEqual(asked.sort(), ['/v1/meta', '/v1/prices/latest']);
  assert.equal(state.status, 'live');
});

test('loadLive fails when either call fails', async () => {
  const get = async (path) => {
    if (path === '/v1/meta') throw new Error('Could not reach the API.');
    return { body: latestBody(), status: 200, ms: 5 };
  };
  await assert.rejects(loadLive(get, { now }), /Could not reach/);
});

test('offlineState keeps the snapshot figures, records why, and counts days from the snapshot date', () => {
  const state = offlineState(snapshotState(snapshot), 'Could not reach the API.', now);
  assert.equal(state.status, 'offline');
  assert.equal(state.meta.last_date, '2026-10-21');
  assert.equal(state.error, 'Could not reach the API.');
  assert.equal(state.daysBehind, 3);
});

test('a live state within the limit has no banner, one past it does', () => {
  assert.equal(STALE_AFTER_DAYS, 2);
  assert.equal(bannerFor(readLive(metaBody({ days_behind: 0 }), latestBody(), now)), null);
  assert.equal(bannerFor(readLive(metaBody({ days_behind: 2 }), latestBody(), now)), null, 'two days is normal around a weekend');
  const banner = bannerFor(readLive(metaBody({ days_behind: 3, last_date: '2026-10-21' }), latestBody(), now));
  assert.equal(banner.kind, 'stale');
  assert.equal(banner.title, 'Prices are behind.');
  assert.match(banner.message, /21 Oct 2026/);
  assert.match(banner.message, /3 days/);
  assert.equal(banner.retry, false);
});

test('an offline state says the figures are from the build and offers a retry', () => {
  const banner = bannerFor(offlineState(snapshotState(snapshot), 'Could not reach the API.', now));
  assert.equal(banner.kind, 'offline');
  assert.equal(banner.title, 'Live data unavailable.');
  assert.match(banner.message, /21 Oct 2026/);
  assert.match(banner.message, /last build/i);
  assert.match(banner.message, /3 days/, 'a build three days old is also stale');
  assert.equal(banner.detail, 'Could not reach the API.');
  assert.equal(banner.retry, true);
});

test('an offline state within the limit does not claim the data is old', () => {
  const recent = { ...snapshot, meta: { ...snapshot.meta, last_date: '2026-10-23' } };
  const banner = bannerFor(offlineState(snapshotState(recent), 'Could not reach the API.', now));
  assert.equal(banner.kind, 'offline');
  assert.doesNotMatch(banner.message, /days ago/);
});
