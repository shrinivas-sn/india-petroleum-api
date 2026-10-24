// Keeps the API's data current without a redeploy. The ingestion job commits new rows to the repository;
// this reads the three data files from the repository's public raw URL at most once per TTL, validates
// them, and swaps them into the FuelService only if they are good. On any failure the last good data
// stays in memory and the reason is reported by status(), so a GitHub or network problem can never take
// the API down or put half a dataset in front of a user. The API still never contacts PPAC.
import { validateDataset } from './dataset.js';

export const DEFAULT_BASE_URL = 'https://raw.githubusercontent.com/shrinivas-sn/india-petroleum-api/main/data/fuel';
const MAX_BYTES = 8 * 1024 * 1024;

/** Remote settings from the environment, or null when the remote is off or its URL is unusable. */
export function remoteFromEnv(env = process.env) {
  if (env.DATA_REMOTE === 'off') return null;
  const baseUrl = (env.DATA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  try {
    if (new URL(baseUrl).protocol !== 'https:') throw new Error('not https');
  } catch {
    console.error(`DATA_BASE_URL must be an https URL; the remote data refresh is off (got "${baseUrl}")`);
    return null;
  }
  const ttl = Number(env.DATA_TTL_SECONDS ?? 600);
  return { baseUrl, ttlMs: (Number.isFinite(ttl) && ttl >= 30 ? ttl : 600) * 1000 };
}

/**
 * The body as text, read as a stream and abandoned the moment it passes `max` bytes. res.text() would buffer
 * the whole decoded body first, and a small compressed file can inflate far past the limit.
 */
async function readCapped(res, max, name) {
  const tooLarge = (bytes) => new Error(`${name} is too large (over ${bytes} bytes, the limit is ${max})`);
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (text.length > max) throw tooLarge(text.length);
    return text;
  }
  const reader = res.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw tooLarge(size);
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class DataStore {
  /**
   * @param service  the FuelService whose data is replaced (it needs `meta` and `load()`)
   * @param remote   null for bundled data only, or { baseUrl, ttlMs, fetchFn, now, timeoutMs, deadlineMs, retryMs,
   *                 maxBytes, log, today }. `log` receives one line per failed refresh; `today` supplies the calendar
   *                 date used to refuse datasets from the future (`now` is the TTL clock and may be a fake counter).
   */
  constructor({ service, remote = null }) {
    this.service = service;
    this.remote = remote && {
      fetchFn: globalThis.fetch,
      now: Date.now,
      ttlMs: 600_000,
      timeoutMs: 4000,
      deadlineMs: 1500,
      retryMs: 60_000,
      maxBytes: MAX_BYTES,
      log: () => {},
      today: () => new Date(),
      ...remote,
      baseUrl: remote.baseUrl.replace(/\/+$/, ''),
    };
    this.source = 'bundled';
    this.checkedAt = null;
    this.error = null;
    this.failures = 0;
    this.nextCheck = 0;
    this.inflight = null;
    this.etag = null;
  }

  status() {
    return {
      data_source: this.source,
      checked_at: this.checkedAt === null ? null : new Date(this.checkedAt).toISOString(),
      refresh_error: this.error,
    };
  }

  /**
   * Called before a data request. Returns at once while the data is fresh; otherwise starts one refresh
   * and waits for it for at most `deadlineMs`, so a slow GitHub can delay a request by that much and no more.
   * Never rejects.
   */
  async ensureFresh() {
    const r = this.remote;
    if (!r || r.now() < this.nextCheck || this.inflight) return;
    this.inflight = withTimeout(this.#refresh(), r.timeoutMs * 3, 'refresh')
      .catch((e) => this.#failed(e))
      .finally(() => {
        this.inflight = null;
      });
    await withTimeout(this.inflight, r.deadlineMs, 'deadline').catch(() => {});
  }

  #failed(error) {
    const r = this.remote;
    this.failures += 1;
    this.error = String(error?.message ?? error).slice(0, 300);
    // One line per failed attempt (the backoff spaces them out): a refused dataset or a GitHub outage must not be silent.
    r.log(`[data-store] refresh failed (attempt ${this.failures}), keeping the data already loaded: ${this.error}`);
    this.nextCheck = r.now() + Math.min(r.ttlMs, r.retryMs * 2 ** (this.failures - 1));
  }

  #succeeded() {
    const r = this.remote;
    this.failures = 0;
    this.error = null;
    this.checkedAt = r.now();
    this.nextCheck = r.now() + r.ttlMs;
  }

  async #get(name, { etag = null } = {}) {
    const r = this.remote;
    const headers = { Accept: 'application/json' };
    if (etag) headers['If-None-Match'] = etag;
    let res;
    try {
      res = await withTimeout(r.fetchFn(`${r.baseUrl}/${name}`, { headers, signal: AbortSignal.timeout(r.timeoutMs) }), r.timeoutMs, name);
    } catch (e) {
      if (/timed out/.test(e.message)) throw e;
      throw new Error(`${name}: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
    }
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new Error(`${name} answered ${res.status}`);
    const length = Number(res.headers.get('content-length'));
    if (length > r.maxBytes) throw new Error(`${name} is too large (${length} bytes, the limit is ${r.maxBytes})`);
    const text = await withTimeout(readCapped(res, r.maxBytes, name), r.timeoutMs, `${name} body`);
    try {
      return { json: JSON.parse(text), etag: res.headers.get('etag') };
    } catch {
      throw new Error(`${name} is not valid JSON`);
    }
  }

  async #refresh() {
    const current = this.service.meta;
    const metaRes = await this.#get('meta.json', { etag: this.etag });
    if (metaRes.notModified) {
      this.source = 'remote';
      this.#succeeded();
      return;
    }
    const meta = metaRes.json;
    const unchanged =
      meta && meta.sha256 === current.sha256 && meta.fetched_at === current.fetched_at && meta.last_date === current.last_date && meta.day_count === current.day_count;
    if (unchanged) {
      this.etag = metaRes.etag;
      this.source = 'remote';
      this.#succeeded();
      return;
    }
    const [daily, changes] = await Promise.all([this.#get('daily.json'), this.#get('changes.json')]);
    const candidate = { days: daily.json?.days, moves: changes.json?.changes, meta };
    this.service.load(validateDataset(candidate, { current, now: this.remote.today() }));
    this.etag = metaRes.etag;
    this.source = 'remote';
    this.#succeeded();
  }
}
