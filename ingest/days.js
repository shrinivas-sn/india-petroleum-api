// Joins the parser's per-fuel rows into one object per date, oldest first.
const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];

const prices = (row) => Object.fromEntries(CITIES.map((c) => [c, row[c]]));

export function toDays({ petrol, diesel }) {
  const byDate = new Map(diesel.map((r) => [r.date, r]));
  if (petrol.length !== diesel.length || petrol.some((r) => !byDate.has(r.date))) {
    throw new Error('petrol and diesel do not cover the same dates');
  }
  return petrol
    .map((p) => ({ date: p.date, petrol: prices(p), diesel: prices(byDate.get(p.date)) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export { CITIES };
