import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { findDailyLinks, pickLatest, downloadComplete } from './fetch-daily.js';

const fx = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('home page snippet: finds both importantnews links dated 2026-10-22', () => {
  const links = findDailyLinks(fx('home-snippet.html'), 'https://ppac.gov.in/');
  assert.equal(links.length, 2);
  assert.ok(links.every((l) => l.date === '2026-10-22'));
  assert.ok(links.every((l) => l.url.startsWith('https://ppac.gov.in/download.php?file=importantnews/')));
});

test('metro page snippet: finds the page-images link, ignores the old DailyPriceEN.pdf', () => {
  const links = findDailyLinks(fx('metro-snippet.html'), 'https://ppac.gov.in/x');
  assert.equal(links.length, 1);
  assert.equal(links[0].url, 'https://ppac.gov.in/uploads/page-images/1792653318_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf');
  assert.equal(links[0].date, '2026-10-22');
});

test('protocol-relative links resolve to https', () => {
  const html = '<a href="//ppac.gov.in/uploads/page-images/1_PP_9_a_DailyPriceMSHSD_Metro_01.02.2027.pdf">x</a>';
  assert.equal(findDailyLinks(html, 'https://ppac.gov.in/')[0].url,
    'https://ppac.gov.in/uploads/page-images/1_PP_9_a_DailyPriceMSHSD_Metro_01.02.2027.pdf');
});

test('pickLatest picks the newest date and breaks ties by the larger epoch prefix', () => {
  const mk = (epoch, d) => ({ url: `https://h/${epoch}_PP_9_a_DailyPriceMSHSD_Metro_${d}.pdf`, date: d.split('.').reverse().join('-') });
  const picked = pickLatest([mk(5, '21.10.2026'), mk(7, '22.10.2026'), mk(9, '22.10.2026')]);
  assert.equal(picked.copies, 2);
  assert.match(picked.url, /\/9_PP_9_a/);
  assert.equal(pickLatest([]), null);
});

function serve(handler) {
  return new Promise((resolve) => {
    const s = createServer(handler).listen(0, '127.0.0.1', () => resolve(s));
  });
}

test('downloadComplete rejects a body shorter than Content-Length with INCOMPLETE', async () => {
  const s = await serve((req, res) => {
    res.writeHead(200, { 'Content-Length': 1000 });
    res.write(Buffer.alloc(400));
    setTimeout(() => res.destroy(), 20);
  });
  const url = `http://127.0.0.1:${s.address().port}/f.pdf`;
  await assert.rejects(downloadComplete(url, { dest: 'work/test-trunc.pdf', timeoutMs: 3000, requirePdf: false }), /INCOMPLETE/);
  s.close();
});

test('downloadComplete accepts a full body and returns bytes and sha256', async () => {
  const body = Buffer.alloc(2048, 7);
  const s = await serve((req, res) => { res.writeHead(200, { 'Content-Length': body.length }); res.end(body); });
  const url = `http://127.0.0.1:${s.address().port}/f.pdf`;
  const r = await downloadComplete(url, { dest: 'work/test-full.pdf', timeoutMs: 3000, requirePdf: false });
  assert.equal(r.bytes, 2048);
  assert.equal(r.sha256.length, 64);
  s.close();
});
