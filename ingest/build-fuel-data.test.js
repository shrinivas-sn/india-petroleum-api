import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseMetroText } from './parse-metro.js';
import { toDays } from './days.js';
import { ATTRIBUTION, buildFuelData, checkPlausible, runBuild } from './build-fuel-data.js';

const text = () =>
  readFileSync(new URL('./fixtures/raw-30-days-2022.txt', import.meta.url), 'utf8');
const source = {
  source_url: 'https://ppac.gov.in/download.php?file=importantnews/1_PP_9_a_DailyPriceMSHSD_Metro_22.10.2026.pdf',
  sha256: 'abc123',
  fetched_at: '2026-10-22T10:00:00Z',
};
const tmp = () => mkdtempSync(join(tmpdir(), 'fuel-'));

test('builds the three files for a 30-day series with provenance', () => {
  const built = buildFuelData(parseMetroText(text()), { source });
  assert.equal(built.daily.length, 30);
  assert.equal(built.daily[0].date, '2022-03-09');
  assert.equal(built.daily.at(-1).date, '2022-04-07');
  assert.deepEqual(built.meta, {
    source: 'PPAC',
    attribution: ATTRIBUTION,
    source_url: source.source_url,
    source_posted_date: '2026-10-22',
    sha256: 'abc123',
    fetched_at: '2026-10-22T10:00:00Z',
    first_date: '2022-03-09',
    last_date: '2022-04-07',
    day_count: 30,
  });
  const first = built.changes.find((c) => c.date === '2022-03-22' && c.fuel === 'petrol' && c.city === 'delhi');
  assert.deepEqual(first, { date: '2022-03-22', fuel: 'petrol', city: 'delhi', from: 95.41, to: 96.21 });
});

test('a series with a gap throws CONTINUITY and runBuild writes nothing', () => {
  const dir = tmp();
  const gappy = text().split('\n').filter((l) => !l.startsWith('20-Mar-22')).join('\n');
  assert.throws(() => buildFuelData(parseMetroText(gappy), { source }), (e) => e.code === 'CONTINUITY' && /2022-03-20/.test(e.message));
  assert.throws(() => runBuild({ rawText: gappy, outDir: dir, source }), (e) => e.code === 'CONTINUITY');
  assert.deepEqual(readdirSync(dir), []);
});

test('runBuild writes daily.json with one day per line, changes.json and meta.json', () => {
  const dir = tmp();
  const result = runBuild({ rawText: text(), outDir: dir, source });
  assert.equal(result.written, true);
  const lines = readFileSync(join(dir, 'daily.json'), 'utf8').split('\n');
  assert.equal(lines[0], '{"days":[');
  assert.equal(lines.filter((l) => l.startsWith('{"date"')).length, 30);
  assert.equal(JSON.parse(readFileSync(join(dir, 'daily.json'), 'utf8')).days.length, 30);
  assert.ok(JSON.parse(readFileSync(join(dir, 'changes.json'), 'utf8')).changes.length > 0);
  assert.equal(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).day_count, 30);
});

test('a second identical run changes nothing', () => {
  const dir = tmp();
  runBuild({ rawText: text(), outDir: dir, source });
  const before = readFileSync(join(dir, 'daily.json'), 'utf8');
  const again = runBuild({ rawText: text(), outDir: dir, source });
  assert.equal(readFileSync(join(dir, 'daily.json'), 'utf8'), before);
  assert.equal(again.appended, 0);
});

test('one new day is appended to a stored series', () => {
  const dir = tmp();
  const older = text().split('\n').filter((l) => !l.startsWith('7-Apr-22')).join('\n');
  runBuild({ rawText: older, outDir: dir, source });
  const result = runBuild({ rawText: text(), outDir: dir, source });
  assert.equal(result.appended, 1);
  assert.equal(JSON.parse(readFileSync(join(dir, 'daily.json'), 'utf8')).days.length, 30);
});

test('a restated old price throws RESTATEMENT, writes nothing new, and passes once approved', () => {
  const dir = tmp();
  runBuild({ rawText: text(), outDir: dir, source });
  const before = readFileSync(join(dir, 'daily.json'), 'utf8');
  const restated = text().replace('96.21 110.82', '96.31 110.82');
  assert.throws(() => runBuild({ rawText: restated, outDir: dir, source }), (e) => e.code === 'RESTATEMENT' && /2022-03-22/.test(e.message));
  assert.equal(readFileSync(join(dir, 'daily.json'), 'utf8'), before);
  const ok = runBuild({ rawText: restated, outDir: dir, source, approved: ['2022-03-22'] });
  assert.equal(ok.written, true);
  assert.match(readFileSync(join(dir, 'daily.json'), 'utf8'), /96\.31/);
});

test('buildFuelData requires a posted date', () => {
  const body = text().split('\n').slice(1).filter((l) => !l.includes('Table Posted')).join('\n');
  assert.throws(() => buildFuelData(parseMetroText(body), { source }), /Table Posted/);
});

test('toDays output is what the builder stores', () => {
  const parsed = parseMetroText(text());
  assert.deepEqual(buildFuelData(parsed, { source }).daily, toDays(parsed));
});

test('identical data with a later fetch time leaves meta.json untouched', () => {
  const dir = tmp();
  runBuild({ rawText: text(), outDir: dir, source });
  const before = readFileSync(join(dir, 'meta.json'), 'utf8');
  const again = runBuild({ rawText: text(), outDir: dir, source: { ...source, fetched_at: '2026-10-23T10:00:00Z' } });
  assert.equal(again.written, false);
  assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), before);
});

const cli = fileURLToPath(new URL('./build-fuel-data.js', import.meta.url));
const rawFixture = fileURLToPath(new URL('./fixtures/raw-30-days-2022.txt', import.meta.url));

test('cli refuses to guess where the data came from', () => {
  const run = spawnSync(process.execPath, [cli, rawFixture, '--out', tmp()], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /--pdf/);
});

test('cli hashes the given pdf and records it in meta.json', () => {
  const dir = tmp();
  const pdf = join(dir, 'x.pdf');
  writeFileSync(pdf, 'not really a pdf');
  const out = join(dir, 'out');
  const run = spawnSync(
    process.execPath,
    [cli, rawFixture, '--out', out, '--pdf', pdf, '--source-url', source.source_url, '--fetched-at', source.fetched_at],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  const meta = JSON.parse(readFileSync(join(out, 'meta.json'), 'utf8'));
  assert.equal(meta.sha256, createHash('sha256').update('not really a pdf').digest('hex'));
  assert.equal(meta.source_url, source.source_url);
});

test('a price ten times too large throws IMPLAUSIBLE, writes nothing, and passes once its date is approved', () => {
  const dir = tmp();
  const typo = text().replace(/^(7-Apr-22 )(\d+\.\d+)/m, (_, date, price) => `${date}${(Number(price) * 10).toFixed(2)}`);
  assert.notEqual(typo, text());
  assert.throws(
    () => runBuild({ rawText: typo, outDir: dir, source }),
    (e) => e.code === 'IMPLAUSIBLE' && /2022-04-07 petrol delhi/.test(e.message) && /approved-moves\.json/.test(e.message),
  );
  assert.deepEqual(readdirSync(dir), []);
  const ok = runBuild({ rawText: typo, outDir: dir, source, approvedMoves: ['2022-04-07'] });
  assert.equal(ok.written, true);
});

test('a day-over-day move above 20 rupees is refused even inside the price band', () => {
  const days = JSON.parse(readFileSync(new URL('../data/fuel/daily.json', import.meta.url), 'utf8')).days.slice(0, 5);
  const jumped = structuredClone(days);
  jumped[3].diesel.mumbai = Number((jumped[2].diesel.mumbai + 21).toFixed(2));
  assert.throws(() => checkPlausible(jumped), (e) => e.code === 'IMPLAUSIBLE' && /diesel mumbai/.test(e.message));
  assert.throws(() => checkPlausible(jumped, [jumped[3].date]), (e) => e.message.includes(jumped[4].date), 'the move back is a move too');
  assert.doesNotThrow(() => checkPlausible(jumped, [jumped[3].date, jumped[4].date]));
});

const approvedMoves = () => JSON.parse(readFileSync(new URL('./approved-moves.json', import.meta.url), 'utf8'));

test('every stored day passes the plausibility check with the approved dates, so an approved shock can still be committed', () => {
  const days = JSON.parse(readFileSync(new URL('../data/fuel/daily.json', import.meta.url), 'utf8')).days;
  assert.doesNotThrow(() => checkPlausible(days, approvedMoves()));
});

test('approved-moves.json lists real calendar dates and nothing else', () => {
  const list = approvedMoves();
  assert.ok(Array.isArray(list));
  for (const date of list) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), date);
  }
});

test('the refusal message lists every affected date, so a spike and its reversion are both visible', () => {
  const days = JSON.parse(readFileSync(new URL('../data/fuel/daily.json', import.meta.url), 'utf8')).days.slice(0, 6);
  const spiked = structuredClone(days);
  for (const fuel of ['petrol', 'diesel']) for (const city of Object.keys(spiked[3][fuel])) spiked[3][fuel][city] += 30;
  assert.throws(() => checkPlausible(spiked), (e) => e.message.includes(spiked[3].date) && e.message.includes(spiked[4].date) && /dates: /.test(e.message));
});

test('a stored day that vanished from the table is refused, and the message does not suggest an approval that cannot clear it', () => {
  const dir = tmp();
  runBuild({ rawText: text(), outDir: dir, source });
  const shorter = text().split('\n').filter((l) => !l.startsWith('7-Apr-22')).join('\n');
  assert.throws(
    () => runBuild({ rawText: shorter, outDir: dir, source, approved: ['2022-04-07'] }),
    (e) => e.code === 'RESTATEMENT' && /vanished/.test(e.message) && /2022-04-07/.test(e.message) && !/approve in approved-restatements/.test(e.message),
  );
});

test('a changed price still points at approved-restatements.json', () => {
  const dir = tmp();
  runBuild({ rawText: text(), outDir: dir, source });
  assert.throws(
    () => runBuild({ rawText: text().replace('96.21 110.82', '96.31 110.82'), outDir: dir, source }),
    (e) => e.code === 'RESTATEMENT' && /changed/.test(e.message) && /approve in approved-restatements\.json/.test(e.message),
  );
});
