import { useEffect, useRef, useState } from 'react';
import PlaygroundResult from '../components/PlaygroundResult';
import snapshot from '../generated/snapshot.json';
import { ApiError, apiGet, pricesPath } from '../lib/api';
import { useLiveData } from '../lib/live';
import { exampleWindow, windowFor } from '../lib/range';
import { CITIES, FUELS } from '../lib/series';
import { useOrigin } from '../lib/site';

// Every window is counted back from the newest day the API reports, never typed in.
const defaultFields = (last) => ({ city: 'delhi', fuel: '', ...exampleWindow(last, 30) });
const presetsFor = (first, last) => [
  { label: 'Delhi, last 30 days', fields: defaultFields(last) },
  { label: 'All four cities, last 7 days', fields: { city: '', fuel: '', ...exampleWindow(last, 7) } },
  { label: 'Delhi petrol, last 12 months', fields: { city: 'delhi', fuel: 'petrol', ...windowFor('1y', first, last) } },
];

// What the page shows until the API has answered: the real answer for the default request, captured at build time.
const FIRST_PAINT = {
  path: snapshot.examples.playground.path,
  body: snapshot.examples.playground.body,
  ms: null,
};

export default function PlaygroundPage() {
  const origin = useOrigin();
  const { state } = useLiveData();
  const { first_date: first, last_date: last } = state.meta;
  const [fields, setFields] = useState(() => defaultFields(last));
  const [result, setResult] = useState(FIRST_PAINT);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef(null);
  const edited = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(next, { auto = false } = {}) {
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
      // The first automatic request failing is not the visitor's mistake: the sitewide banner says the API is
      // unreachable and the build-time answer stays on screen.
      if (auto) return;
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

  // Until the visitor changes a field, the form follows the newest day: it loads the live answer on arrival,
  // and again if the API reports a newer day than the build knew about.
  useEffect(() => {
    if (edited.current) return;
    const next = defaultFields(last);
    setFields(next);
    run(next, { auto: true });
  }, [last]);

  const set = (name) => (event) => {
    edited.current = true;
    setFields((current) => ({ ...current, [name]: event.target.value }));
  };

  const applyPreset = (preset) => {
    edited.current = true;
    setFields(preset.fields);
    run(preset.fields);
  };

  return (
    <div className="wrap section playground">
      <div className="playground__head">
        <h1>Playground</h1>
        <p className="measure">Pick a city, a fuel and a date range. The request goes to this site&rsquo;s own API.</p>
      </div>

      <form
        className="query"
        onSubmit={(event) => {
          event.preventDefault();
          run(fields);
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
          <input type="date" value={fields.from} min={first} max={last} onChange={set('from')} autoComplete="off" required />
        </label>
        <label>
          To
          <input type="date" value={fields.to} min={first} max={last} onChange={set('to')} autoComplete="off" required />
        </label>
        <button type="submit" className="button" disabled={loading}>
          {loading ? 'Running…' : 'Run request'}
        </button>
      </form>

      <p className="presets">
        Examples:{' '}
        {presetsFor(first, last).map((preset) => (
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

      <PlaygroundResult result={result} loading={loading} first={first} last={last} origin={origin} />
    </div>
  );
}
