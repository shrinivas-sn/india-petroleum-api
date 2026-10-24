import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { findDailyLinks, pickLatest, downloadComplete, discoverLatest } from './fetch-daily.js';

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

test('discoverLatest tries the next page when the first one cannot be reached', async () => {
  const html = '<a href="https://ppac.gov.in/download.php?file=importantnews/1792653592_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf">x</a>';
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    if (calls.length === 1) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    return { status: 200, text: async () => html };
  };
  const found = await discoverLatest(['https://a.test/', 'https://b.test/'], { fetchFn });
  assert.equal(calls.length, 2);
  assert.match(found.picked.url, /Metro_22\.10\.2026\.pdf$/);
  assert.equal(found.status, 200);
});

test('discoverLatest reports the network error when no page can be reached', async () => {
  const fetchFn = async () => {
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'ETIMEDOUT' } });
  };
  await assert.rejects(discoverLatest(['https://a.test/', 'https://b.test/'], { fetchFn }), /fetch failed/);
});

test('discoverLatest returns no link, not an error, when pages answer without one', async () => {
  const fetchFn = async () => ({ status: 200, text: async () => '<p>nothing here</p>' });
  const found = await discoverLatest(['https://a.test/'], { fetchFn });
  assert.equal(found.picked, null);
});

test('discoverLatest never works around a TLS failure', async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } });
  };
  await assert.rejects(discoverLatest(['https://a.test/', 'https://b.test/'], { fetchFn }));
  assert.equal(calls.length, 1, 'a certificate failure stops the run, it does not try another page');
});

const LINK_PAGE = '<a href="https://ppac.gov.in/download.php?file=importantnews/1792653592_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf">x</a>';
const reset = (code) => Object.assign(new Error('fetch failed'), { cause: { code } });

test('discoverLatest reports a failed primary page even when the fallback page supplied the link', async () => {
  let n = 0;
  const fetchFn = async () => {
    n += 1;
    if (n === 1) throw reset('ECONNRESET');
    return { status: 200, text: async () => LINK_PAGE };
  };
  const found = await discoverLatest(['https://primary.test/', 'https://fallback.test/'], { fetchFn });
  assert.ok(found.picked);
  assert.equal(found.pageErrors.length, 1);
  assert.match(found.pageErrors[0], /primary\.test.*fetch failed.*ECONNRESET/);
});

test('discoverLatest names a network failure, not a missing link, when one page was unreachable and the other had no link', async () => {
  for (const order of ['unreachable-first', 'unreachable-second']) {
    let n = 0;
    const fetchFn = async () => {
      n += 1;
      const unreachable = order === 'unreachable-first' ? n === 1 : n === 2;
      if (unreachable) throw reset('ETIMEDOUT');
      return { status: 200, text: async () => '<p>nothing</p>' };
    };
    await assert.rejects(discoverLatest(['https://a.test/', 'https://b.test/'], { fetchFn }), /fetch failed/, order);
  }
});

test('discoverLatest keeps the first network error when every page fails', async () => {
  let n = 0;
  const fetchFn = async () => {
    n += 1;
    throw Object.assign(new Error(`fetch failed ${n}`), { cause: { code: 'ECONNRESET' } });
  };
  await assert.rejects(discoverLatest(['https://a.test/', 'https://b.test/'], { fetchFn }), /fetch failed 1/);
});
