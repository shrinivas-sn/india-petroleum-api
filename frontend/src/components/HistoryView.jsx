import { useMemo } from 'react';
import { formatCount, formatDate } from '../lib/format';
import { RANGES } from '../lib/range';
import { CITIES, cityName, dayIndex, stepPoints } from '../lib/series';
import { describeRows } from '../lib/summary';
import PriceChart from './PriceChart';

/**
 * The history chart's controls, chart and sentences for one `view` ({ city, window, rows }). It holds no
 * state and fetches nothing: HistoryChart owns both, and tests draw every state by passing props.
 *   loading  the selection changed and `view` is still the previous one
 *   problem  a message when the request for the selection failed, with `onRetry`
 *   fallback true when `view` is the build-time answer for the selection that failed
 */
export default function HistoryView({ rangeId, onRange, city, onCity, view, loading = false, problem = null, fallback = false, onRetry, markers = [] }) {
  const { rows } = view;
  const name = cityName(view.city);

  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const series = ['petrol', 'diesel']
      .map((fuel) => ({
        key: `${view.city}.${fuel}`,
        label: `${name} ${fuel}`,
        fuel,
        points: stepPoints(rows, (row) => row[fuel]?.[view.city], rows[0].date),
      }))
      .filter((s) => s.points.length > 0);
    if (!series.length) return null;
    const lastIndex = dayIndex(rows[rows.length - 1].date, rows[0].date);
    const shown =
      view.city === 'delhi'
        ? markers.map((m) => ({ ...m, index: dayIndex(m.date, rows[0].date) })).filter((m) => m.index >= 0 && m.index <= lastIndex)
        : [];
    return { series, lastIndex, markers: shown };
  }, [rows, view.city, name, markers]);

  const sentences = useMemo(() => describeRows(rows, view.city), [rows, view.city]);
  const span = rows.length
    ? `${formatDate(rows[0].date)} to ${formatDate(rows[rows.length - 1].date)}`
    : `${formatDate(view.window.from)} to ${formatDate(view.window.to)}`;

  return (
    <div className="history" aria-busy={loading}>
      <div className="chart-controls">
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button key={range.id} type="button" aria-pressed={range.id === rangeId} onClick={() => onRange(range.id)}>
              {range.label}
            </button>
          ))}
        </div>
        <label>
          City
          <select value={city} onChange={(event) => onCity(event.target.value)} autoComplete="off">
            {CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="chart-window muted" role="status">
        {name}, {span}, {formatCount(rows.length)} {rows.length === 1 ? 'day' : 'days'}
        {loading && ` · Loading ${cityName(city)}…`}
      </p>

      {problem && (
        <p className="notice notice--error" role="alert">
          <strong>CHART</strong> {problem}{' '}
          {fallback ? 'Showing the figures from the last build.' : `Still showing ${name}, ${span}.`}{' '}
          <button type="button" className="text-button" onClick={onRetry}>
            Try again
          </button>
        </p>
      )}

      <div className={loading ? 'is-loading' : undefined}>
        {chart ? (
          <PriceChart
            series={chart.series}
            firstIso={rows[0].date}
            lastIndex={chart.lastIndex}
            markers={chart.markers}
            title={`${name} petrol and diesel prices, rupees per litre`}
            description={`Step chart of ${name} petrol and diesel retail prices from ${formatDate(rows[0].date)} to ${formatDate(
              rows[rows.length - 1].date,
            )}. ${chart.markers.length ? 'Numbered points mark the largest single-day moves, listed below the chart.' : ''}`.trim()}
          />
        ) : (
          <p className="muted">{rows.length === 0 ? 'There are no prices in this range.' : 'A chart needs at least two days of prices in the range.'}</p>
        )}
      </div>

      {sentences.length > 0 && (
        <ul className="summary">
          {sentences.map((s) => (
            <li key={s.fuel} className={`summary__${s.fuel}`}>
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
