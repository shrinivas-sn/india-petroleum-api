import { formatChange, formatCount, formatDate, formatPrice } from '../lib/format';
import { HOLD_NOTICE_DAYS, PERIODS, heldFor } from '../lib/recent';
import { CITIES, FUELS } from '../lib/series';

/**
 * Today's price per city and fuel. Under each figure: how long it has stayed the same once that is 30 days or
 * more (a row of 0.00 says less), otherwise the change over the last 1, 7 and 30 days.
 * `changes` is lib/recent.js's changesOver() and `lastChange` is the live state's; with neither the board shows
 * today's prices alone.
 */
export default function PriceBoard({ latest, changes, lastChange }) {
  const held = (fuel, city) => {
    const found = heldFor(lastChange, fuel, city, latest.date);
    return found && found.days >= HOLD_NOTICE_DAYS ? found : null;
  };
  const cells = FUELS.flatMap((fuel) => CITIES.map((city) => held(fuel.slug, city.slug)));
  const anyHeld = cells.some(Boolean);
  const anyChange = Boolean(changes) && cells.some((cell) => !cell);
  let note = '';
  if (anyHeld && anyChange)
    note = '. Under each price: how long it has stayed the same, or its change over the last 1, 7 and 30 days.';
  else if (anyHeld) note = '. Under each price: how long it has stayed the same.';
  else if (anyChange) note = '. Under each price: the change over the last 1, 7 and 30 days.';
  return (
    <table className="board">
      <caption>
        Retail price in rupees per litre on {formatDate(latest.date)}
        {note}
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
            {FUELS.map((fuel) => {
              const hold = held(fuel.slug, city.slug);
              return (
                <td key={fuel.slug} className="num">
                  <span className="board__price">{formatPrice(latest[fuel.slug][city.slug])}</span>
                  {hold && (
                    <p className="board__held">
                      Unchanged for {formatCount(hold.days)} days
                      <span>since {formatDate(hold.since)}</span>
                    </p>
                  )}
                  {!hold && changes && (
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
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
