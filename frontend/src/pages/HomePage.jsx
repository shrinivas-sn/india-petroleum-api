import { Link } from 'react-router-dom';
import CodeSnippet from '../components/CodeSnippet';
import JsonViewer from '../components/JsonViewer';
import PriceBoard from '../components/PriceBoard';
import PriceChart from '../components/PriceChart';
import { PPAC_TABLE_URL } from '../content/site';
import snapshot from '../generated/snapshot.json';
import { formatChange, formatCount, formatDate } from '../lib/format';
import { cityName, dayIndex, fuelName } from '../lib/series';
import { useOrigin } from '../lib/site';

export default function HomePage() {
  const origin = useOrigin();
  const { latest, last_moves: lastMoves, chart, highlights, longest_flat: flat, meta, examples } = snapshot;

  const series = [
    { key: 'delhi.petrol', label: 'Delhi petrol', fuel: 'petrol', points: chart.series['delhi.petrol'] },
    { key: 'delhi.diesel', label: 'Delhi diesel', fuel: 'diesel', points: chart.series['delhi.diesel'] },
  ];
  const markers = highlights.map((h) => ({
    n: h.n,
    index: dayIndex(h.date, chart.first_date),
    series: h.moves.petrol ? 'delhi.petrol' : 'delhi.diesel',
  }));

  return (
    <>
      <section className="wrap hero">
        <div className="hero__text">
          <h1>Daily petrol and diesel prices for Delhi, Mumbai, Chennai and Kolkata, since June 2017</h1>
          <p className="lede">
            The figures are PPAC&rsquo;s published metro price table, stored as JSON. The API answers from those files
            and never calls PPAC when you ask, so it stays up when PPAC&rsquo;s site is slow. No key, no signup.
          </p>
          <p>
            <Link className="button" to="/playground">
              Try a request in the playground
            </Link>
          </p>
        </div>
        <PriceBoard latest={latest} lastMoves={lastMoves} />
      </section>

      <section className="wrap section">
        <h2>Delhi since {formatDate(meta.first_date)}</h2>
        <p className="measure">
          Prices have been revised daily since June 2017, but they have not moved every day. The longest stretch without
          a change to either Delhi price is {formatCount(flat.days)} days, from {formatDate(flat.from)} to{' '}
          {formatDate(flat.to)}, with petrol at {flat.petrol.toFixed(2)} and diesel at {flat.diesel.toFixed(2)} throughout.
        </p>
        <PriceChart
          series={series}
          firstIso={chart.first_date}
          lastIndex={chart.last_index}
          markers={markers}
          title="Delhi petrol and diesel prices, rupees per litre"
          description={`Step chart of Delhi petrol and diesel retail prices from ${formatDate(meta.first_date)} to ${formatDate(
            meta.last_date,
          )}. Numbered points mark the largest single-day moves, listed below the chart.`}
        />
        <ol className="moves">
          {highlights.map((h) => (
            <li key={h.n}>
              <span className="moves__n" aria-hidden="true">
                {h.n}
              </span>
              <span className="moves__date">{formatDate(h.date)}</span>
              <span>
                {Object.entries(h.moves)
                  .map(
                    ([fuel, m]) =>
                      `${cityName(h.city)} ${fuelName(fuel).toLowerCase()} ${m.from.toFixed(2)} to ${m.to.toFixed(2)} (${formatChange(m.change)})`,
                  )
                  .join('; ')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap section">
        <h2>One request</h2>
        <p className="measure">
          <code>/v1/prices/latest</code> returns the newest day. Every answer carries the attribution and the date PPAC
          posted the table it came from. The <Link to="/docs">reference</Link> covers the other endpoints.
        </p>
        <div className="stack">
          <CodeSnippet label="curl" text={`curl "${origin}/v1/prices/latest"`} />
          <JsonViewer value={examples.latest.body} label="Response from the build" maxLines={22} />
        </div>
      </section>

      <section className="wrap section">
        <h2>What is in it, and what is not</h2>
        <div className="split">
          <div>
            <h3>Covered</h3>
            <ul className="plain">
              <li>Petrol and diesel retail prices for Delhi, Mumbai, Chennai and Kolkata</li>
              <li>
                A row for each of {formatCount(meta.day_count)} days, {formatDate(meta.first_date)} to{' '}
                {formatDate(meta.last_date)}
              </li>
              <li>Every price change, with the price before and after</li>
              <li>The PPAC attribution and posting date on every response</li>
            </ul>
          </div>
          <div>
            <h3>Not covered</h3>
            <ul className="plain">
              <li>Other cities, which PPAC&rsquo;s table does not list</li>
              <li>LPG, CNG and other fuels</li>
              <li>Tax, dealer commission or state-wise breakdowns</li>
              <li>Dates before 16 June 2017, when daily pricing began</li>
              <li>Petroleum consumption, production and trade statistics</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2>Where the numbers come from</h2>
        <p className="measure">
          Everything here is read from{' '}
          <a href={PPAC_TABLE_URL} rel="noopener noreferrer">
            PPAC&rsquo;s table of petrol and diesel prices in the metro cities
          </a>
          . A footnote on the table says the prices are Indian Oil Corporation&rsquo;s retail selling prices, and that a
          daily change applies from 6:00 AM. The date in each row is PPAC&rsquo;s Date of Revision, copied as printed.
          The <Link to="/status">status page</Link> shows how current the stored data is.
        </p>
      </section>
    </>
  );
}
