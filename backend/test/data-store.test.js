// The API serves the newest committed data without a redeploy: it fetches the three data files from the
// repository at run time, validates them, and swaps them in only if they are good. Everything here runs
// against a fake remote; no test touches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { DataStore } from '../src/data-store.js';
import { FuelService } from '../src/fuel-service.js';

const dataDir = fileURLToPath(new URL('./fixtures/fuel', import.meta.url));
const read = (name) => JSON.parse(readFileSync(`${dataDir}/${name}`, 'utf8'));
const BASE = 'https://raw.example/data/fuel';

/** The fixture data plus `extra` further days (one price step on the first new day). */
function dataset(extra = 0) {
  const days = structuredClone(read('daily.json').days);
  const moves = structuredClone(read('changes.json').changes);
  const meta = structuredClone(read('meta.json'));
  for (let i = 1; i <= extra; i += 1) {
    const last = days.at(-1);
    const date = new Date(Date.parse(`${last.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const next = structuredClone(last);
    next.date = date;
    if (i === 1) {
      next.petrol.delhi = Number((last.petrol.delhi + 1.5).toFixed(2));
      moves.push({ date, fuel: 'petrol', city: 'delhi', from: last.petrol.delhi, to: next.petrol.delhi });
    }
    days.push(next);
  }
  Object.assign(meta, {
    last_date: days.at(-1).date,
    day_count: days.length,
    fetched_at: `2026-11-0${extra + 1}T07:00:00.000Z`,
    sha256: `sha-${extra}`,
  });
  return { days, moves, meta };
}

/** A fake of the raw file host. `data` can be replaced between calls; every request is recorded. */
function fakeRemote(initial) {
  const state = { data: initial, calls: [], fail: null, etagOf: { 'meta.json': 1, 'daily.json': 1, 'changes.json': 1 } };
  const bodyOf = (name) => {
    if (name === 'meta.json') return state.data.meta;
    if (name === 'daily.json') return { days: state.data.days };
    return { changes: state.data.moves };
  };
  state.fetchFn = async (url, options = {}) => {
    const name = url.split('/').pop();
    state.calls.push({ name, ifNoneMatch: options.headers?.['If-None-Match'] ?? null });
    if (state.fail) return state.fail(name);
    const etag = `"${name}-${state.etagOf[name]}"`;
    if (options.headers?.['If-None-Match'] === etag) return { status: 304, ok: false, headers: { get: () => null }, text: async () => '' };
    const text = JSON.stringify(bodyOf(name));
    return {
      status: 200,
      ok: true,
      headers: { get: (h) => ({ etag, 'content-length': String(text.length) })[h.toLowerCase()] ?? null },
      text: async () => text,
    };
  };
  state.bump = (data) => {
    state.data = data;
    for (const k of Object.keys(state.etagOf)) state.etagOf[k] += 1;
  };
  state.callsFor = (name) => state.calls.filter((c) => c.name === name).length;
  return state;
}

function storeWith(remoteState, over = {}) {
  const service = new FuelService({ dataDir });
  let t = 1_000_000;
  const clock = { advance: (ms) => { t += ms; }, now: () => t };
  const store = new DataStore({
    service,
    remote: { baseUrl: BASE, fetchFn: remoteState.fetchFn, now: clock.now, ttlMs: 600_000, timeoutMs: 1000, deadlineMs: 1000, ...over },
  });
  return { service, store, clock };
}

const down = (status) => () => ({ status, ok: false, headers: { get: () => null }, text: async () => 'down' });

test('with no remote configured the store serves the bundled data and never fetches', async () => {
  const remote = fakeRemote(dataset(3));
  const service = new FuelService({ dataDir });
  const store = new DataStore({ service, remote: null });
  await store.ensureFresh();
  assert.equal(remote.calls.length, 0);
  assert.equal(service.meta.last_date, '2026-06-05');
  assert.deepEqual(store.status(), { data_source: 'bundled', checked_at: null, refresh_error: null });
});

test('a newer remote dataset replaces the bundled one and the status says so', async () => {
  const remote = fakeRemote(dataset(3));
  const { service, store } = storeWith(remote);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-08');
  assert.equal(service.latest().date, '2026-06-08');
  assert.equal(service.days.length, 25);
  const status = store.status();
  assert.equal(status.data_source, 'remote');
  assert.equal(status.refresh_error, null);
  assert.ok(status.checked_at);
});

test('within the TTL nothing is fetched again; after it the meta file is checked with its ETag', async () => {
  const remote = fakeRemote(dataset(2));
  const { store, clock } = storeWith(remote);
  await store.ensureFresh();
  const first = remote.calls.length;
  clock.advance(60_000);
  await store.ensureFresh();
  assert.equal(remote.calls.length, first, 'inside the TTL');
  clock.advance(600_000);
  await store.ensureFresh();
  assert.equal(remote.callsFor('meta.json'), 2);
  assert.equal(remote.calls.filter((c) => c.name === 'meta.json').at(-1).ifNoneMatch, '"meta.json-1"');
  assert.equal(remote.callsFor('daily.json'), 1, 'an unchanged meta file means the big files are not fetched again');
});

test('a changed remote is picked up on the next check', async () => {
  const remote = fakeRemote(dataset(1));
  const { service, store, clock } = storeWith(remote);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-06');
  remote.bump(dataset(4));
  clock.advance(601_000);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-09');
  assert.equal(service.latest().petrol.delhi, dataset(4).days.at(-1).petrol.delhi);
});

test('a failed fetch keeps the last good data, records why, and retries sooner than the TTL', async () => {
  const remote = fakeRemote(dataset(2));
  const { service, store, clock } = storeWith(remote);
  await store.ensureFresh();
  remote.bump(dataset(4));
  remote.fail = down(503);
  clock.advance(601_000);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-07', 'still the last good data');
  assert.match(store.status().refresh_error, /503/);
  assert.equal(store.status().data_source, 'remote', 'the data in memory is still the remote copy');
  remote.fail = null;
  clock.advance(61_000);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-09', 'recovered after a minute, not after ten');
  assert.equal(store.status().refresh_error, null);
});

test('malformed JSON, a network error and a 404 never change the data', async () => {
  const cases = [
    ['malformed', () => ({ status: 200, ok: true, headers: { get: () => null }, text: async () => '{not json' }), /JSON/],
    ['network', () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } }); }, /fetch failed/],
    ['not found', down(404), /404/],
  ];
  for (const [label, failure, pattern] of cases) {
    const remote = fakeRemote(dataset(3));
    remote.fail = failure;
    const { service, store } = storeWith(remote);
    await store.ensureFresh();
    assert.equal(service.meta.last_date, '2026-06-05', label);
    assert.match(store.status().refresh_error, pattern, label);
    assert.equal(store.status().data_source, 'bundled', label);
  }
});

test('a remote that is older than what the API already holds is rejected', async () => {
  const remote = fakeRemote(dataset(5));
  const { service, store, clock } = storeWith(remote);
  await store.ensureFresh();
  remote.bump(dataset(1));
  clock.advance(601_000);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-10');
  assert.match(store.status().refresh_error, /older/);
});

test('invalid datasets are rejected: a gap, a bad date, a bad price, a meta that disagrees, a missing city', async () => {
  const breakers = {
    gap: (d) => { d.days.splice(10, 1); d.meta.day_count -= 1; },
    'bad date': (d) => { d.days[5].date = '2026-02-30'; },
    'zero price': (d) => { d.days[5].petrol.delhi = 0; },
    'text price': (d) => { d.days[5].diesel.mumbai = 'abc'; },
    'missing city': (d) => { delete d.days[5].petrol.kolkata; },
    'meta count': (d) => { d.meta.day_count += 1; },
    'meta last date': (d) => { d.meta.last_date = '2030-01-01'; },
    'unknown fuel in a move': (d) => { d.moves[0].fuel = 'kerosene'; },
    'move after the last day': (d) => { d.moves.push({ date: '2099-01-01', fuel: 'petrol', city: 'delhi', from: 1, to: 2 }); },
    'empty days': (d) => { d.days = []; d.meta.day_count = 0; },
  };
  for (const [label, breakIt] of Object.entries(breakers)) {
    const data = dataset(3);
    breakIt(data);
    const remote = fakeRemote(data);
    const { service, store } = storeWith(remote);
    await store.ensureFresh();
    assert.equal(service.meta.last_date, '2026-06-05', `${label}: data must not change`);
    assert.ok(store.status().refresh_error, `${label}: a reason is recorded`);
  }
});

test('the three files must agree: a daily file newer than its meta (a race between cached copies) is rejected and retried soon', async () => {
  const remote = fakeRemote(dataset(3));
  const mismatched = dataset(3);
  mismatched.meta = dataset(1).meta;
  remote.data = mismatched;
  const { service, store, clock } = storeWith(remote);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-05');
  assert.match(store.status().refresh_error, /disagree|meta/);
  remote.data = dataset(3);
  clock.advance(61_000);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-08');
});

test('an oversized response is refused before it is parsed', async () => {
  const remote = fakeRemote(dataset(3));
  const original = remote.fetchFn;
  remote.fetchFn = async (url, options) => {
    const res = await original(url, options);
    if (!url.endsWith('daily.json')) return res;
    return { ...res, headers: { get: (h) => (h.toLowerCase() === 'content-length' ? String(50 * 1024 * 1024) : res.headers.get(h)) } };
  };
  const { service, store } = storeWith(remote);
  await store.ensureFresh();
  assert.equal(service.meta.last_date, '2026-06-05');
  assert.match(store.status().refresh_error, /too large|size/);
});

test('concurrent requests share one refresh', async () => {
  const remote = fakeRemote(dataset(3));
  const { store } = storeWith(remote);
  await Promise.all([store.ensureFresh(), store.ensureFresh(), store.ensureFresh(), store.ensureFresh()]);
  assert.equal(remote.callsFor('meta.json'), 1);
  assert.equal(remote.callsFor('daily.json'), 1);
});

test('a remote that hangs cannot hold a request longer than the deadline', async () => {
  const remote = fakeRemote(dataset(3));
  remote.fetchFn = () => new Promise(() => {});
  const { service, store } = storeWith(remote, { deadlineMs: 50, timeoutMs: 5000 });
  const started = Date.now();
  await store.ensureFresh();
  assert.ok(Date.now() - started < 500, 'returned within the deadline');
  assert.equal(service.meta.last_date, '2026-06-05');
});

test('the service reports the last change of every price', () => {
  const service = new FuelService({ dataDir });
  const last = service.lastChanges();
  assert.deepEqual(Object.keys(last), ['petrol', 'diesel']);
  assert.deepEqual(Object.keys(last.petrol), ['delhi', 'mumbai', 'chennai', 'kolkata']);
  const real = read('changes.json').changes.filter((m) => m.fuel === 'petrol' && m.city === 'delhi').at(-1);
  assert.deepEqual(last.petrol.delhi, { date: real.date, from: real.from, to: real.to });
});

test('a price that never changed in the data has no last change', () => {
  const service = new FuelService({ dataDir });
  service.load({ ...dataset(0), moves: [] });
  assert.equal(service.lastChanges().petrol.delhi, null);
});

// ---- through the HTTP app ----
async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const remoteOptions = (remote) => ({ baseUrl: BASE, fetchFn: remote.fetchFn, ttlMs: 600_000, timeoutMs: 1000, deadlineMs: 1000 });

test('through the app: a newer remote day shows up in /v1/prices/latest, /v1/meta and /health without a redeploy', async () => {
  const remote = fakeRemote(dataset(3));
  const { app } = createApp({ dataDir, rateLimit: false, quiet: true, remote: remoteOptions(remote) });
  const { server, url } = await listen(app);
  try {
    const latest = await (await fetch(`${url}/v1/prices/latest`)).json();
    assert.equal(latest.data.date, '2026-06-08');
    assert.deepEqual(Object.keys(latest.meta.last_change.petrol), ['delhi', 'mumbai', 'chennai', 'kolkata']);
    const meta = await (await fetch(`${url}/v1/meta`)).json();
    assert.equal(meta.data.data_source, 'remote');
    assert.equal(meta.data.last_date, '2026-06-08');
    assert.equal(meta.data.refresh_error, null);
    const health = await (await fetch(`${url}/health`)).json();
    assert.equal(health.data.coverage.last_date, '2026-06-08');
    assert.equal(health.data.data_source, 'remote');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('through the app: when the remote is down the API still answers from its last good data and /v1/meta says why', async () => {
  const remote = fakeRemote(dataset(3));
  remote.fail = () => { throw new Error('fetch failed'); };
  const { app } = createApp({ dataDir, rateLimit: false, quiet: true, remote: remoteOptions(remote) });
  const { server, url } = await listen(app);
  try {
    const res = await fetch(`${url}/v1/prices/latest`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.date, '2026-06-05');
    const meta = (await (await fetch(`${url}/v1/meta`)).json()).data;
    assert.equal(meta.data_source, 'bundled');
    assert.match(meta.refresh_error, /fetch failed/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
