// Compares a freshly parsed price series with the stored one. A new file should
// only append days; any change to a stored day is a restatement and blocks a
// commit unless its date is listed in approved-restatements.json.
import { CITIES } from './days.js';

const FUELS = ['petrol', 'diesel'];

export function diffHistory(stored, parsed, { approved = [] } = {}) {
  const parsedByDate = new Map(parsed.map((d) => [d.date, d]));
  const storedDates = new Set(stored.map((d) => d.date));
  const approvedDates = new Set(approved);

  const changed = [];
  const removed = [];
  for (const old of stored) {
    const next = parsedByDate.get(old.date);
    if (!next) {
      removed.push(old.date);
      continue;
    }
    for (const fuel of FUELS) {
      for (const city of CITIES) {
        if (old[fuel][city] !== next[fuel][city]) {
          changed.push({ date: old.date, fuel, city, old: old[fuel][city], new: next[fuel][city] });
        }
      }
    }
  }

  const changedOld = changed.filter((c) => !approvedDates.has(c.date));
  const approvedChanges = changed.filter((c) => approvedDates.has(c.date));
  const appended = parsed.filter((d) => !storedDates.has(d.date));
  return { ok: changedOld.length === 0 && removed.length === 0, appended, changedOld, approvedChanges, removed };
}

export function revisions(days) {
  const out = [];
  for (let i = 1; i < days.length; i++) {
    for (const fuel of FUELS) {
      for (const city of CITIES) {
        const from = days[i - 1][fuel][city];
        const to = days[i][fuel][city];
        if (from !== to) out.push({ date: days[i].date, fuel, city, from, to });
      }
    }
  }
  return out;
}

export function revisionDays(days) {
  return [...new Set(revisions(days).map((r) => r.date))];
}
