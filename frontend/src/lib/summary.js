// The chart in words, for readers who cannot see it and for a window in which nothing moved (a flat
// line is true, and still needs saying). One sentence per fuel, from the rows the chart is drawn from.
import { formatDate, formatPrice } from './format.js';
import { FUELS, cityName } from './series.js';

/** [{ fuel, text }] for the city's petrol and diesel in `rows`; a fuel with no values gets no sentence. */
export function describeRows(rows, city) {
  const out = [];
  for (const fuel of FUELS) {
    const days = rows.filter((row) => typeof row[fuel.slug]?.[city] === 'number').map((row) => ({ date: row.date, price: row[fuel.slug][city] }));
    if (!days.length) continue;
    const name = `${cityName(city)} ${fuel.slug}`;
    const first = days[0];
    const last = days[days.length - 1];
    let latestChange = null;
    let changes = 0;
    for (let i = 1; i < days.length; i += 1) {
      if (days[i].price !== days[i - 1].price) {
        changes += 1;
        latestChange = days[i].date;
      }
    }
    let text;
    if (days.length === 1) {
      text = `${name} was ${formatPrice(first.price)} on ${formatDate(first.date)}.`;
    } else if (changes === 0) {
      text = `${name} held at ${formatPrice(first.price)} on all ${days.length} days shown, with no revision.`;
    } else {
      const counted = `${changes} ${changes === 1 ? 'revision' : 'revisions'}`;
      const latest = `the latest on ${formatDate(latestChange)}`;
      if (last.price === first.price) {
        text = `${name} ended at ${formatPrice(last.price)}, where it started, after ${counted}, ${latest}.`;
      } else {
        const verb = last.price > first.price ? 'rose' : 'fell';
        text = `${name} ${verb} from ${formatPrice(first.price)} to ${formatPrice(last.price)} over ${counted}, ${latest}.`;
      }
    }
    out.push({ fuel: fuel.slug, text });
  }
  return out;
}
