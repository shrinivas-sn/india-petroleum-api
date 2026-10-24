// Daily rows for one city over any date range, from the API. A range longer than the API allows in one
// request is fetched in contiguous parts and joined; if any part fails the whole call fails, so a
// chart is never drawn from half the days.
import { pricesPath } from './api.js';
import { chunks } from './range.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchHistory(get, { city, from, to, signal }) {
  const parts = await Promise.all(
    chunks(from, to).map((window) => get(pricesPath({ city, fuel: '', from: window.from, to: window.to }), { signal })),
  );
  const rows = [];
  for (const part of parts) {
    const data = part.body?.data;
    if (!Array.isArray(data) || data.some((row) => !row || !ISO.test(row.date))) {
      throw new Error('The API answered /v1/prices in an unexpected shape.');
    }
    rows.push(...data);
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
