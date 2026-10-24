// What the pages know about how current their data is. Three states share one shape:
//   snapshot  the figures baked in at build time, before the API has answered (also the prerendered HTML)
//   live      the API's own answers for /v1/meta and /v1/prices/latest
//   offline   the API did not answer; the snapshot stays on screen and says so
// Nothing here touches the DOM or React, so every rule is covered by node tests.
import { formatDate } from './format.js';
import { daysBehind } from './range.js';
import { CITY_SLUGS, FUEL_SLUGS } from './series.js';

// More than this many days behind means the daily job has stalled; fewer is normal around
// weekends and holidays. Same limit as ingest/freshness.js.
export const STALE_AFTER_DAYS = 2;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (value) => typeof value === 'string' && ISO.test(value);
const isPrice = (value) => typeof value === 'number' && Number.isFinite(value);

export function snapshotState(snapshot) {
  return {
    status: 'snapshot',
    meta: snapshot.meta,
    latest: snapshot.latest,
    lastMoves: snapshot.last_moves,
    daysBehind: null,
    checkedAt: null,
    error: null,
  };
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** An https URL, or false: the status page links to it, so a javascript: or data: address must never get through. */
function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}

/** The /v1/meta answer, checked field by field for everything a page reads from it; throws when anything is off. */
export function checkMeta(body) {
  const meta = body?.data;
  const ok =
    body?.success === true &&
    meta &&
    isIso(meta.first_date) &&
    isIso(meta.last_date) &&
    meta.first_date <= meta.last_date &&
    Number.isFinite(meta.day_count) &&
    Number.isFinite(meta.days_behind) &&
    meta.days_behind >= 0 &&
    isIso(meta.source_posted_date) &&
    typeof meta.fetched_at === 'string' &&
    !Number.isNaN(Date.parse(meta.fetched_at)) &&
    isHttpsUrl(meta.source_url) &&
    typeof meta.sha256 === 'string' &&
    SAFE_ID.test(meta.sha256);
  if (!ok) throw new Error('The API answered /v1/meta in an unexpected shape.');
  return meta;
}

function checkLatest(body) {
  const day = body?.data;
  const ok =
    body?.success === true &&
    day &&
    isIso(day.date) &&
    FUEL_SLUGS.every((fuel) => CITY_SLUGS.every((city) => isPrice(day[fuel]?.[city])));
  if (!ok) throw new Error('The API answered /v1/prices/latest in an unexpected shape.');
  return day;
}

/** A live state from the two API answers; throws when either is not what this page can draw. */
export function readLive(metaBody, latestBody, now = new Date()) {
  const meta = checkMeta(metaBody);
  const latest = checkLatest(latestBody);
  const lastChange = latestBody.meta?.last_change;
  return {
    status: 'live',
    meta,
    latest,
    // Absent on an API older than last_change: the board then leaves the line out instead of guessing.
    lastMoves: lastChange && typeof lastChange === 'object' ? lastChange : null,
    daysBehind: meta.days_behind,
    checkedAt: now.toISOString(),
    error: null,
  };
}

/** Fetches both answers with `get` (the api.js client) and returns a live state. */
export async function loadLive(get, { signal, now = new Date() } = {}) {
  const [meta, latest] = await Promise.all([get('/v1/meta', { signal }), get('/v1/prices/latest', { signal })]);
  return readLive(meta.body, latest.body, now);
}

/** The snapshot kept on screen after a failed call, with the reason and how old the snapshot is. */
export function offlineState(snapshotOrState, error, now = new Date()) {
  const base = snapshotOrState.status === 'snapshot' ? snapshotOrState : snapshotState(snapshotOrState);
  return { ...base, status: 'offline', error: String(error), daysBehind: daysBehind(base.meta.last_date, now) };
}

/** The sitewide banner for a state, or null. */
export function bannerFor(state) {
  if (state.status === 'live' && state.daysBehind > STALE_AFTER_DAYS) {
    return {
      kind: 'stale',
      title: 'Prices are behind.',
      message: `The newest price in the API is from ${formatDate(state.meta.last_date)}, ${state.daysBehind} days ago. Today's table may not be posted yet, or the daily update has stalled.`,
      detail: null,
      retry: false,
    };
  }
  if (state.status === 'offline') {
    const age = state.daysBehind > STALE_AFTER_DAYS ? ` That is ${state.daysBehind} days ago.` : '';
    return {
      kind: 'offline',
      title: 'Live data unavailable.',
      message: `Showing the figures from the last build, up to ${formatDate(state.meta.last_date)}.${age}`,
      detail: state.error,
      retry: true,
    };
  }
  return null;
}
