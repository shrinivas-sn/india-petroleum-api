// How much each price moved over the last day, week and month, from the API's own daily rows. The price
// board shows these under today's figure, so a reader sees recent movement and never a stale-looking date.
import { addDays, CITY_SLUGS, dayIndex, FUEL_SLUGS } from './series.js';

export const PERIODS = [
  { id: 'day', days: 1, label: '1 day' },
  { id: 'week', days: 7, label: '7 days' },
  { id: 'month', days: 30, label: '30 days' },
];

const round2 = (n) => Math.round(n * 100) / 100;
const isPrice = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * { petrol: { delhi: { day, week, month }, ... }, diesel: ... } where each value is the newest price minus the
 * price that many days earlier, in rupees, or null when that earlier day (or the price) is not in `rows`.
 * Returns null when there is nothing to compare: no rows, or none for the newest day.
 */
export function changesOver(rows, newestIso) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const newest = byDate.get(newestIso);
  if (!newest) return null;
  const out = {};
  for (const fuel of FUEL_SLUGS) {
    out[fuel] = {};
    for (const city of CITY_SLUGS) {
      const now = newest[fuel]?.[city];
      out[fuel][city] = {};
      for (const period of PERIODS) {
        const before = byDate.get(addDays(newestIso, -period.days))?.[fuel]?.[city];
        out[fuel][city][period.id] = isPrice(now) && isPrice(before) ? round2(now - before) : null;
      }
    }
  }
  return out;
}

// Past the longest period above, every change is 0.00, so the board says how long the price has held instead.
export const HOLD_NOTICE_DAYS = Math.max(...PERIODS.map((p) => p.days));

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How long one price has stayed as it is: { since, days } with `since` the date of its last change and `days`
 * counted from there to `newestIso`. `lastChange` is live-state's { fuel: { city: { date } | null } }. Null when
 * there is no usable date for that price, or the date is after the newest day.
 */
export function heldFor(lastChange, fuel, city, newestIso) {
  const since = lastChange?.[fuel]?.[city]?.date;
  if (typeof since !== 'string' || !ISO.test(since) || since > newestIso) return null;
  return { since, days: dayIndex(newestIso, since) };
}
