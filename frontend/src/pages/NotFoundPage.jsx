import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="wrap section">
      <h1>This page does not exist</h1>
      <p className="measure">
        The address may be mistyped or the page may have moved. These pages do exist:
      </p>
      <ul className="plain">
        <li>
          <Link to="/docs">API reference</Link>
        </li>
        <li>
          <Link to="/playground">Playground</Link>
        </li>
        <li>
          <Link to="/guides">Guides</Link>
        </li>
        <li>
          <Link to="/status">Status</Link>
        </li>
      </ul>
    </div>
  );
}
