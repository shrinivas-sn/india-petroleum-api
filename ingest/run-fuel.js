// One daily fuel ingestion: download, extract text, build and check the stored JSON.
// Exit codes: 0 written or no change, 2 download failed, 3 a check refused the data.
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run as downloadDaily } from './fetch-daily.js';
import { runBuild } from './build-fuel-data.js';
import { loadKnownGaps } from './check-continuity.js';

export function runFuel({ record, pdfSha256, rawText, outDir, approved = [], knownGaps = [] }) {
  if (record.sha256 !== pdfSha256) {
    throw new Error(`PROVENANCE: the PDF on disk (${pdfSha256}) is not the file the download record names (${record.sha256})`);
  }
  const source = { source_url: record.file_url, sha256: record.sha256, fetched_at: record.started_at_utc };
  try {
    const r = runBuild({ rawText, outDir, source, approved, knownGaps });
    const { daily, meta } = r.built;
    const status = r.written ? 'written' : 'no-change';
    const summary = r.written
      ? `Fuel data written: ${daily.length} days (${r.appended} new), ${meta.first_date} to ${meta.last_date}, posted ${meta.source_posted_date}.`
      : `No change: ${daily.length} days already stored, last ${meta.last_date}.`;
    const added = r.built.diff.appended.map((d) => d.date);
    const commitMessage = r.written
      ? `ingest(fuel): ${added[0] ?? meta.first_date}..${added.at(-1) ?? meta.last_date}, ${added.length || daily.length} day(s), posted ${meta.source_posted_date}`
      : null;
    return { code: 0, status, summary, commitMessage };
  } catch (e) {
    if (!e.code) throw e;
    return { code: 3, status: 'refused', report: e.message, summary: `Refused: ${e.message}` };
  }
}

function lastRecord(file) {
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).at(-1);
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const log = join(root, 'proof', 'download-log.jsonl');
  const pdf = join(root, 'work', 'daily.pdf');
  const exit = await downloadDaily({ log });
  if (exit !== 0) return 2;

  const record = lastRecord(log);
  const pdfSha256 = createHash('sha256').update(readFileSync(pdf)).digest('hex');
  const rawText = execFileSync('pdftotext', ['-raw', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const approvedFile = join(root, 'ingest', 'approved-restatements.json');
  const approved = JSON.parse(readFileSync(approvedFile, 'utf8'));
  mkdirSync(join(root, 'work'), { recursive: true });
  const result = runFuel({ record, pdfSha256, rawText, outDir: join(root, 'data', 'fuel'), approved, knownGaps: loadKnownGaps() });
  console.log(result.summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result.summary}\n`);
  if (result.commitMessage) writeFileSync(join(root, 'work', 'commit-message.txt'), `${result.commitMessage}
`);
  if (result.code === 3) {
    mkdirSync(join(root, 'work'), { recursive: true });
    writeFileSync(join(root, 'work', 'failure-report.txt'), `${result.report}\n`);
  }
  return result.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
