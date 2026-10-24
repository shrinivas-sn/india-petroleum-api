// Builds the stored fuel price JSON that the API serves. Refuses to write unless
// the series is gap-free and no stored day was restated without approval.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseMetroText } from './parse-metro.js';
import { toDays } from './days.js';
import { checkContinuity, loadKnownGaps } from './check-continuity.js';
import { diffHistory, revisions } from './diff-history.js';

export const ATTRIBUTION =
  'Source: Petroleum Planning & Analysis Cell (PPAC), Ministry of Petroleum and Natural Gas, Government of India';

function fail(code, message) {
  const e = new Error(`${code}: ${message}`);
  e.code = code;
  return e;
}

export function buildFuelData(parsed, { stored = [], source, approved = [], knownGaps = [] }) {
  if (!parsed.posted) throw fail('POSTED', 'the text has no "Table Posted" date');
  const daily = toDays(parsed);

  for (const fuel of ['petrol', 'diesel']) {
    const c = checkContinuity(parsed[fuel], { fuel, knownGaps });
    if (!c.ok) {
      const parts = ['missing', 'duplicates', 'incomplete']
        .filter((k) => c[k].length)
        .map((k) => `${k} ${c[k].join(', ')}`);
      throw fail('CONTINUITY', `${fuel} series is not continuous: ${parts.join('; ')}`);
    }
  }

  const diff = diffHistory(stored, daily, { approved });
  if (!diff.ok) {
    const dates = [...new Set([...diff.changedOld.map((c) => c.date), ...diff.removed])].sort();
    throw fail('RESTATEMENT', `stored days changed or vanished: ${dates.join(', ')} (approve in approved-restatements.json)`);
  }

  const meta = {
    source: 'PPAC',
    attribution: ATTRIBUTION,
    source_url: source.source_url,
    source_posted_date: parsed.posted,
    sha256: source.sha256,
    fetched_at: source.fetched_at,
    first_date: daily[0].date,
    last_date: daily.at(-1).date,
    day_count: daily.length,
  };
  return { daily, changes: revisions(daily), meta, diff };
}

export function serialiseDaily(days) {
  return `{"days":[\n${days.map((d) => JSON.stringify(d)).join(',\n')}\n]}\n`;
}

export function serialiseChanges(changes) {
  return `{"changes":[\n${changes.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`;
}

export function readStored(dir) {
  const file = join(dir, 'daily.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).days : [];
}

export function runBuild({ rawText, outDir, source, approved = [], knownGaps = [] }) {
  const stored = readStored(outDir);
  const built = buildFuelData(parseMetroText(rawText), { stored, source, approved, knownGaps });
  const appended = built.diff.appended.length;
  if (stored.length > 0 && appended === 0 && built.diff.approvedChanges.length === 0) {
    return { written: false, appended, built };
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'daily.json'), serialiseDaily(built.daily));
  writeFileSync(join(outDir, 'changes.json'), serialiseChanges(built.changes));
  writeFileSync(join(outDir, 'meta.json'), `${JSON.stringify(built.meta, null, 2)}\n`);
  return { written: true, appended, built };
}

function flag(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv) {
  const rawFile = argv[2];
  if (!rawFile) {
    console.error('usage: node ingest/build-fuel-data.js <pdftotext -raw output> --pdf <file> --source-url <url> --fetched-at <iso> [--out dir]');
    return 2;
  }
  const root = fileURLToPath(new URL('..', import.meta.url));
  const pdf = flag(argv, 'pdf');
  const sourceUrl = flag(argv, 'source-url');
  const fetchedAt = flag(argv, 'fetched-at');
  if (!pdf || !sourceUrl || !fetchedAt) {
    console.error('--pdf (the file the text came from), --source-url and --fetched-at are required: provenance is never guessed');
    return 2;
  }
  const source = {
    source_url: sourceUrl,
    sha256: createHash('sha256').update(readFileSync(pdf)).digest('hex'),
    fetched_at: fetchedAt,
  };
  const outDir = flag(argv, 'out') ?? join(root, 'data', 'fuel');
  const approved = existsSync(join(root, 'ingest', 'approved-restatements.json'))
    ? JSON.parse(readFileSync(join(root, 'ingest', 'approved-restatements.json'), 'utf8'))
    : [];
  try {
    const r = runBuild({ rawText: readFileSync(rawFile, 'utf8'), outDir, source, approved, knownGaps: loadKnownGaps() });
    console.log(r.written ? `wrote ${r.built.daily.length} days (${r.appended} new) to ${outDir}` : 'no change');
    return 0;
  } catch (e) {
    console.error(e.message);
    return e.code ? 3 : 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
