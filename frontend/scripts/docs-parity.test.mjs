// The Docs page and the backend must describe the same routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ENDPOINTS, ERRORS } from '../src/content/apiReference.js';

const appSource = fs.readFileSync(fileURLToPath(new URL('../../backend/src/app.js', import.meta.url)), 'utf8');
const serviceSource = fs.readFileSync(fileURLToPath(new URL('../../backend/src/fuel-service.js', import.meta.url)), 'utf8');

test('every route the backend registers under /v1 is documented, and nothing else is', () => {
  const registered = [...appSource.matchAll(/v1\.get\('([^']+)'/g)].map((m) => `/v1${m[1]}`);
  const documented = ENDPOINTS.map((e) => e.path).filter((p) => p.startsWith('/v1/'));
  assert.deepEqual([...registered].sort(), [...documented].sort());
});

test('/health is documented and registered', () => {
  assert.ok(appSource.includes("app.get('/health'"));
  assert.ok(ENDPOINTS.some((e) => e.path === '/health'));
});

test('every error code in the table is raised by the backend', () => {
  for (const [, code] of ERRORS) {
    assert.ok(appSource.includes(code) || serviceSource.includes(code), `${code} is not in the backend`);
  }
});

test('every error code the backend raises is in the table', () => {
  const raised = new Set([...serviceSource.matchAll(/'([A-Z][A-Z_]+)'/g), ...appSource.matchAll(/'([A-Z][A-Z_]+)'/g)].map((m) => m[1]));
  const documented = new Set(ERRORS.map(([, code]) => code));
  for (const code of raised) {
    if (/^(GET|HEAD|OPTIONS)$/.test(code)) continue;
    if (['ATTRIBUTION_FALLBACK', 'NAME', 'ENDPOINTS', 'PAGES'].includes(code)) continue;
    assert.ok(documented.has(code), `${code} is raised by the backend but not documented`);
  }
});

test('the documented limits match the backend', () => {
  assert.match(serviceSource, /MAX_RANGE_DAYS = 3660/);
  assert.match(appSource, /limit: options.rateLimitMax \?\? 100/);
  assert.match(appSource, /windowMs: 15 \* 60 \* 1000/);
  assert.match(serviceSource, /DEFAULT_CHANGES_DAYS = 365/);
});
