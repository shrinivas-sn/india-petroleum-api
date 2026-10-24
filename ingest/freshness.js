// Alarm for the stored fuel data: fails when the newest day is more than two
// (IST) days old, so a Sunday or holiday gap passes but a stalled job does not.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export function daysBehind(meta, now = new Date()) {
  const todayIst = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(todayIst) - Date.parse(meta.last_date)) / DAY_MS);
  return Math.max(0, diff);
}

export function isStale(meta, now = new Date(), { limit = 2 } = {}) {
  return daysBehind(meta, now) > limit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = fileURLToPath(new URL('../data/fuel/meta.json', import.meta.url));
  const meta = JSON.parse(readFileSync(file, 'utf8'));
  const behind = daysBehind(meta);
  console.log(`last_date ${meta.last_date}, ${behind} day(s) behind (IST)`);
  process.exitCode = isStale(meta) ? 1 : 0;
}
