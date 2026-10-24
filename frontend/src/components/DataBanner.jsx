import { Link } from 'react-router-dom';
import { useLiveData } from '../lib/live';
import { bannerFor } from '../lib/live-state';
import StatusBadge from './StatusBadge';

/** Sitewide notice under the header: prices more than two days old, or live data that could not be loaded. */
export default function DataBanner() {
  const { state, busy, retry } = useLiveData();
  const banner = bannerFor(state);
  if (!banner) return null;
  return (
    <div className={`data-banner data-banner--${banner.kind}`} role="status">
      <div className="wrap data-banner__row">
        <p>
          <StatusBadge tone="warn">{banner.title}</StatusBadge> {banner.message}
          {banner.detail && <span className="muted"> {banner.detail}</span>}
        </p>
        {banner.retry ? (
          <button type="button" className="text-button" onClick={retry} disabled={busy}>
            {busy ? 'Trying…' : 'Try again'}
          </button>
        ) : (
          <Link to="/status">Status page</Link>
        )}
      </div>
    </div>
  );
}
