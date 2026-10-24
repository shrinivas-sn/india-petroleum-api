// Pure functions that turn the stored fuel data (data/fuel/*.json) into the numbers the
// portal shows. Nothing here reads files or the network: build-snapshot.mjs feeds it.
import { CITY_SLUGS as CITIES, FUEL_SLUGS as FUELS, dayIndex } from '../src/lib/series.js';

export { CITIES, FUELS, dayIndex };

const DAY_MS = 86400000;
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

/** The longest run of days on which none of the city's prices (petrol or diesel) changed. */
export function longestFlat(days, city) {
  let best = { days: 0, from: null, to: null };
  let start = 0;
  const same = (a, b) => FUELS.every((f) => a[f][city] === b[f][city]);
  for (let i = 1; i <= days.length; i += 1) {
    if (i === days.length || !same(days[i], days[start])) {
      const length = i - start;
      if (length > best.days) best = { days: length, from: days[start].date, to: days[i - 1].date };
      start = i;
    }
  }
  const startDay = days.find((d) => d.date === best.from);
  return { ...best, petrol: startDay?.petrol[city] ?? null, diesel: startDay?.diesel[city] ?? null };
}

/** Per fuel and city, the most recent change: { date, from, to }, or null if it never changed. */
export function lastMoves(moves) {
  const out = {};
  for (const fuel of FUELS) {
    out[fuel] = {};
    for (const city of CITIES) {
      const found = [...moves].reverse().find((m) => m.fuel === fuel && m.city === city);
      out[fuel][city] = found ? { date: found.date, from: found.from, to: found.to } : null;
    }
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The largest Delhi moves, one per date, at least `gapDays` apart (the larger one wins), oldest
 * first. Used to number points on the home chart; each carries both fuels' moves on that date.
 */
export function highlights(moves, { city = 'delhi', count = 4, gapDays = 120 } = {}) {
  const byDate = new Map();
  for (const m of moves) {
    if (m.city !== city) continue;
    const entry = byDate.get(m.date) ?? { date: m.date, size: 0, moves: {} };
    entry.moves[m.fuel] = { from: m.from, to: m.to, change: round2(m.to - m.from) };
    entry.size = Math.max(entry.size, Math.abs(m.to - m.from));
    byDate.set(m.date, entry);
  }
  const chosen = [];
  for (const entry of [...byDate.values()].sort((a, b) => b.size - a.size || (a.date < b.date ? -1 : 1))) {
    if (chosen.length === count) break;
    if (chosen.every((c) => Math.abs(dayMs(c.date) - dayMs(entry.date)) / DAY_MS >= gapDays)) chosen.push(entry);
  }
  return chosen.sort((a, b) => (a.date < b.date ? -1 : 1)).map(({ date, moves: m }, i) => ({ n: i + 1, date, city, moves: m }));
}

/** Days with at least one price change, per calendar year. */
export function revisionDaysByYear(moves) {
  const seen = new Map();
  for (const m of moves) {
    const year = m.date.slice(0, 4);
    if (!seen.has(year)) seen.set(year, new Set());
    seen.get(year).add(m.date);
  }
  return Object.fromEntries([...seen].map(([year, dates]) => [year, dates.size]));
}

// No price history is stored here: the home chart reads its rows from the API. `examples.recent` (the
// last three months for Delhi, the API's own answer) is only the first paint and the fallback.
export function buildSnapshot({ days, moves, meta, examples = {} }) {
  return {
    meta: {
      first_date: meta.first_date,
      last_date: meta.last_date,
      day_count: meta.day_count,
      source_posted_date: meta.source_posted_date,
      fetched_at: meta.fetched_at,
      attribution: meta.attribution,
      source_url: meta.source_url,
      sha256: meta.sha256,
    },
    latest: days[days.length - 1],
    previous: days.length > 1 ? days[days.length - 2] : null,
    last_moves: lastMoves(moves),
    highlights: highlights(moves),
    longest_flat: longestFlat(days, 'delhi'),
    revision_days_by_year: revisionDaysByYear(moves),
    examples,
  };
}
