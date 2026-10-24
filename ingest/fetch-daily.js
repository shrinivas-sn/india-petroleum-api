import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { appendLogRecord } from './log.js';

const REPO_URL = process.env.GITHUB_REPOSITORY
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
  : 'https://github.com/shrinivas-sn/india-petroleum-api';
export const USER_AGENT = `india-petroleum-api (+${REPO_URL})`;
export const PAGES = [
  'https://ppac.gov.in/retail-selling-price-rsp-of-petrol-diesel-and-domestic-lpg/rsp-of-petrol-and-diesel-in-metro-cities-since-16-6-2017',
  'https://ppac.gov.in/',
];

export function findDailyLinks(html, baseUrl) {
  const seen = new Map();
  for (const m of html.matchAll(/(?:https?:)?\/\/[^"'\s<>]*?PP_9_a_DailyPriceMSHSD_Metro_(\d{2})\.(\d{2})\.(\d{4})\.pdf/g)) {
    const raw = m[0].startsWith('//') ? `https:${m[0]}` : m[0];
    const url = new URL(raw, baseUrl).href;
    seen.set(url, { url, date: `${m[3]}-${m[2]}-${m[1]}` });
  }
  return [...seen.values()];
}

const epochOf = (url) => Number(/\/(\d+)_PP_9_a_/.exec(url)?.[1] ?? 0) ||
  Number(/file=[^&]*?\/(\d+)_PP_9_a_/.exec(url)?.[1] ?? 0);

export function pickLatest(links) {
  if (!links.length) return null;
  const newest = links.reduce((a, b) => (b.date > a ? b.date : a), '0000-00-00');
  const same = links.filter((l) => l.date === newest).sort((a, b) => epochOf(b.url) - epochOf(a.url));
  return { ...same[0], copies: same.length, all: same.map((l) => l.url) };
}

export async function downloadComplete(url, { dest = 'work/daily.pdf', timeoutMs = 120000, requirePdf = true } = {}) {
  mkdirSync(dirname(dest), { recursive: true });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: ctrl.signal });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const expected = Number(res.headers.get('content-length'));
    if (!expected) throw new Error('NO_CONTENT_LENGTH');
    const hash = createHash('sha256');
    let bytes = 0;
    const counter = async function* (src) { for await (const c of src) { bytes += c.length; hash.update(c); yield c; } };
    try {
      await pipeline(Readable.fromWeb(res.body), counter, createWriteStream(dest));
    } catch (e) {
      throw Object.assign(new Error(`INCOMPLETE: got ${bytes} of ${expected} bytes (${e.message})`), { status: res.status, bytes, expected });
    }
    if (bytes !== expected) throw Object.assign(new Error(`INCOMPLETE: got ${bytes} of ${expected} bytes`), { status: res.status, bytes, expected });
    const out = { status: res.status, bytes, content_length: expected, sha256: hash.digest('hex'), pages: null, dest };
    if (requirePdf) {
      const info = execFileSync('pdfinfo', [dest], { encoding: 'utf8' });
      out.pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
      if (!out.pages) throw new Error('NOT_A_PDF: pdfinfo reports no pages');
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export function readTablePosted(pdfPath) {
  const text = execFileSync('pdftotext', ['-f', '1', '-l', '1', '-layout', pdfPath, '-'], { encoding: 'utf8' });
  return /Table Posted:\s*(\S+)/.exec(text)?.[1] ?? null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTlsError = (e) => /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(`${e?.cause?.code ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`);

/**
 * Looks for the newest daily file link on each page in turn. A network error on one page moves on to
 * the next, and is returned in `pageErrors` so the download record shows it. If no page gave a link
 * and any page was unreachable, the first network error is thrown: "unreachable" is not "PPAC removed
 * the link". A TLS error always stops the run at once: a certificate failure is a result, never
 * something to route around.
 */
export async function discoverLatest(pages = PAGES, { fetchFn = fetch, timeoutMs = 60000 } = {}) {
  const pageErrors = [];
  let firstError = null;
  let seen = { status: null, bytes: null };
  for (const page of pages) {
    let html;
    try {
      const res = await fetchFn(page, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
      html = await res.text();
      seen = { status: res.status, bytes: html.length };
    } catch (e) {
      if (isTlsError(e)) throw e;
      firstError ??= e;
      pageErrors.push(`${page}: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
      continue;
    }
    const picked = pickLatest(findDailyLinks(html, page));
    if (picked) return { picked, ...seen, pageErrors };
  }
  if (firstError) throw firstError;
  return { picked: null, ...seen, pageErrors };
}

export async function run({ waits = [30000, 120000, 300000], log = 'proof/download-log.jsonl' } = {}) {
  const started = Date.now();
  const rec = {
    run_id: process.env.GITHUB_RUN_ID ?? randomUUID(),
    trigger: process.env.GITHUB_EVENT_NAME === 'schedule' ? 'schedule' : 'manual',
    started_at_utc: new Date(started).toISOString(),
    page_status: null, page_bytes: null, link_found: false, file_url: null, copies_found: 0,
    download_status: null, content_length: null, bytes_received: null, complete: false,
    sha256: null, pdf_pages: null, table_posted: null, tls_verified: true, attempts: 0,
    seconds_total: 0, error: null, page_errors: [],
  };
  let exit = 2;
  try {
    const found = await discoverLatest();
    rec.page_status = found.status;
    rec.page_bytes = found.bytes;
    rec.page_errors = found.pageErrors;
    const picked = found.picked;
    if (!picked) throw new Error('NO_LINK: no DailyPriceMSHSD_Metro file link on the PPAC pages');
    rec.link_found = true;
    rec.file_url = picked.url;
    rec.copies_found = picked.copies;
    let lastErr;
    for (let i = 0; i <= waits.length; i++) {
      rec.attempts = i + 1;
      try {
        const d = await downloadComplete(picked.url);
        rec.download_status = d.status; rec.content_length = d.content_length; rec.bytes_received = d.bytes;
        rec.sha256 = d.sha256; rec.pdf_pages = d.pages; rec.complete = true;
        rec.table_posted = readTablePosted(d.dest);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        rec.download_status = e.status ?? rec.download_status;
        rec.bytes_received = e.bytes ?? rec.bytes_received;
        rec.content_length = e.expected ?? rec.content_length;
        if (isTlsError(e)) { rec.tls_verified = false; break; }
        if (i < waits.length) await sleep(waits[i]);
      }
    }
    if (lastErr) throw lastErr;
    exit = 0;
  } catch (e) {
    if (isTlsError(e)) rec.tls_verified = false;
    rec.error = String(e.message ?? e).slice(0, 300);
  } finally {
    rec.seconds_total = Math.round((Date.now() - started) / 100) / 10;
    appendLogRecord(log, rec);
    console.log(JSON.stringify(rec));
  }
  return exit;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await run();
}
