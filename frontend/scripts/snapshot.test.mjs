import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSnapshot, dayIndex, highlights, longestFlat, stepPoints, FUELS, CITIES } from './snapshot.mjs';

const dataDir = new URL('../../data/fuel/', import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(name, dataDir)), 'utf8'));
const days = read('daily.json').days;
const moves = read('changes.json').changes;
const meta = read('meta.json');

test('step points rebuild every stored price exactly', () => {
  const first = days[0].date;
  for (const fuel of FUELS) {
    for (const city of CITIES) {
      const points = stepPoints(days, fuel, city);
      let at = 0;
      for (const day of days) {
        const idx = dayIndex(day.date, first);
        while (at + 1 < points.length && points[at + 1][0] <= idx) at += 1;
        assert.equal(points[at][1], day[fuel][city], `${fuel} ${city} ${day.date}`);
      }
    }
  }
});

test('step points hold one entry per change, not one per day', () => {
  const points = stepPoints(days, 'petrol', 'delhi');
  assert.ok(points.length < days.length / 2);
  assert.deepEqual(points[0], [0, 65.48]);
});

test('the largest Delhi moves include the 22 May 2022 cut and are far enough apart', () => {
  const picks = highlights(moves);
  assert.equal(picks.length, 4);
  const cut = picks.find((p) => p.date === '2022-05-22');
  assert.deepEqual(cut.moves.petrol, { from: 105.41, to: 96.72, change: -8.69 });
  assert.deepEqual(cut.moves.diesel, { from: 96.67, to: 89.62, change: -7.05 });
  for (let i = 1; i < picks.length; i += 1) {
    const gap = (Date.parse(picks[i].date) - Date.parse(picks[i - 1].date)) / 86400000;
    assert.ok(gap >= 120, `${picks[i - 1].date} and ${picks[i].date} are ${gap} days apart`);
  }
  assert.deepEqual(picks.map((p) => p.n), [1, 2, 3, 4]);
});

test('the longest flat stretch for Delhi runs from 22 May 2022 for 663 days', () => {
  const flat = longestFlat(days, 'delhi');
  assert.equal(flat.from, '2022-05-22');
  assert.equal(flat.to, '2024-03-14');
  assert.equal(flat.days, 663);
  assert.equal(flat.petrol, 96.72);
  assert.equal(flat.diesel, 89.62);
});

test('the snapshot carries the stored provenance and the latest day', () => {
  const snapshot = buildSnapshot({ days, moves, meta, examples: {} });
  assert.equal(snapshot.meta.last_date, meta.last_date);
  assert.equal(snapshot.meta.sha256, meta.sha256);
  assert.equal(snapshot.latest.date, meta.last_date);
  assert.equal(snapshot.chart.last_index, dayIndex(meta.last_date, meta.first_date));
  assert.deepEqual(Object.keys(snapshot.chart.series).sort(), ['delhi.diesel', 'delhi.petrol']);
  assert.equal(snapshot.revision_days_by_year['2023'], undefined, 'no revision day in 2023');
});
