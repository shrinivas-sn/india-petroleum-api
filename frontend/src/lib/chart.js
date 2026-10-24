// Chart maths with no DOM in it: nice axis ticks, calendar ticks, and the SVG path of a
// step series (a price holds until the next revision day).
import { addDays, dayIndex } from './series.js';

/** Axis bounds and tick values that fall on round numbers. */
export function niceScale(min, max, target = 5) {
  if (!(max > min)) {
    const pad = Math.abs(min) * 0.05 || 1;
    return niceScale(min - pad, max + pad, target);
  }
  // Smallest round step that keeps the tick count within `target + 3`.
  const raw = (max - min) / (target + 2);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10, 20].map((m) => m * power).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, ticks };
}

/**
 * Calendar ticks for an x axis counted in days from `firstIso`. Whole years when the span is
 * long, months when it is a few months, otherwise days; labels are thinned to fit `maxTicks`.
 */
export function timeTicks(firstIso, lastIndex, maxTicks = 8) {
  const lastIso = addDays(firstIso, lastIndex);
  const spanDays = lastIndex;
  const candidates = [];
  if (spanDays > 400) {
    const firstYear = Number(firstIso.slice(0, 4));
    const lastYear = Number(lastIso.slice(0, 4));
    for (let y = firstYear + 1; y <= lastYear; y += 1) {
      const iso = `${y}-01-01`;
      candidates.push({ index: dayIndex(iso, firstIso), label: String(y) });
    }
  } else if (spanDays > 45) {
    let [y, m] = firstIso.split('-').map(Number);
    for (;;) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      const iso = `${y}-${String(m).padStart(2, '0')}-01`;
      if (iso > lastIso) break;
      candidates.push({ index: dayIndex(iso, firstIso), label: iso.slice(0, 7) });
    }
  } else {
    const every = Math.max(1, Math.ceil(spanDays / Math.max(2, maxTicks - 1)));
    for (let i = 0; i <= lastIndex; i += every) candidates.push({ index: i, label: addDays(firstIso, i).slice(5) });
  }
  const stride = Math.max(1, Math.ceil(candidates.length / maxTicks));
  return candidates.filter((_, i) => i % stride === 0);
}

/** SVG path for [[dayIndex, price], ...]: horizontal to each change, then vertical. */
export function stepPath(points, lastIndex, x, y) {
  if (!points.length) return '';
  const r = (n) => Math.round(n * 10) / 10;
  let d = `M${r(x(points[0][0]))} ${r(y(points[0][1]))}`;
  for (let i = 1; i < points.length; i += 1) {
    d += `H${r(x(points[i][0]))}V${r(y(points[i][1]))}`;
  }
  d += `H${r(x(lastIndex))}`;
  return d;
}

/** Price held on `index` by a step series, or undefined before its first point. */
export function valueAt(points, index) {
  let found;
  for (const [i, price] of points) {
    if (i > index) break;
    found = price;
  }
  return found;
}
