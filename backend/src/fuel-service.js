// Read-only view of the stored fuel data (data/fuel/*.json). Loaded once at start;
// the API never calls PPAC. About 3,400 days, so everything stays in memory.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { daysBehind } from '../../ingest/freshness.js';

export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../data/fuel', import.meta.url));
export const FUELS = ['petrol', 'diesel'];
export const CITIES = [
  { slug: 'delhi', name: 'Delhi' },
  { slug: 'mumbai', name: 'Mumbai' },
  { slug: 'chennai', name: 'Chennai' },
  { slug: 'kolkata', name: 'Kolkata' },
];
export const CITY_SLUGS = CITIES.map((c) => c.slug);
export const MAX_RANGE_DAYS = 3660;
export const DEFAULT_CHANGES_DAYS = 365;

const DAY_MS = 86400000;

export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function spanDays(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

function readJson(dir, name) {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch (e) {
    throw new Error(`cannot load ${name} from ${dir}: ${e.message}`);
  }
}

export class FuelService {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) {
    this.days = readJson(dataDir, 'daily.json').days;
    this.moves = readJson(dataDir, 'changes.json').changes;
    this.meta = readJson(dataDir, 'meta.json');
  }

  latest() {
    return this.days[this.days.length - 1];
  }

  coverage() {
    return { first_date: this.meta.first_date, last_date: this.meta.last_date };
  }

  // Validates ?city= and ?fuel= (both optional) and returns the cleaned filters.
  filters(query) {
    const pick = (name, valid, code) => {
      const v = query[name];
      if (v === undefined) return undefined;
      if (typeof v !== 'string' || !valid.includes(v)) {
        throw new ApiError(404, code, `Unknown ${name} '${Array.isArray(v) ? v.join(',') : v}'. Valid values: ${valid.join(', ')}.`, { valid_values: valid });
      }
      return v;
    };
    return { city: pick('city', CITY_SLUGS, 'UNKNOWN_CITY'), fuel: pick('fuel', FUELS, 'UNKNOWN_FUEL') };
  }

  // Validates ?from= and ?to=. With `defaults`, missing values fall back to the last year.
  window(query, { required }) {
    const names = ['from', 'to'];
    const missing = names.filter((n) => query[n] === undefined);
    let defaulted = false;
    let { from, to } = query;
    if (missing.length && required) {
      throw new ApiError(400, 'MISSING_PARAM', `Missing required query parameter(s): ${missing.join(', ')}. Dates are YYYY-MM-DD.`);
    }
    for (const n of names) {
      if (query[n] !== undefined && !isRealDate(query[n])) {
        throw new ApiError(400, 'INVALID_DATE', `'${n}' must be a real calendar date in YYYY-MM-DD form.`);
      }
    }
    if (missing.length) {
      defaulted = true;
      to = to ?? this.meta.last_date;
      from = from ?? addDays(to, -(DEFAULT_CHANGES_DAYS));
    }
    if (from > to) throw new ApiError(400, 'INVALID_RANGE', `'from' (${from}) is after 'to' (${to}).`);
    if (spanDays(from, to) > MAX_RANGE_DAYS) {
      throw new ApiError(400, 'RANGE_TOO_LARGE', `The range may span at most ${MAX_RANGE_DAYS} days; ask for several ranges.`);
    }
    return { from, to, defaulted };
  }

  prices({ from, to, city, fuel }) {
    const fuels = fuel ? [fuel] : FUELS;
    const cities = city ? [city] : CITY_SLUGS;
    return this.days
      .filter((d) => d.date >= from && d.date <= to)
      .map((d) => {
        const row = { date: d.date };
        for (const f of fuels) {
          row[f] = Object.fromEntries(cities.map((c) => [c, d[f][c]]));
        }
        return row;
      });
  }

  changes({ from, to, city, fuel }) {
    return this.moves.filter(
      (m) => m.date >= from && m.date <= to && (!city || m.city === city) && (!fuel || m.fuel === fuel),
    );
  }

  provenance(now = new Date()) {
    return { ...this.meta, fuels: FUELS, days_behind: daysBehind(this.meta, now) };
  }
}
