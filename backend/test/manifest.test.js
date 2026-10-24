// api.json is a static file, so its probe routes cannot follow the newest day. They must therefore never
// name a recent fixed window (a May 2026 window was the first draft): a window is either absent, so the
// API's own default (the year up to the newest day) applies, or anchored on the first stored day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';

const manifest = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../api.json', import.meta.url)), 'utf8'));
const apiRoutes = manifest.routes.filter((r) => r.kind === 'api').map((r) => r.path);
const FIRST_DATE = manifest.stack.dataset.first_date;

test('no probe route names a date after the first stored day', () => {
  for (const route of apiRoutes) {
    const dates = route.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    for (const date of dates) assert.ok(date <= '2017-06-30', `${route} hardcodes ${date}; use no window or a window at ${FIRST_DATE}`);
  }
});

test('every probe route answers 200 JSON against the real app, and the dated ones return rows', async () => {
  const { app } = createApp({ rateLimit: false, quiet: true });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of apiRoutes) {
      const res = await fetch(base + route);
      assert.equal(res.status, 200, route);
      assert.match(res.headers.get('content-type'), /application\/json/, route);
      const body = await res.json();
      assert.equal(body.success, true, route);
      if (/^\/v1\/prices\?/.test(route)) assert.ok(body.data.length > 0, `${route} returned no rows`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
