import { useEffect, useRef, useState } from 'react';
import CodeSnippet from '../components/CodeSnippet';
import JsonViewer from '../components/JsonViewer';
import PriceChart from '../components/PriceChart';
import snapshot from '../generated/snapshot.json';
import { ApiError, apiGet, pricesPath } from '../lib/api';
import { formatDate, formatPrice } from '../lib/format';
import { CITIES, FUELS, addDays, cityName, dayIndex, fuelName, stepPoints } from '../lib/series';
import { useOrigin } from '../lib/site';

const { first_date: FIRST, last_date: LAST } = snapshot.meta;
const TABLE_ROWS = 100;
const MAX_CHART_SERIES = 4;

const PRESETS = [
  { label: 'Delhi around the 22 May 2022 cut', fields: { city: 'delhi', fuel: '', from: '2022-05-15', to: '2022-05-29' } },
  { label: 'Delhi petrol in 2021', fields: { city: 'delhi', fuel: 'petrol', from: '2021-01-01', to: '2021-12-31' } },
  { label: 'All four cities, last 90 days', fields: { city: '', fuel: '', from: addDays(LAST, -89), to: LAST } },
];

const INITIAL = PRESETS[0].fields;
const INITIAL_RESULT = {
  path: snapshot.examples.range.path,
  body: snapshot.examples.range.body,
  ms: null,
};

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

export default function PlaygroundPage() {
  const origin = useOrigin();
  const [fields, setFields] = useState(INITIAL);
  const [result, setResult] = useState(INITIAL_RESULT);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  const set = (name) => (event) => setFields((current) => ({ ...current, [name]: event.target.value }));

  async function run(next = fields) {
    setError(null);
    if (!next.from || !next.to) {
      setError({ code: 'MISSING_PARAM', message: 'Choose both a first and a last date.' });
      return;
    }
    if (next.from > next.to) {
      setError({ code: 'INVALID_RANGE', message: `The first date (${next.from}) is after the last date (${next.to}).` });
      return;
    }
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    const path = pricesPath(next);
    try {
      const { body, ms } = await apiGet(path, { signal: controller.current.signal });
      setResult({ path, body, ms });
    } catch (failure) {
      if (failure.name === 'AbortError') return;
      const apiError = failure instanceof ApiError ? failure : new ApiError(failure.message);
      setError({
        code: apiError.code,
        message:
          apiError.retryAfterSeconds && apiError.status === 429
            ? `${apiError.message} Try again in ${apiError.retryAfterSeconds} seconds.`
            : apiError.message,
      });
    } finally {
      setLoading(false);
    }
  }

  const applyPreset = (preset) => {
    setFields(preset.fields);
    run(preset.fields);
  };

  const rows = result.body.data;
  const chart = rows.length > 1 ? chartSeries(rows) : null;
  const columns = rows.length ? seriesOf(rows) : [];
  const previewBody = rows.length > 5 ? { ...result.body, data: rows.slice(0, 5) } : result.body;

  return (
    <div className="wrap section">
      <h1>Playground</h1>
      <p className="measure">
        Pick a city, a fuel and a date range. The page sends the request to this site&rsquo;s own API and shows what
        came back, with the same request as a command you can copy.
      </p>

      <form
        className="query"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <label>
          City
          <select value={fields.city} onChange={set('city')} autoComplete="off">
            <option value="">All four</option>
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fuel
          <select value={fields.fuel} onChange={set('fuel')} autoComplete="off">
            <option value="">Petrol and diesel</option>
            {FUELS.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={fields.from} min={FIRST} max={LAST} onChange={set('from')} autoComplete="off" required />
        </label>
        <label>
          To
          <input type="date" value={fields.to} min={FIRST} max={LAST} onChange={set('to')} autoComplete="off" required />
        </label>
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Running…' : 'Run request'}
        </button>
      </form>

      <p className="presets">
        Examples:{' '}
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="text-button" onClick={() => applyPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </p>

      {error && (
        <p className="notice notice--error" role="alert">
          <strong>{error.code}</strong> {error.message}
        </p>
      )}

      <section aria-busy={loading} aria-label="Result">
        <h2>Result</h2>
        <p className="request-line">
          <code>GET {result.path}</code>
          <span className="muted">
            {' '}
            {rows.length.toLocaleString('en-IN')} {rows.length === 1 ? 'row' : 'rows'}
            {result.ms === null ? ', captured when the site was built' : `, ${result.ms} ms`}
          </span>
        </p>

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
              height={280}
            />
            {chart.truncated && (
              <p className="muted">The chart shows petrol only because eight lines are too many to read. The table has both fuels.</p>
            )}
          </>
        ) : (
          <p className="muted">A chart needs at least two days.</p>
        )}

        {rows.length > 0 && (
          <div className="table-scroll table-scroll--narrow" role="region" aria-label="Returned prices" tabIndex={0}>
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
                {rows.slice(0, TABLE_ROWS).map((row) => (
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
        )}
        {rows.length > TABLE_ROWS && (
          <p className="muted">
            The table shows the first {TABLE_ROWS} of {rows.length.toLocaleString('en-IN')} rows; the response has all of
            them.
          </p>
        )}

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
      </section>
    </div>
  );
}
