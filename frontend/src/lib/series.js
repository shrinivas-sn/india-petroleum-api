// Shared by the browser and the build scripts: the cities and fuels the API serves, and the
// conversion of daily rows into step-change points (prices only move on a revision day).
export const CITIES = [
  { slug: 'delhi', name: 'Delhi' },
  { slug: 'mumbai', name: 'Mumbai' },
  { slug: 'chennai', name: 'Chennai' },
  { slug: 'kolkata', name: 'Kolkata' },
];
export const FUELS = [
  { slug: 'petrol', name: 'Petrol' },
  { slug: 'diesel', name: 'Diesel' },
];
export const CITY_SLUGS = CITIES.map((c) => c.slug);
export const FUEL_SLUGS = FUELS.map((f) => f.slug);
export const cityName = (slug) => CITIES.find((c) => c.slug === slug)?.name ?? slug;
export const fuelName = (slug) => FUELS.find((f) => f.slug === slug)?.name ?? slug;

const DAY_MS = 86400000;
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function dayIndex(iso, firstIso) {
  return Math.round((dayMs(iso) - dayMs(firstIso)) / DAY_MS);
}

export function addDays(iso, n) {
  return new Date(dayMs(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * [[dayIndex, price], ...] with one point per price change, starting at the first row that
 * has a value. `value(row)` returns the price or undefined when the row has none.
 */
export function stepPoints(rows, value, firstIso = rows[0]?.date) {
  const points = [];
  let last;
  for (const row of rows) {
    const price = value(row);
    if (price === undefined || price === null) continue;
    if (price !== last) {
      points.push([dayIndex(row.date, firstIso), price]);
      last = price;
    }
  }
  return points;
}
