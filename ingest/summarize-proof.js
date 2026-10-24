import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

export function parsePosted(text) {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(text ?? '');
  if (!m || !MONTHS[m[2]]) return null;
  return `20${m[3]}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const prevDay = (iso) => new Date(Date.parse(iso) - 864e5).toISOString().slice(0, 10);
const nextDay = (iso) => new Date(Date.parse(iso) + 864e5).toISOString().slice(0, 10);

export function summarize(records) {
  const sched = records.filter((r) => r.trigger === 'schedule');
  if (!sched.length) return { days: [], verdict: 'IN PROGRESS' };
  const byDay = new Map();
  for (const r of sched) {
    const d = r.started_at_utc.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  }
  const dates = [...byDay.keys()].sort();
  const days = [];
  for (let d = dates[0]; d <= dates.at(-1); d = nextDay(d)) {
    const runs = byDay.get(d) ?? [];
    const good = runs.filter((r) => {
      const p = parsePosted(r.table_posted);
      return r.complete && r.tls_verified && (p === d || p === prevDay(d));
    });
    const seen = runs.filter((r) => parsePosted(r.table_posted) === d).map((r) => r.started_at_utc).sort()[0] ?? null;
    days.push({
      date: d, runs: runs.length, ok: good.length, failed: runs.length - good.length,
      status: !runs.length ? 'no run' : good.length ? 'pass' : 'fail',
      first_seen_utc: seen, errors: runs.flatMap((r) => [r.error, ...(r.page_errors ?? [])]).filter(Boolean),
    });
  }
  let streak = 0, best = 0;
  for (const x of days) { streak = x.status === 'pass' ? streak + 1 : 0; best = Math.max(best, streak); }
  const failDays = days.filter((x) => x.status === 'fail').length;
  const verdict = failDays >= 2 ? 'FAIL' : best >= 7 && failDays <= 1 ? 'PASS' : 'IN PROGRESS';
  return { days, verdict };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] ?? 'proof/download-log.jsonl';
  const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const s = summarize(records);
  console.log('date        runs  ok  failed  status   first seen (UTC)          errors');
  for (const d of s.days) {
    console.log(`${d.date}  ${String(d.runs).padStart(4)}  ${String(d.ok).padStart(2)}  ${String(d.failed).padStart(6)}  ${d.status.padEnd(7)}  ${(d.first_seen_utc ?? '-').padEnd(24)}  ${d.errors.join(' | ')}`);
  }
  console.log(`manual runs ignored: ${records.filter((r) => r.trigger !== 'schedule').length}`);
  console.log(s.verdict);
}
