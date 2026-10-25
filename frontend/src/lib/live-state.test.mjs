import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STALE_AFTER_DAYS, bannerFor, loadLive, offlineState, readLive, snapshotState } from './live-state.js';

const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];
const prices = (base) => Object.fromEntries(CITIES.map((c, i) => [c, base + i]));
const day = (date, base = 90) => ({ date, petrol: prices(base + 10), diesel: prices(base) });
const addDay = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** 31 daily rows ending on `last`, as /v1/prices answers for the last month. */
const monthRows = (last) => Array.from({ length: 31 }, (_, i) => day(addDay(last, i - 30)));
const pricesBody = (last = '2026-10-23') => ({ success: true, data: monthRows(last), meta: { count: 31 } });

const snapshot = {
  meta: { first_date: '2017-06-16', last_date: '2026-10-21', day_count: 3415 },
  latest: day('2026-10-21'),
  examples: { board: { body: pricesBody('2026-10-21') } },
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
  meta: { count: 1, ...over },
});

const now = new Date('2026-10-24T03:00:00Z'); // 24 October, 08:30 in India

test('the snapshot state shows build-time data and claims nothing about freshness', () => {
  const state = snapshotState(snapshot);
  assert.equal(state.status, 'snapshot');
  assert.equal(state.meta.last_date, '2026-10-21');
  assert.equal(state.daysBehind, null);
  assert.equal(state.recent.length, 31, 'the last month captured at build time comes with it');
  assert.equal(bannerFor(state), null, 'no banner before the API has answered, or the prerendered page would carry one');
});

test('a snapshot without a usable month of rows still works, with no changes to show', () => {
  assert.equal(snapshotState({ ...snapshot, examples: {} }).recent, null);
  assert.equal(snapshotState({ ...snapshot, examples: { board: { body: { success: true, data: 'nope' } } } }).recent, null);
});

test('readLive takes the API answers, the server days_behind and the last month of rows', () => {
  const state = readLive(metaBody({ days_behind: 1 }), latestBody(), now, pricesBody());
  assert.equal(state.status, 'live');
  assert.equal(state.meta.last_date, '2026-10-23');
  assert.equal(state.latest.date, '2026-10-23');
  assert.equal(state.daysBehind, 1);
  assert.equal(state.checkedAt, now.toISOString());
  assert.equal(state.recent.length, 31);
  assert.equal(state.recent.at(-1).date, '2026-10-23');
});

test('readLive without a month of rows, or with a bad one, is still live and has no changes to show', () => {
  assert.equal(readLive(metaBody(), latestBody(), now).recent, null);
  assert.equal(readLive(metaBody(), latestBody(), now, { success: true, data: [] }).recent, null);
  assert.equal(readLive(metaBody(), latestBody(), now, { success: true, data: [{ date: 'soon' }] }).recent, null);
  assert.equal(readLive(metaBody(), latestBody(), now, { success: false, error: { code: 'X' } }).recent, null);
  assert.equal(readLive(metaBody(), latestBody(), now, null).status, 'live');
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

const fakeApi = (over = {}) => {
  const asked = [];
  const get = async (path) => {
    asked.push(path);
    if (over[path]) return over[path]();
    if (path === '/v1/meta') return { body: metaBody(), status: 200, ms: 5 };
    if (path === '/v1/prices/latest') return { body: latestBody(), status: 200, ms: 5 };
    return { body: pricesBody(), status: 200, ms: 5 };
  };
  return { get, asked };
};

test('loadLive asks for meta, the newest day and the 31 days up to it, and returns a live state with the rows', async () => {
  const api = fakeApi();
  const state = await loadLive(api.get, { now });
  assert.deepEqual(api.asked.sort(), ['/v1/meta', '/v1/prices/latest', '/v1/prices?from=2026-09-23&to=2026-10-23']);
  assert.equal(state.status, 'live');
  assert.equal(state.recent.length, 31);
});

test('loadLive counts the month back from the newest day the API reports, not from today', async () => {
  const api = fakeApi({ '/v1/prices/latest': () => ({ body: { success: true, data: day('2026-10-19'), meta: {} }, status: 200, ms: 1 }) });
  await loadLive(api.get, { now });
  assert.ok(api.asked.includes('/v1/prices?from=2026-09-19&to=2026-10-19'), api.asked.join(' '));
});

test('loadLive fails when meta or the newest day fails', async () => {
  const noMeta = fakeApi({ '/v1/meta': () => { throw new Error('Could not reach the API.'); } });
  await assert.rejects(loadLive(noMeta.get, { now }), /Could not reach/);
  const noLatest = fakeApi({ '/v1/prices/latest': () => { throw new Error('Could not reach the API.'); } });
  await assert.rejects(loadLive(noLatest.get, { now }), /Could not reach/);
});

test('loadLive stays live without the changes when only the month of rows fails', async () => {
  const api = fakeApi({ '/v1/prices?from=2026-09-23&to=2026-10-23': () => { throw new Error('The API answered 503.'); } });
  const state = await loadLive(api.get, { now });
  assert.equal(state.status, 'live');
  assert.equal(state.recent, null);
  assert.equal(state.latest.date, '2026-10-23');
});

test('loadLive does not swallow an abort: a superseded load must stay cancelled', async () => {
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  const api = fakeApi({ '/v1/prices?from=2026-09-23&to=2026-10-23': () => { throw abort; } });
  await assert.rejects(loadLive(api.get, { now }), (error) => error.name === 'AbortError');
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

// --- last change of every price ------------------------------------------------------------------------------
const lastChanges = (date = '2026-05-25') =>
  Object.fromEntries(['petrol', 'diesel'].map((fuel) => [fuel, Object.fromEntries(CITIES.map((city) => [city, { date, from: 90, to: 92 }]))]));
const latestWithChanges = (last_change) => ({ success: true, data: day('2026-10-23'), meta: { count: 1, last_change } });

test('readLive keeps the date each price last changed, from the meta of /v1/prices/latest', () => {
  const state = readLive(metaBody(), latestWithChanges(lastChanges()), new Date('2026-10-24T03:00:00Z'));
  assert.equal(state.lastChange.petrol.delhi.date, '2026-05-25');
  assert.equal(state.lastChange.diesel.kolkata.date, '2026-05-25');
});

test('readLive without a usable last_change is still live, with nothing to say about how long prices held', () => {
  const now = new Date('2026-10-24T03:00:00Z');
  assert.equal(readLive(metaBody(), { success: true, data: day('2026-10-23') }, now).lastChange, null, 'no meta');
  assert.equal(readLive(metaBody(), latestWithChanges('soon'), now).lastChange, null, 'not an object');
  const bad = lastChanges();
  bad.petrol.delhi = { date: 'yesterday' };
  const state = readLive(metaBody(), latestWithChanges(bad), now);
  assert.equal(state.status, 'live');
  assert.equal(state.lastChange.petrol.delhi, null, 'the bad entry is dropped');
  assert.equal(state.lastChange.petrol.mumbai.date, '2026-05-25', 'the good ones stay');
});

test('the snapshot state reads the last changes from the stored /v1/prices/latest example', () => {
  const withExample = { ...snapshot, examples: { ...snapshot.examples, latest: { body: latestWithChanges(lastChanges('2026-05-15')) } } };
  assert.equal(snapshotState(withExample).lastChange.diesel.chennai.date, '2026-05-15');
  assert.equal(snapshotState(snapshot).lastChange, null, 'a snapshot without the example');
});

test('loadLive carries the last changes into the live state', async () => {
  const get = async (path) => {
    if (path === '/v1/meta') return { body: metaBody() };
    if (path === '/v1/prices/latest') return { body: latestWithChanges(lastChanges()) };
    return { body: pricesBody() };
  };
  assert.equal((await loadLive(get, { now: new Date('2026-10-24T03:00:00Z') })).lastChange.petrol.delhi.date, '2026-05-25');
});
