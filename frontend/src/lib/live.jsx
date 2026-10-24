import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import snapshot from '../generated/snapshot.json';
import { apiGet } from './api';
import { loadLive, offlineState, snapshotState } from './live-state';

// The pages start from the figures baked in at build time (also what the prerendered HTML holds),
// then ask the API for the current ones. Tests give a page a fake state through `LiveContext`.
const SNAPSHOT_STATE = snapshotState(snapshot);
const REFRESH_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

export const LiveContext = createContext({ state: SNAPSHOT_STATE, busy: false, retry: () => {} });

/** { state, busy, retry } where state is the snapshot, live or offline state of lib/live-state.js. */
export const useLiveData = () => useContext(LiveContext);

export function LiveDataProvider({ children }) {
  const [state, setState] = useState(SNAPSHOT_STATE);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const controller = useRef(null);
  const lastStart = useRef(0);

  const load = useCallback(async () => {
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    latest.current += 1;
    const id = latest.current;
    lastStart.current = Date.now();
    setBusy(true);
    try {
      const next = await loadLive(apiGet, { signal: mine.signal });
      if (id === latest.current) setState(next);
    } catch (error) {
      if (error.name === 'AbortError' || id !== latest.current) return;
      // A failed refresh keeps live figures that are already on screen; only the first load falls back to the build.
      setState((current) => (current.status === 'live' ? current : offlineState(SNAPSHOT_STATE, error.message)));
    } finally {
      if (id === latest.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    // A tab left open picks up a new day: every ten minutes while visible, and when it becomes visible again.
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastStart.current >= MIN_GAP_MS) load();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      controller.current?.abort();
    };
  }, [load]);

  const value = useMemo(() => ({ state, busy, retry: load }), [state, busy, load]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
