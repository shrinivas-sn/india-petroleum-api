// Proves a parsed price series has every calendar day exactly once, with four
// positive prices. Documented source gaps are allowed only through known-gaps.json.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseMetroText } from './parse-metro.js';

const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];
const DAY_MS = 86400000;

function nextDay(iso) {
  return new Date(Date.parse(iso) + DAY_MS).toISOString().slice(0, 10);
}

export function checkContinuity(rows, { from, fuel, knownGaps = [] } = {}) {
  const seen = new Set();
  const duplicates = new Set();
  const incomplete = new Set();
  for (const row of rows) {
    if (seen.has(row.date)) duplicates.add(row.date);
    seen.add(row.date);
    const complete = CITIES.every((c) => typeof row[c] === 'number' && Number.isFinite(row[c]) && row[c] > 0);
    if (!complete) incomplete.add(row.date);
  }

  const allowed = new Set(
    knownGaps.filter((g) => !g.fuel || g.fuel === fuel).map((g) => g.date),
  );
  const dates = [...seen].sort();
  const missing = [];
  if (dates.length > 0) {
    const start = from ?? dates[0];
    const end = dates[dates.length - 1];
    for (let day = start; day <= end; day = nextDay(day)) {
      if (!seen.has(day) && !allowed.has(day)) missing.push(day);
    }
  }

  const dups = [...duplicates].sort();
  const incompleteDays = [...incomplete].sort();
  const ok = missing.length === 0 && dups.length === 0 && incompleteDays.length === 0;
  return { ok, missing, duplicates: dups, incomplete: incompleteDays, count: seen.size };
}

export function loadKnownGaps(file = fileURLToPath(new URL('./known-gaps.json', import.meta.url))) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
}

function main(argv) {
  const file = argv[2];
  if (!file) {
    console.error('usage: node ingest/check-continuity.js <pdftotext -raw output>');
    return 2;
  }
  const { petrol, diesel } = parseMetroText(readFileSync(file, 'utf8'));
  const knownGaps = loadKnownGaps();
  const verdicts = { petrol: checkContinuity(petrol, { fuel: 'petrol', knownGaps }), diesel: checkContinuity(diesel, { fuel: 'diesel', knownGaps }) };
  const summary = Object.entries(verdicts)
    .map(([fuel, v]) => `${fuel} ${v.count} ${v.ok ? 'ok' : 'FAIL'}`)
    .join(', ');
  console.log(summary);
  let code = 0;
  for (const [fuel, v] of Object.entries(verdicts)) {
    if (v.ok) continue;
    code = 1;
    for (const key of ['missing', 'duplicates', 'incomplete']) {
      if (v[key].length) console.log(`${fuel} ${key}: ${v[key].join(', ')}`);
    }
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
