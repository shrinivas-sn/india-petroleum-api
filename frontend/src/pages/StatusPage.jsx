import { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { PPAC_TABLE_URL } from '../content/site';
import snapshot from '../generated/snapshot.json';
import { apiGet } from '../lib/api';
import { formatCount, formatDate, formatDateTime } from '../lib/format';
import { STALE_AFTER_DAYS, checkMeta } from '../lib/live-state';

const STEPS = [
  'A GitHub Actions job downloads PPAC’s metro price file (a PDF) and reads its text.',
  'It checks that every day from 16 June 2017 is present once and that no earlier price changed. If a check fails, the job stops and nothing is published.',
  'Otherwise it commits the new rows to the data files in the repository. The job runs every three hours, so a new day is picked up the same day it appears on PPAC’s site.',
  'The API fetches those files from the repository about every ten minutes and uses them only if they pass the same checks, so no redeploy is needed. It never contacts PPAC when you ask.',
];

export default function StatusPage() {
  const [live, setLive] = useState({ state: 'checking' });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [health, meta] = await Promise.all([
          apiGet('/health', { signal: controller.signal }),
          apiGet('/v1/meta', { signal: controller.signal }),
        ]);
        setLive({ state: 'up', healthMs: health.ms, meta: checkMeta(meta.body) });
      } catch (error) {
        if (error.name !== 'AbortError') setLive({ state: 'down', message: error.message });
      }
    })();
    return () => controller.abort();
  }, []);

  const meta = live.state === 'up' ? live.meta : snapshot.meta;
  const behind = live.state === 'up' ? live.meta.days_behind : null;
  const stale = behind !== null && behind > STALE_AFTER_DAYS;

  const badge =
    live.state === 'up' ? (
      <StatusBadge tone="ok">Operational</StatusBadge>
    ) : live.state === 'down' ? (
      <StatusBadge tone="bad">Not reachable</StatusBadge>
    ) : (
      <StatusBadge tone="idle">Checking</StatusBadge>
    );

  return (
    <div className="wrap section">
      <h1>Status</h1>
      <p className="measure">
        The service check runs in your browser against this site&rsquo;s own API.{' '}
        {live.state === 'up' ? 'The figures below are live.' : 'Until it answers, the figures are those from the last build.'}
      </p>

      <dl className="facts">
        <div>
          <dt>Service</dt>
          <dd>
            {badge}
            {live.state === 'up' && <span className="muted"> /health answered in {live.healthMs} ms</span>}
            {live.state === 'down' && <span className="muted"> {live.message}</span>}
          </dd>
        </div>
        <div>
          <dt>Newest price date</dt>
          <dd>{formatDate(meta.last_date)}</dd>
        </div>
        <div>
          <dt>Days behind</dt>
          <dd>
            {behind === null ? (
              <span className="muted">Known once the service answers</span>
            ) : (
              <>
                <span className="fact-count">{behind}</span> <StatusBadge tone={stale ? 'warn' : 'ok'}>{stale ? 'Stale' : 'Current'}</StatusBadge>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>PPAC table posted</dt>
          <dd>{formatDate(meta.source_posted_date)}</dd>
        </div>
        <div>
          <dt>Downloaded by this service</dt>
          <dd>{formatDateTime(meta.fetched_at)}</dd>
        </div>
        <div>
          <dt>Days stored</dt>
          <dd>
            {formatCount(meta.day_count)} ({formatDate(meta.first_date)} to {formatDate(meta.last_date)})
          </dd>
        </div>
        <div>
          <dt>Source file</dt>
          <dd>
            <a href={meta.source_url} rel="noopener noreferrer">
              PPAC PDF
            </a>{' '}
            <span className="muted">SHA-256 {meta.sha256.slice(0, 12)}…</span>
          </dd>
        </div>
      </dl>

      <p className="measure">
        Days behind counts calendar days in India between today and the newest price date. Up to {STALE_AFTER_DAYS} is
        normal around weekends and holidays; more means the daily job has stalled.
      </p>

      <h2>How the data gets here</h2>
      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="measure">
        The original table is on{' '}
        <a href={PPAC_TABLE_URL} rel="noopener noreferrer">
          PPAC&rsquo;s site
        </a>
        .
      </p>
    </div>
  );
}
