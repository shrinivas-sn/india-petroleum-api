import { formatChange, formatDate, formatPrice } from '../lib/format';
import { PERIODS } from '../lib/recent';
import { CITIES, FUELS } from '../lib/series';

/**
 * Today's price per city and fuel, with the change over the last 1, 7 and 30 days under each figure.
 * `changes` is lib/recent.js's changesOver(); when it is null the board shows today's prices alone.
 */
export default function PriceBoard({ latest, changes }) {
  return (
    <table className="board">
      <caption>
        Retail price in rupees per litre on {formatDate(latest.date)}
        {changes ? '. Under each price: the change over the last 1, 7 and 30 days.' : ''}
      </caption>
      <thead>
        <tr>
          <th scope="col">City</th>
          {FUELS.map((fuel) => (
            <th key={fuel.slug} scope="col" className={`num board__fuel board__fuel--${fuel.slug}`}>
              {fuel.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CITIES.map((city) => (
          <tr key={city.slug}>
            <th scope="row">{city.name}</th>
            {FUELS.map((fuel) => (
              <td key={fuel.slug} className="num">
                <span className="board__price">{formatPrice(latest[fuel.slug][city.slug])}</span>
                {changes && (
                  <dl className="board__changes">
                    {PERIODS.map((period) => {
                      const delta = changes[fuel.slug]?.[city.slug]?.[period.id];
                      return (
                        <div key={period.id}>
                          <dt>{period.label}</dt>
                          <dd>{delta === null || delta === undefined ? '–' : formatChange(delta)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
