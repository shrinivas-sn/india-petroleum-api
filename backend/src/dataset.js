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

const isRealDate = (value) => typeof value === 'string' && DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < MAX_PRICE;
const fail = (message) => {
  throw new DatasetError(message);
};

/**
 * Throws a DatasetError naming the first problem. `current` is the meta of the data already in memory:
 * a dataset that ends before it is refused, so the API never goes backwards.
 */
export function validateDataset({ days, moves, meta }, { current = null } = {}) {
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

  const first = days[0].date;
  const last = days.at(-1).date;
  if (meta.first_date !== first || meta.last_date !== last || meta.day_count !== days.length) {
    fail(`meta.json and daily.json disagree (meta says ${meta.first_date} to ${meta.last_date}, ${meta.day_count} days; daily has ${first} to ${last}, ${days.length} days)`);
  }

  const fuels = new Set(FUELS);
  const cities = new Set(CITY_SLUGS);
  for (const [i, move] of moves.entries()) {
    if (!move || !isRealDate(move.date) || move.date < first || move.date > last) fail(`change ${i} has a date outside the stored days`);
    if (!fuels.has(move.fuel) || !cities.has(move.city)) fail(`change ${i} names an unknown fuel or city`);
    if (!isPrice(move.from) || !isPrice(move.to)) fail(`change ${i} has an invalid price`);
  }

  if (current?.last_date && last < current.last_date) {
    fail(`the repository's data ends ${last}, older than the ${current.last_date} already loaded`);
  }
}
