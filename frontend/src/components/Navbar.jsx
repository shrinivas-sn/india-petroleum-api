import { Link, NavLink } from 'react-router-dom';
import { SITE_NAME } from '../content/site';

const LINKS = [
  ['/docs', 'Docs'],
  ['/playground', 'Playground'],
  ['/guides', 'Guides'],
  ['/status', 'Status'],
];

export default function Navbar() {
  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Link to="/" className="wordmark">
          {SITE_NAME}
        </Link>
        <nav aria-label="Main">
          <ul className="site-nav">
            {LINKS.map(([to, label]) => (
              <li key={to}>
                <NavLink to={to}>{label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
