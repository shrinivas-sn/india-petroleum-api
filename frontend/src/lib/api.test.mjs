import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, apiGet, pricesPath } from './api.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const answer = ({ ok = true, status = 200, headers = {}, json }) => ({
  ok,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json,
});

test('a success answer comes back with its body and timing', async () => {
  globalThis.fetch = async () => answer({ json: async () => ({ success: true, data: [1] }) });
  const result = await apiGet('/v1/cities');
  assert.deepEqual(result.body, { success: true, data: [1] });
  assert.equal(result.status, 200);
  assert.equal(typeof result.ms, 'number');
});

test('an abort that lands while the body is still arriving is rethrown as an abort, not as an API error', async () => {
  globalThis.fetch = async () =>
    answer({
      json: async () => {
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      },
    });
  await assert.rejects(apiGet('/v1/prices?from=2017-06-16&to=2026-10-23'), (e) => e.name === 'AbortError');
});

test('an error envelope becomes an ApiError with the server code, message and Retry-After', async () => {
  globalThis.fetch = async () =>
    answer({
      ok: false,
      status: 429,
      headers: { 'retry-after': '120' },
      json: async () => ({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }),
    });
  await assert.rejects(apiGet('/v1/cities'), (e) => {
    assert.ok(e instanceof ApiError);
    assert.deepEqual([e.status, e.code, e.message, e.retryAfterSeconds], [429, 'RATE_LIMITED', 'Too many requests.', 120]);
    return true;
  });
});

test('a non-JSON failure becomes an ApiError that names the status', async () => {
  globalThis.fetch = async () =>
    answer({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
  await assert.rejects(apiGet('/v1/cities'), (e) => e instanceof ApiError && e.status === 502 && /502/.test(e.message));
});

test('a network failure becomes NETWORK_ERROR, and an abort stays an abort', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(apiGet('/v1/cities'), (e) => e instanceof ApiError && e.code === 'NETWORK_ERROR');
  globalThis.fetch = async () => {
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  };
  await assert.rejects(apiGet('/v1/cities'), (e) => e.name === 'AbortError');
});

test('pricesPath leaves out empty fields and encodes the rest', () => {
  assert.equal(pricesPath({ city: '', fuel: '', from: '2022-05-15', to: '2022-05-29' }), '/v1/prices?from=2022-05-15&to=2022-05-29');
  assert.equal(pricesPath({ city: 'delhi', fuel: 'petrol', from: '2021-01-01', to: '2021-12-31' }), '/v1/prices?city=delhi&fuel=petrol&from=2021-01-01&to=2021-12-31');
});
