import { formatDate, formatPrice } from '../lib/format';
import { FUELS, cityName, dayIndex, fuelName, stepPoints } from '../lib/series';
import CodeSnippet from './CodeSnippet';
import JsonViewer from './JsonViewer';
import PriceChart from './PriceChart';

const TABLE_ROWS = 100;
const MAX_CHART_SERIES = 4;

/** One entry per city and fuel present in the rows. */
function seriesOf(rows) {
  const first = rows[0];
  const out = [];
  FUELS.forEach((fuel) => {
    Object.keys(first[fuel.slug] ?? {}).forEach((city) => {
      out.push({ city, fuel: fuel.slug });
    });
  });
  return out;
}

function chartSeries(rows) {
  const all = seriesOf(rows);
  const cities = [...new Set(all.map((s) => s.city))];
  const shown = all.length > MAX_CHART_SERIES ? all.filter((s) => s.fuel === 'petrol') : all;
  return {
    truncated: shown.length < all.length,
    series: shown.map((s) => ({
      key: `${s.city}.${s.fuel}`,
      label: cities.length > 1 ? `${cityName(s.city)} ${s.fuel}` : fuelName(s.fuel),
      fuel: s.fuel,
      dash: cities.indexOf(s.city),
      points: stepPoints(rows, (row) => row[s.fuel]?.[s.city], rows[0].date),
    })),
  };
}

/**
 * What the playground got back: the request line, the chart beside a table that scrolls inside its own box
 * (newest day first), and the code samples folded away. It holds no state and fetches nothing.
 * `result` is { path, body, ms }; `ms` is null for the answer captured when the site was built.
 */
export default function PlaygroundResult({ result, loading = false, first, last, origin }) {
  const rows = result.body.data;
  const newestFirst = [...rows].reverse();
  const chart = rows.length > 1 ? chartSeries(rows) : null;
  const columns = rows.length ? seriesOf(rows) : [];
  const previewBody = rows.length > 5 ? { ...result.body, data: rows.slice(0, 5) } : result.body;

  return (
    <section aria-busy={loading} aria-label="Result">
      <h2 className="results-title">Result</h2>
      <p className="request-line">
        <code>GET {result.path}</code>
        <span className="muted">
          {' '}
          {rows.length.toLocaleString('en-IN')} {rows.length === 1 ? 'row' : 'rows'}
          {result.ms === null ? ', captured when the site was built' : `, ${result.ms} ms`}
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="muted">
          No days in that range. The stored data runs from {formatDate(first)} to {formatDate(last)}.
        </p>
      ) : (
        <div className="results">
          <div className="results__chart">
            {chart ? (
              <>
                <PriceChart
                  series={chart.series}
                  firstIso={rows[0].date}
                  lastIndex={dayIndex(rows[rows.length - 1].date, rows[0].date)}
                  title="Prices returned by the request, rupees per litre"
                  description={`Step chart of the ${rows.length} days returned, from ${formatDate(rows[0].date)} to ${formatDate(
                    rows[rows.length - 1].date,
                  )}.`}
                  height={240}
                />
                {chart.truncated && (
                  <p className="muted">The chart shows petrol only because eight lines are too many to read. The table has both fuels.</p>
                )}
              </>
            ) : (
              <p className="muted">A chart needs at least two days.</p>
            )}
          </div>

          <div className="results__table">
            <div className="table-scroll table-scroll--short" role="region" aria-label="Returned prices, newest first" tabIndex={0}>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    {columns.map((c) => (
                      <th key={`${c.city}.${c.fuel}`} scope="col" className="num">
                        {cityName(c.city)} {c.fuel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.slice(0, TABLE_ROWS).map((row) => (
                    <tr key={row.date}>
                      <th scope="row">{formatDate(row.date)}</th>
                      {columns.map((c) => (
                        <td key={`${c.city}.${c.fuel}`} className="num">
                          {formatPrice(row[c.fuel][c.city])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > TABLE_ROWS && (
              <p className="muted">
                The table shows the newest {TABLE_ROWS} of {rows.length.toLocaleString('en-IN')} rows; the response has all of them.
              </p>
            )}
          </div>
        </div>
      )}

      <details className="fold">
        <summary>Code samples and the raw response</summary>
        <div className="stack">
          <CodeSnippet label="curl" text={`curl "${origin}${result.path}"`} />
          <CodeSnippet
            label="JavaScript"
            text={`const res = await fetch('${origin}${result.path}');\nconst { data, meta } = await res.json();\nconsole.log(data.length, meta.attribution);`}
          />
          <JsonViewer
            value={previewBody}
            label={rows.length > 5 ? `Response (first 5 of ${rows.length.toLocaleString('en-IN')} rows)` : 'Response'}
            maxLines={30}
          />
        </div>
      </details>
    </section>
  );
}
