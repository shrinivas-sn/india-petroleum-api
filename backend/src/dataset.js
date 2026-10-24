// Checks a fuel dataset (the three stored files) before the API starts serving it. The ingestion job
// already refuses bad data; this is the second lock, because the API reads these files from the
// repository at run time and a bad file must never replace a good one in memory.
import { CITY_SLUGS, FUELS } from './fuel-service.js';

export class DatasetError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 30000;
const MAX_MOVES = 500000;
const MAX_PRICE = 10000;
const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
// PPAC posts the newest table on the day itself, so a stored day can be at most a day or two ahead of today in India.
const MAX_DAYS_AHEAD = 2;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

const isRealDate = (value) => typeof value === 'string' && DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < MAX_PRICE;
const fail = (message) => {
  throw new DatasetError(message);
};
// Error text ends up in the public refresh_error, so a value from the file is cut short and made printable.
const show = (value) => {
  const text = String(value).replace(/[^ -~]/g, '?');
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
};
const describeMove = (m) => `${show(m.date)} ${show(m.fuel)} ${show(m.city)} ${show(m.from)} to ${show(m.to)}`;

/** The meta fields the API serves, each checked for kind and size; anything else in the file is dropped. */
function cleanMeta(meta) {
  const text = (key, max) => {
    const value = meta[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > max) fail(`meta.json: ${key} must be text of 1 to ${max} characters`);
    return value;
  };
  const date = (key) => {
    if (!isRealDate(meta[key])) fail(`meta.json: ${key} must be a real date in YYYY-MM-DD form`);
    return meta[key];
  };
  const sourceUrl = text('source_url', 500);
  let url = null;
  try {
    url = new URL(sourceUrl);
  } catch {
    // fails below
  }
  if (!url || url.protocol !== 'https:' || !url.hostname) fail('meta.json: source_url must be an https URL');
  const sha = meta.sha256;
  if (typeof sha !== 'string' || !SAFE_ID.test(sha)) fail('meta.json: sha256 must be letters, digits, - or _ (at most 128)');
  const fetched = text('fetched_at', 40);
  if (!ISO_INSTANT.test(fetched) || Number.isNaN(Date.parse(fetched))) fail('meta.json: fetched_at must be a UTC time such as 2026-10-24T07:13:20.524Z');
  if (!Number.isInteger(meta.day_count)) fail('meta.json: day_count must be a whole number');
  return {
    source: text('source', 100),
    attribution: text('attribution', 500),
    source_url: sourceUrl,
    source_posted_date: date('source_posted_date'),
    sha256: sha,
    fetched_at: fetched,
    first_date: date('first_date'),
    last_date: date('last_date'),
    day_count: meta.day_count,
  };
}

/**
 * changes.json must be exactly what daily.json implies: one change for every price that differs from the
 * day before, and (for a change dated on the first stored day, which has no day before it) one ending at
 * that day's price. A changes.json that is stale next to daily.json, or invented, is refused.
 */
function checkMoves(days, moves) {
  const key = (m) => `${m.date}|${m.fuel}|${m.city}|${m.from}|${m.to}`;
  const expected = new Map();
  for (let i = 1; i < days.length; i += 1) {
    for (const fuel of FUELS) {
      for (const city of CITY_SLUGS) {
        const from = days[i - 1][fuel][city];
        const to = days[i][fuel][city];
        if (from !== to) expected.set(key({ date: days[i].date, fuel, city, from, to }), { date: days[i].date, fuel, city, from, to });
      }
    }
  }
  for (const [i, move] of moves.entries()) {
    if (i > 0 && move.date < moves[i - 1].date) fail(`changes.json is not in date order at change ${i}`);
    if (move.date === days[0].date) {
      if (move.to !== days[0][move.fuel][move.city]) fail(`changes.json: the change on the first stored day does not end at that day's price (${describeMove(move)})`);
      continue;
    }
    if (!expected.delete(key(move))) fail(`changes.json has a change that daily.json does not support (${describeMove(move)})`);
  }
  if (expected.size) fail(`changes.json is missing a change that daily.json shows (${describeMove(expected.values().next().value)})`);
}

/**
 * Returns { days, moves, meta } with meta reduced to the known, checked fields, or throws a DatasetError
 * naming the first problem. `current` is the meta of the data already in memory: a dataset that starts
 * later, has fewer days or ends earlier is refused, so the API never goes backwards (and one that ends
 * in the future is refused, or it would lock out every real dataset that follows).
 */
export function validateDataset({ days, moves, meta }, { current = null, now = new Date() } = {}) {
  if (!meta || typeof meta !== 'object') fail('meta.json is not an object');
  if (!Array.isArray(days) || days.length === 0) fail('daily.json has no days');
  if (days.length > MAX_DAYS) fail(`daily.json has too many days (${days.length})`);
  if (!Array.isArray(moves)) fail('changes.json has no list of changes');
  if (moves.length > MAX_MOVES) fail(`changes.json has too many changes (${moves.length})`);

  let previous = null;
  for (const [i, day] of days.entries()) {
    if (!day || !isRealDate(day.date)) fail(`day ${i} has no real date`);
    for (const fuel of FUELS) {
      for (const city of CITY_SLUGS) {
        if (!isPrice(day[fuel]?.[city])) fail(`${day.date} has no valid ${fuel} price for ${city}`);
      }
    }
    if (previous && Date.parse(`${day.date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) !== DAY_MS) {
      fail(`daily.json is not contiguous: ${previous} is followed by ${day.date}`);
    }
    previous = day.date;
  }

  const cleanedMeta = cleanMeta(meta);
  const first = days[0].date;
  const last = days.at(-1).date;
  if (cleanedMeta.first_date !== first || cleanedMeta.last_date !== last || cleanedMeta.day_count !== days.length) {
    fail(`meta.json and daily.json disagree (meta says ${cleanedMeta.first_date} to ${cleanedMeta.last_date}, ${cleanedMeta.day_count} days; daily has ${first} to ${last}, ${days.length} days)`);
  }
  const todayIst = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const newest = new Date(Date.parse(`${todayIst}T00:00:00Z`) + MAX_DAYS_AHEAD * DAY_MS).toISOString().slice(0, 10);
  if (last > newest) fail(`daily.json ends ${last}, more than ${MAX_DAYS_AHEAD} days ahead of today in India (${todayIst}): a dataset from the future is refused`);

  const fuels = new Set(FUELS);
  const cities = new Set(CITY_SLUGS);
  for (const [i, move] of moves.entries()) {
    if (!move || !isRealDate(move.date) || move.date < first || move.date > last) fail(`change ${i} has a date outside the stored days`);
    if (!fuels.has(move.fuel) || !cities.has(move.city)) fail(`change ${i} names an unknown fuel or city`);
    if (!isPrice(move.from) || !isPrice(move.to)) fail(`change ${i} has an invalid price`);
  }

  checkMoves(days, moves);

  if (current?.last_date && last < current.last_date) {
    fail(`the repository's data ends ${last}, older than the ${current.last_date} already loaded`);
  }
  if (current?.first_date && first > current.first_date) {
    fail(`the repository's data starts later (${first}) than the ${current.first_date} already loaded`);
  }
  if (current?.day_count && days.length < current.day_count) {
    fail(`the repository's data has fewer days (${days.length}) than the ${current.day_count} already loaded`);
  }
  return { days, moves, meta: cleanedMeta };
}
