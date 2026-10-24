import { PPAC_TABLE_URL, PPAC_TERMS_URL, REPO_URL } from '../content/site';
import snapshot from '../generated/snapshot.json';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__row">
        <p>
          {snapshot.meta.attribution}. Prices are the figures in{' '}
          <a href={PPAC_TABLE_URL} rel="noopener noreferrer">
            PPAC&rsquo;s metro price table
          </a>
          , reused under PPAC&rsquo;s{' '}
          <a href={PPAC_TERMS_URL} rel="noopener noreferrer">
            terms
          </a>
          . This service is not run by PPAC or by any oil marketing company.
        </p>
        <p>
          <a href={REPO_URL} rel="noopener noreferrer">
            Source code on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
