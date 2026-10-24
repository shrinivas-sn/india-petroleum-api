import { useEffect, useId, useRef, useState } from 'react';
import { niceScale, stepPath, timeTicks, valueAt } from '../lib/chart';
import { formatDate, formatPrice } from '../lib/format';
import { addDays } from '../lib/series';

const MARGIN = { top: 14, right: 24, bottom: 30, left: 46 };
const DASHES = [undefined, '8 4', '2 4', '10 3 2 3'];

/**
 * Step chart of daily prices. Each series is { key, label, fuel, dash?, points } where points
 * are [dayIndex, price] change points (see lib/series.js). Colour carries the fuel, the dash
 * pattern carries the city when several cities share a chart.
 */
export default function PriceChart({ series, firstIso, lastIndex, markers = [], title, description, height = 300 }) {
  const frame = useRef(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState(null);
  const id = useId();

  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const measure = () => setWidth(Math.max(260, Math.round(element.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const prices = series.flatMap((s) => s.points.map((p) => p[1]));
  const yScale = niceScale(Math.min(...prices), Math.max(...prices));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const x = (index) => MARGIN.left + (lastIndex === 0 ? 0 : (index / lastIndex) * plotWidth);
  const y = (price) => MARGIN.top + (1 - (price - yScale.min) / (yScale.max - yScale.min)) * plotHeight;
  const xTicks = timeTicks(firstIso, lastIndex, Math.max(3, Math.floor(plotWidth / 90)));

  const onMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - box.left - MARGIN.left) / plotWidth) * lastIndex);
    setHover(index < 0 || index > lastIndex ? null : index);
  };

  return (
    <figure className="chart" ref={frame}>
      <ul className="legend">
        {series.map((s) => (
          <li key={s.key}>
            <svg width="30" height="10" aria-hidden="true">
              <line className={`line line--${s.fuel}`} x1="1" x2="29" y1="5" y2="5" strokeDasharray={DASHES[s.dash ?? 0]} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>{description}</desc>
        {yScale.ticks.map((tick) => (
          <g key={tick}>
            <line className="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis" x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {tick}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={tick.index}>
            <line className="grid grid--x" x1={x(tick.index)} x2={x(tick.index)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
            <text className="axis" x={x(tick.index)} y={height - 8} textAnchor="middle">
              {tick.label}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.key} className={`line line--${s.fuel}`} d={stepPath(s.points, lastIndex, x, y)} strokeDasharray={DASHES[s.dash ?? 0]} />
        ))}
        {markers.map((marker) => {
          const owner = series.find((s) => s.key === marker.series) ?? series[0];
          const price = valueAt(owner.points, marker.index);
          if (price === undefined) return null;
          return (
            <g key={marker.n} className="marker" transform={`translate(${x(marker.index)} ${y(price)})`}>
              <circle r="10" />
              <text textAnchor="middle" dominantBaseline="central">
                {marker.n}
              </text>
            </g>
          );
        })}
        {hover !== null && (
          <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
        )}
      </svg>
      <figcaption className="chart__readout">
        {hover === null
          ? 'Move across the chart to read a day.'
          : `${formatDate(addDays(firstIso, hover))}: ${series
              .map((s) => {
                const price = valueAt(s.points, hover);
                return `${s.label} ${price === undefined ? 'no data' : formatPrice(price)}`;
              })
              .join(', ')}`}
      </figcaption>
    </figure>
  );
}
