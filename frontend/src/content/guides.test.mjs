// Every figure a guide quotes is recomputed from data/fuel/. Windows end on a fixed past date,
// so a daily append to the data cannot make these fail; a restated historic price would.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GUIDES } from './guidesData.js';

const read = (name) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../../data/fuel/${name}`, import.meta.url)), 'utf8'));
const days = read('daily.json').days;
const moves = read('changes.json').changes;
const guideText = (id) => JSON.stringify(GUIDES.find((g) => g.id === id));
const upTo = (date) => days.filter((d) => d.date <= date);
const inYear = (year) => days.filter((d) => d.date.startsWith(String(year)));

test('there are three guides with distinct ids', () => {
  assert.equal(GUIDES.length, 3);
  assert.equal(new Set(GUIDES.map((g) => g.id)).size, 3);
});

test('guide 1: 3,417 days with no gap up to the table posted on 23 October 2026', () => {
  const series = upTo('2026-10-23');
  assert.equal(series.length, 3417);
  assert.equal(series[0].date, '2017-06-16');
  for (let i = 1; i < series.length; i += 1) {
    assert.equal((Date.parse(series[i].date) - Date.parse(series[i - 1].date)) / 86400000, 1, series[i].date);
  }
  assert.match(guideText('how-to-read-the-ppac-metro-price-series'), /3,417 days/);
});

test('guide 1: 2021 has 365 rows, Delhi petrol averages 96.19, starts at 83.71, ends at 95.41, peaks at 110.04 on 2 November', () => {
  const year = inYear(2021);
  assert.equal(year.length, 365);
  const average = year.reduce((sum, d) => sum + d.petrol.delhi, 0) / year.length;
  assert.equal(average.toFixed(2), '96.19');
  assert.equal(year[0].petrol.delhi, 83.71);
  assert.equal(year.at(-1).petrol.delhi, 95.41);
  const peak = Math.max(...year.map((d) => d.petrol.delhi));
  assert.equal(peak, 110.04);
  assert.equal(year.find((d) => d.petrol.delhi === peak).date, '2021-11-02');
  const text = guideText('how-to-read-the-ppac-metro-price-series');
  for (const claim of ['365 rows', '96.19', '83.71', '95.41', '110.04']) assert.ok(text.includes(claim), claim);
});

test('guide 2: revision days per year and the total through 2025', () => {
  const perYear = {};
  for (const m of moves) {
    const year = m.date.slice(0, 4);
    (perYear[year] ||= new Set()).add(m.date);
  }
  const table = GUIDES.find((g) => g.id === 'petrol-and-diesel-price-revisions-since-2017').sections[0].blocks.find((b) => b.type === 'table');
  for (const [label, count] of table.rows) {
    const year = label.slice(0, 4);
    assert.equal(perYear[year]?.size ?? 0, Number(count), `revision days in ${year}`);
  }
  const through2025 = new Set(moves.filter((m) => m.date <= '2025-12-31').map((m) => m.date));
  assert.equal(through2025.size, 1014);
  assert.equal(upTo('2025-12-31').length, 3121);
  assert.match(guideText('petrol-and-diesel-price-revisions-since-2017'), /1,014 revision days out of 3,121/);
});

test('guide 2: the longest Delhi pause is 663 days from 22 May 2022 to 14 March 2024', () => {
  const window = days.filter((d) => d.date >= '2022-05-22' && d.date <= '2024-03-14');
  assert.equal(window.length, 663);
  assert.ok(window.every((d) => d.petrol.delhi === 96.72 && d.diesel.delhi === 89.62));
  const before = days.find((d) => d.date === '2022-05-21');
  const after = days.find((d) => d.date === '2024-03-15');
  assert.notDeepEqual([before.petrol.delhi, before.diesel.delhi], [96.72, 89.62]);
  assert.ok(after.petrol.delhi !== 96.72 || after.diesel.delhi !== 89.62);
});

test('guide 2: the table lists exactly the Delhi moves of 7 rupees or more, with correct prices', () => {
  const big = moves
    .filter((m) => m.city === 'delhi' && Math.abs(m.to - m.from) >= 7)
    .map((m) => [m.date, m.fuel, m.from.toFixed(2), m.to.toFixed(2)]);
  assert.equal(big.length, 6);
  const guide = GUIDES.find((g) => g.id === 'petrol-and-diesel-price-revisions-since-2017');
  const rows = guide.sections.find((s) => s.heading === 'The largest Delhi moves').blocks.find((b) => b.type === 'table').rows;
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const listed = rows.map(([date, fuel, from, to, change]) => {
    const [d, mon, y] = date.split(' ');
    assert.equal((Number(to) - Number(from)).toFixed(2), change.replace('−', '-').replace('+', ''), `change for ${date} ${fuel}`);
    return [`${y}-${months[mon]}-${d.padStart(2, '0')}`, fuel.toLowerCase(), from, to];
  });
  assert.deepEqual(listed, big);
});

test('guide 2: the November 2021 Delhi diesel changes match the response shown', () => {
  const nov = moves.filter((m) => m.city === 'delhi' && m.fuel === 'diesel' && m.date >= '2021-11-01' && m.date <= '2021-11-30');
  const shown = GUIDES.find((g) => g.id === 'petrol-and-diesel-price-revisions-since-2017')
    .sections.find((s) => s.heading === 'List the moves yourself')
    .blocks.find((b) => b.label === 'Response data');
  assert.deepEqual(JSON.parse(shown.text), nov);
});

test('guide 3: the Mumbai minus Delhi petrol gap, as the sample code computes it', () => {
  const series = upTo('2025-12-31');
  assert.equal(series.length, 3121);
  const gaps = series.map((row) => ({ date: row.date, gap: +(row.petrol.mumbai - row.petrol.delhi).toFixed(2) }));
  const low = gaps.reduce((a, b) => (b.gap < a.gap ? b : a));
  const high = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
  assert.deepEqual(gaps[0], { date: '2017-06-16', gap: 11.22 });
  assert.deepEqual(low, { date: '2020-05-05', gap: 5.05 });
  assert.deepEqual(high, { date: '2022-04-06', gap: 15.1 });
  assert.ok(gaps.filter((g) => g.gap === low.gap).every((g) => g.date >= '2020-05-05' && g.date <= '2020-05-31'));
  assert.equal(gaps.filter((g) => g.gap === low.gap).at(-1).date, '2020-05-31');
  assert.equal(gaps.filter((g) => g.gap === high.gap).at(-1).date, '2022-05-21');
  const day = days.find((d) => d.date === '2017-06-16');
  assert.deepEqual([day.petrol.mumbai, day.petrol.delhi], [76.7, 65.48]);
  const last = days.find((d) => d.date === '2026-10-23');
  assert.deepEqual([last.petrol.mumbai, last.petrol.delhi, +(last.petrol.mumbai - last.petrol.delhi).toFixed(2)], [111.21, 102.12, 9.09]);
});

test('guides name no endpoint the backend lacks', () => {
  const paths = [...JSON.stringify(GUIDES).matchAll(/\/v1\/[a-z/]+/g)].map((m) => m[0].replace(/\/$/, ''));
  const allowed = new Set(['/v1/prices', '/v1/prices/changes', '/v1/prices/latest', '/v1/cities', '/v1/meta']);
  for (const p of paths) assert.ok(allowed.has(p), p);
});
