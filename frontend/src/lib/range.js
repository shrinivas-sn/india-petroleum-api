// Date windows for the chart and the playground, all counted back from the newest stored day so no
// page depends on a date typed into the source. Dates are ISO YYYY-MM-DD strings, handled in UTC
// so a visitor's time zone cannot shift a window.
import { addDays } from './series.js';

// The API refuses a request spanning more than this many days (backend MAX_RANGE_DAYS).
export const MAX_REQUEST_DAYS = 3660;

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

export const RANGES = [
  { id: '3m', label: '3 months', months: 3 },
  { id: '1y', label: '1 year', months: 12 },
  { id: 'all', label: 'All', months: null },
];

/** Moves an ISO date by whole calendar months; a day past the end of the new month becomes its last day. */
export function addMonths(iso, months) {
  const [year, month, day] = iso.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** { from, to } for a range id, ending on the newest day and never starting before the first one. */
export function windowFor(rangeId, firstIso, lastIso) {
  const range = RANGES.find((r) => r.id === rangeId);
  if (!range) throw new Error(`Unknown range '${rangeId}'`);
  if (range.months === null) return { from: firstIso, to: lastIso };
  const from = addMonths(lastIso, -range.months);
  return { from: from < firstIso ? firstIso : from, to: lastIso };
}

/** Contiguous windows, each within the API's span limit, that together cover from..to. */
export function chunks(from, to, maxDays = MAX_REQUEST_DAYS) {
  if (from > to) throw new Error(`'from' (${from}) is after 'to' (${to})`);
  const out = [];
  let start = from;
  while (start <= to) {
    const end = addDays(start, maxDays - 1);
    out.push({ from: start, to: end < to ? end : to });
    start = addDays(end, 1);
  }
  return out;
}

/** The last `days` days up to and including the newest one. */
export function exampleWindow(lastIso, days) {
  return { from: addDays(lastIso, -(days - 1)), to: lastIso };
}

/** Today's calendar date in India (PPAC's prices change on Indian days). */
export function istToday(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar days in India between today and the newest price date, never negative. Same rule as ingest/freshness.js. */
export function daysBehind(lastIso, now = new Date()) {
  return Math.max(0, Math.round((dayMs(istToday(now)) - dayMs(lastIso)) / DAY_MS));
}
