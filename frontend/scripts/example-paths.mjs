// The API requests the docs and the snapshot show, all counted back from the newest stored day so the
// examples move with the data. build-snapshot.mjs sends them to the real backend and keeps its answers.
import { exampleWindow, windowFor } from '../src/lib/range.js';

export function examplePaths({ first_date: first, last_date: last }) {
  const week = exampleWindow(last, 7);
  const month = exampleWindow(last, 30);
  const year = exampleWindow(last, 365);
  const fiveDays = exampleWindow(last, 5);
  const board = exampleWindow(last, 31);
  const quarter = windowFor('3m', first, last);
  return {
    latest: '/v1/prices/latest',
    range: `/v1/prices?city=delhi&from=${week.from}&to=${week.to}`,
    changes: `/v1/prices/changes?city=delhi&fuel=petrol&from=${year.from}&to=${year.to}`,
    cities: '/v1/cities',
    meta: '/v1/meta',
    health: '/health',
    missingParam: '/v1/prices?city=delhi',
    unknownFuel: `/v1/prices?city=delhi&fuel=kerosene&from=${fiveDays.from}&to=${fiveDays.to}`,
    // First paint of the price board (31 days, every city), the playground (30 days) and the home chart (3 months), until the API answers.
    board: `/v1/prices?from=${board.from}&to=${board.to}`,
    playground: `/v1/prices?city=delhi&from=${month.from}&to=${month.to}`,
    recent: `/v1/prices?city=delhi&from=${quarter.from}&to=${quarter.to}`,
  };
}
