// Runs after `npm run build`: checks the files in dist/ and serves them through the real backend,
// the same way the deployed site will. Works with or without SITE_URL at build time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../../backend/src/app.js';
import { GUIDES } from '../../src/content/guidesData.js';

const dist = (p) => fileURLToPath(new URL(`../../dist/${p}`, import.meta.url));
const read = (p) => fs.readFileSync(dist(p), 'utf8');
const ROUTES = ['/', '/docs', '/playground', '/guides', '/status', ...GUIDES.map((g) => `/guides/${g.id}`)];
const fileFor = (route) => (route === '/' ? 'index.html' : `${route.slice(1)}/index.html`);
const head = (html, re) => re.exec(html)?.[1];

test('the build exists', () => {
  assert.ok(fs.existsSync(dist('index.html')), 'run npm run build first');
  assert.ok(fs.existsSync(dist('404.html')), 'dist/404.html is missing');
});

test('every route has its own prerendered page with real content, a title and one h1', () => {
  const titles = new Set();
  for (const route of ROUTES) {
    const html = read(fileFor(route));
    assert.match(html, /<div id="root">\s*<div class="page">/, `${route} has no prerendered body`);
    const title = head(html, /<title>([^<]+)<\/title>/);
    assert.ok(title, `${route} has no title`);
    assert.ok(!titles.has(title), `${route} repeats a title: ${title}`);
    titles.add(title);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${route} should have exactly one h1`);
    assert.match(html, /Petroleum Planning &amp; Analysis Cell \(PPAC\)/, `${route} lacks the PPAC attribution`);
  }
});

test('the home page carries the real latest prices and the 4 Nov 2021 move, not placeholders', () => {
  const html = read('index.html');
  const snapshot = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../src/generated/snapshot.json', import.meta.url)), 'utf8'));
  assert.ok(html.includes(snapshot.latest.petrol.delhi.toFixed(2)));
  assert.ok(html.includes(snapshot.latest.diesel.kolkata.toFixed(2)));
  assert.match(html, /4 Nov 2021/);
  assert.match(html, /<svg[^>]*role="img"/);
});

test('404.html is noindex and carries no canonical', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.match(html, /This page does not exist/);
});

test('canonical tags, sitemap and robots agree with whether SITE_URL was set', () => {
  const hasSitemap = fs.existsSync(dist('sitemap.xml'));
  assert.equal(fs.existsSync(dist('robots.txt')), hasSitemap, 'sitemap.xml and robots.txt come together');
  if (!hasSitemap) {
    for (const route of ROUTES) assert.doesNotMatch(read(fileFor(route)), /rel="canonical"/, route);
    return;
  }
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, ROUTES.length);
  assert.ok(!locs.some((l) => /localhost|127\.0\.0\.1|#/.test(l)));
  const origin = new URL(locs[0]).origin;
  for (const route of ROUTES) {
    const url = new URL(route, origin).href;
    assert.ok(locs.includes(url), `${url} is not in the sitemap`);
    assert.equal(head(read(fileFor(route)), /<link rel="canonical" href="([^"]+)"/), url);
  }
  assert.match(read('robots.txt'), new RegExp(`Allow: /\\s+Sitemap: ${origin.replace(/[.]/g, '\\.')}/sitemap\\.xml`));
  assert.ok(!read('404.html').includes('<loc>'));
});

test('served through the backend: pages answer HTML, API paths answer JSON, unknown paths answer 404', async () => {
  const { app } = createApp({ rateLimit: false, quiet: true });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = { headers: { Accept: 'text/html' } };
  try {
    for (const route of ROUTES) {
      const res = await fetch(base + route, html);
      assert.equal(res.status, 200, route);
      assert.match(res.headers.get('content-type'), /text\/html/, route);
    }
    const missing = await fetch(`${base}/no-such-page`, html);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /text\/html/);
    const apiMissing = await fetch(`${base}/v1/no-such-route`, html);
    assert.equal(apiMissing.status, 404);
    assert.match(apiMissing.headers.get('content-type'), /application\/json/, 'API paths never answer HTML');

    // Every API path quoted in the guides must work as written.
    const quoted = [...new Set([...JSON.stringify(GUIDES).matchAll(/\{\{API\}\}(\/v1\/[^"'\\ ;)]+)/g)].map((m) => m[1]))];
    assert.equal(quoted.length, 3, `expected three distinct API paths in the guides, got ${quoted.join(', ')}`);
    for (const path of quoted) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('content-type'), /application\/json/, path);
      assert.equal((await res.json()).success, true, path);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('the JavaScript bundle holds no localhost address', () => {
  const assets = fs.readdirSync(dist('assets')).filter((f) => f.endsWith('.js'));
  assert.ok(assets.length > 0);
  for (const file of assets) assert.doesNotMatch(read(`assets/${file}`), /localhost|127\.0\.0\.1/, file);
});
