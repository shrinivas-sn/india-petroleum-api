import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { FuelService } from '../src/fuel-service.js';

const dataDir = fileURLToPath(new URL('./fixtures/fuel', import.meta.url));
const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];

let server;
let baseUrl;
const listen = (app) =>
  new Promise((resolve) => {
    const s = http.createServer(app);
    s.listen(0, () => resolve({ s, url: `http://127.0.0.1:${s.address().port}` }));
  });

test.before(async () => {
  const { app } = createApp({ dataDir, rateLimit: false });
  ({ s: server, url: baseUrl } = await listen(app));
});
test.after(() => new Promise((resolve) => server.close(resolve)));

async function get(path, url = baseUrl) {
  const res = await fetch(`${url}${path}`);
  return { status: res.status, headers: res.headers, body: await res.json() };
}

function assertMeta(body) {
  assert.equal(body.success, true);
  assert.match(body.meta.attribution, /Petroleum Planning & Analysis Cell \(PPAC\)/);
  assert.equal(body.meta.source_posted_date, '2026-10-23');
  assert.match(body.meta.latest_fetched_at, /^2026-10-24T/);
}

test('latest returns the newest day with 4 cities for both fuels and the attribution', async () => {
  const { status, body } = await get('/v1/prices/latest');
  assert.equal(status, 200);
  assertMeta(body);
  assert.equal(body.data.date, '2026-06-05');
  assert.deepEqual(Object.keys(body.data.petrol), CITIES);
  assert.deepEqual(Object.keys(body.data.diesel), CITIES);
  assert.equal(body.data.petrol.delhi, 102.12);
});

test('a range query returns exactly the days in range, oldest first', async () => {
  const { status, body } = await get('/v1/prices?from=2026-05-20&to=2026-05-25');
  assert.equal(status, 200);
  assertMeta(body);
  assert.deepEqual(body.data.map((d) => d.date), [
    '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25',
  ]);
  assert.equal(body.meta.count, 6);
  assert.equal(body.data[3].petrol.delhi, 99.51);
  assert.equal(body.data[5].petrol.delhi, 102.12);
});

test('city and fuel filters keep only that series', async () => {
  const one = await get('/v1/prices?city=delhi&fuel=petrol&from=2026-05-22&to=2026-05-23');
  assert.deepEqual(one.body.data, [
    { date: '2026-05-22', petrol: { delhi: 98.64 } },
    { date: '2026-05-23', petrol: { delhi: 99.51 } },
  ]);
  const city = await get('/v1/prices?city=mumbai&from=2026-05-23&to=2026-05-23');
  assert.deepEqual(Object.keys(city.body.data[0].petrol), ['mumbai']);
  assert.deepEqual(Object.keys(city.body.data[0].diesel), ['mumbai']);
  const fuel = await get('/v1/prices?fuel=diesel&from=2026-05-23&to=2026-05-23');
  assert.equal(fuel.body.data[0].petrol, undefined);
  assert.deepEqual(Object.keys(fuel.body.data[0].diesel), CITIES);
});

test('an unknown fuel or city is a 404 that lists the valid values', async () => {
  const fuel = await get('/v1/prices?fuel=kerosene&from=2026-05-20&to=2026-05-25');
  assert.equal(fuel.status, 404);
  assert.equal(fuel.body.success, false);
  assert.equal(fuel.body.error.code, 'UNKNOWN_FUEL');
  assert.deepEqual(fuel.body.error.valid_values, ['petrol', 'diesel']);
  assert.match(fuel.body.error.message, /petrol, diesel/);
  const city = await get('/v1/prices?city=pune&from=2026-05-20&to=2026-05-25');
  assert.equal(city.status, 404);
  assert.deepEqual(city.body.error.valid_values, CITIES);
});

test('from and to are required', async () => {
  for (const q of ['to=2026-05-25', 'from=2026-05-20', '']) {
    const { status, body } = await get(`/v1/prices?${q}`);
    assert.equal(status, 400, q);
    assert.equal(body.error.code, 'MISSING_PARAM');
  }
});

test('a date that is not a real YYYY-MM-DD day is INVALID_DATE', async () => {
  for (const q of ['from=2026-02-30&to=2026-05-25', 'from=yesterday&to=2026-05-25', 'from=2026-05-20&from=2026-05-21&to=2026-05-25', 'from=2026-5-2&to=2026-05-25']) {
    const { status, body } = await get(`/v1/prices?${q}`);
    assert.equal(status, 400, q);
    assert.equal(body.error.code, 'INVALID_DATE', q);
  }
});

test('from after to is INVALID_RANGE', async () => {
  const { status, body } = await get('/v1/prices?from=2026-05-25&to=2026-05-20');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'INVALID_RANGE');
});

test('a range over 3660 days is RANGE_TOO_LARGE', async () => {
  const { status, body } = await get('/v1/prices?from=2016-01-01&to=2026-06-05');
  assert.equal(status, 400);
  assert.equal(body.error.code, 'RANGE_TOO_LARGE');
  const ok = await get('/v1/prices?from=2016-06-06&to=2026-06-05');
  assert.equal(ok.status, 200);
});

test('a range outside the data returns an empty list with the coverage', async () => {
  const { status, body } = await get('/v1/prices?from=2020-01-01&to=2020-01-31');
  assert.equal(status, 200);
  assert.deepEqual(body.data, []);
  assert.equal(body.meta.count, 0);
  assert.deepEqual(body.meta.coverage, { first_date: '2026-05-15', last_date: '2026-06-05' });
});

test('changes lists the price moves in the window, filtered by city and fuel', async () => {
  const { status, body } = await get('/v1/prices/changes?city=delhi&fuel=petrol&from=2026-05-15&to=2026-06-05');
  assert.equal(status, 200);
  assertMeta(body);
  assert.deepEqual(body.data, [
    { date: '2026-05-15', fuel: 'petrol', city: 'delhi', from: 94.77, to: 97.77 },
    { date: '2026-05-19', fuel: 'petrol', city: 'delhi', from: 97.77, to: 98.64 },
    { date: '2026-05-23', fuel: 'petrol', city: 'delhi', from: 98.64, to: 99.51 },
    { date: '2026-05-25', fuel: 'petrol', city: 'delhi', from: 99.51, to: 102.12 },
  ]);
});

test('changes without dates defaults to the last 365 days and says so', async () => {
  const { status, body } = await get('/v1/prices/changes');
  assert.equal(status, 200);
  assert.equal(body.meta.window_defaulted, true);
  assert.equal(body.meta.to, '2026-06-05');
  assert.equal(body.meta.from, '2025-06-05');
  assert.equal(body.data.length, 32);
});

test('cities lists the four metros', async () => {
  const { body } = await get('/v1/cities');
  assertMeta(body);
  assert.deepEqual(body.data.map((c) => c.slug), CITIES);
  assert.equal(body.data[0].name, 'Delhi');
});

test('meta serves the provenance and how far behind the data is', async () => {
  const { body } = await get('/v1/meta');
  assertMeta(body);
  assert.equal(body.data.source, 'PPAC');
  assert.equal(body.data.day_count, 22);
  assert.equal(body.data.first_date, '2026-05-15');
  assert.equal(typeof body.data.days_behind, 'number');
  assert.deepEqual(body.data.fuels, ['petrol', 'diesel']);
});

test('health answers 200 with basic info and the endpoint list', async () => {
  const { status, body } = await get('/health');
  assert.equal(status, 200);
  assertMeta(body);
  assert.equal(body.data.status, 'operational');
  assert.ok(body.data.endpoints.includes('GET /v1/prices/latest'));
});

test('unknown paths are JSON 404s', async () => {
  for (const path of ['/v1/nope', '/elsewhere']) {
    const { status, body } = await get(path);
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  }
});

test('CORS allows every origin, including the preflight', async () => {
  const res = await get('/v1/prices/latest');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const pre = await fetch(`${baseUrl}/v1/prices/latest`, {
    method: 'OPTIONS',
    headers: { origin: 'https://example.org', 'access-control-request-method': 'GET' },
  });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
});

test('an unexpected error becomes a JSON 500 without a stack', async () => {
  const broken = new FuelService({ dataDir });
  broken.latest = () => { throw new Error('boom at /secret/path'); };
  const { app } = createApp({ fuelService: broken, rateLimit: false, quiet: true });
  const { s, url } = await listen(app);
  try {
    const res = await fetch(`${url}/v1/prices/latest`);
    assert.equal(res.status, 500);
    assert.match(res.headers.get('content-type'), /json/);
    const body = await res.json();
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(body), /secret|boom|at /);
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test('the rate limit answers 429 in the error envelope', async () => {
  const { app } = createApp({ dataDir, rateLimitMax: 2 });
  const { s, url } = await listen(app);
  try {
    await get('/v1/cities', url);
    await get('/v1/cities', url);
    const third = await get('/v1/cities', url);
    assert.equal(third.status, 429);
    assert.equal(third.body.error.code, 'RATE_LIMITED');
    assert.equal(third.headers.get('ratelimit'), null);
  } finally {
    await new Promise((r) => s.close(r));
  }
});

test('the service refuses a data folder that is missing', () => {
  assert.throws(() => new FuelService({ dataDir: '/definitely/not/here' }), /daily\.json/);
});
