import { formatChange, formatDate, formatPrice } from '../lib/format';
import { CITIES, FUELS } from '../lib/series';

/** Latest price per city and fuel, with the size and date of the last move under each figure. */
export default function PriceBoard({ latest, lastMoves }) {
  return (
    <table className="board">
      <caption>Retail price in rupees per litre on {formatDate(latest.date)}</caption>
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
              const move = lastMoves[fuel.slug][city.slug];
              return (
                <td key={fuel.slug} className="num">
                  <span className="board__price">{formatPrice(latest[fuel.slug][city.slug])}</span>
                  <span className="board__since">
                    {move ? `Last change ${formatChange(move.to - move.from)} on ${formatDate(move.date)}` : 'No change on record'}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
