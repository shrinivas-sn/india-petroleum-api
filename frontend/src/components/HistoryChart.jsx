import { useEffect, useMemo, useRef, useState } from 'react';
import snapshot from '../generated/snapshot.json';
import { apiGet } from '../lib/api';
import { fetchHistory } from '../lib/history';
import { useLiveData } from '../lib/live';
import { windowFor } from '../lib/range';
import HistoryView from './HistoryView';

// First paint and fallback: the API's own answer for Delhi's last three months, captured at build time.
const FIRST_PAINT = snapshot.examples.recent.body;
const FIRST_VIEW = {
  key: `delhi|${FIRST_PAINT.meta.from}|${FIRST_PAINT.meta.to}`,
  city: 'delhi',
  window: { from: FIRST_PAINT.meta.from, to: FIRST_PAINT.meta.to },
  rows: FIRST_PAINT.data,
};

/**
 * Step chart of one city's petrol and diesel for the last 3 months, 1 year or all stored days. Every
 * range is read from the API and counted back from the newest day it reports; a selection already
 * loaded is kept, and while a new one loads the previous chart stays up under its own labels.
 * `markers` are the numbered largest moves (Delhi); one shows only when its date is inside the range.
 */
export default function HistoryChart({ markers = [] }) {
  const { state } = useLiveData();
  const { first_date: first, last_date: last } = state.meta;
  const [city, setCity] = useState('delhi');
  const [rangeId, setRangeId] = useState('3m');
  const [view, setView] = useState(FIRST_VIEW);
  const [problem, setProblem] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map());

  const period = useMemo(() => windowFor(rangeId, first, last), [rangeId, first, last]);
  const key = `${city}|${period.from}|${period.to}`;

  useEffect(() => {
    const hit = cache.current.get(key);
    if (hit) {
      setProblem(null);
      setView({ key, city, window: period, rows: hit });
      return undefined;
    }
    const controller = new AbortController();
    setProblem(null);
    fetchHistory(apiGet, { city, from: period.from, to: period.to, signal: controller.signal })
      .then((rows) => {
        cache.current.set(key, rows);
        setView({ key, city, window: period, rows });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setProblem({ key, message: error.message });
      });
    return () => controller.abort();
    // `city` and `period` are folded into `key`; `attempt` re-runs a failed request.
  }, [key, attempt]);

  const failed = problem?.key === key;
  return (
    <HistoryView
      rangeId={rangeId}
      onRange={setRangeId}
      city={city}
      onCity={setCity}
      view={view}
      loading={view.key !== key && !failed}
      problem={failed ? problem.message : null}
      fallback={failed && view.key === key}
      onRetry={() => setAttempt((n) => n + 1)}
      markers={markers}
    />
  );
}
