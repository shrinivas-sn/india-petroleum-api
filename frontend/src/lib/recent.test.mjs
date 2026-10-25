import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLD_NOTICE_DAYS, PERIODS, changesOver, heldFor } from './recent.js';

const CITIES = ['delhi', 'mumbai', 'chennai', 'kolkata'];
const addDay = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** 31 daily rows ending on `last`; `price(daysAgo)` gives the Delhi petrol price, everything else is flat. */
function rows(last, price = () => 100) {
  return Array.from({ length: 31 }, (_, i) => {
    const ago = 30 - i;
    const flat = (base) => Object.fromEntries(CITIES.map((c) => [c, base]));
    return { date: addDay(last, -ago), petrol: { ...flat(110), delhi: price(ago) }, diesel: flat(95) };
  });
}

test('the three periods are 1, 7 and 30 days', () => {
  assert.deepEqual(PERIODS.map((p) => [p.id, p.days, p.label]), [
    ['day', 1, '1 day'],
    ['week', 7, '7 days'],
    ['month', 30, '30 days'],
  ]);
});

test('each change is the newest price minus the price that many days earlier, for every city and fuel', () => {
  // Delhi petrol: 100 thirty days ago, 101 a week ago, 102 yesterday, 103 today
  const data = rows('2026-10-23', (ago) => (ago === 0 ? 103 : ago === 1 ? 102 : ago <= 7 ? 101 : 100));
  const out = changesOver(data, '2026-10-23');
  assert.deepEqual(out.petrol.delhi, { day: 1, week: 2, month: 3 });
  assert.deepEqual(out.petrol.mumbai, { day: 0, week: 0, month: 0 });
  assert.deepEqual(Object.keys(out.diesel), CITIES);
  assert.deepEqual(out.diesel.delhi, { day: 0, week: 0, month: 0 }, 'diesel in this fixture does not move with petrol');
});

test('changes are rounded to paise so a float never prints as 1.4300000000000068', () => {
  const data = rows('2026-10-23', (ago) => (ago === 0 ? 102.12 : 99.51));
  assert.equal(changesOver(data, '2026-10-23').petrol.delhi.month, 2.61);
});

test('a falling price gives a negative change', () => {
  const data = rows('2026-10-23', (ago) => (ago === 0 ? 96.72 : 105.41));
  assert.equal(changesOver(data, '2026-10-23').petrol.delhi.day, -8.69);
});

test('a period with no row that many days back is unknown (null), the others still work', () => {
  const data = rows('2026-10-23').slice(-8); // only 8 days of rows: 7 days back exists, 30 does not
  const out = changesOver(data, '2026-10-23');
  assert.equal(out.petrol.delhi.day, 0);
  assert.equal(out.petrol.delhi.week, 0);
  assert.equal(out.petrol.delhi.month, null);
});

test('no rows, or no row for the newest day, gives nothing to show', () => {
  assert.equal(changesOver([], '2026-10-23'), null);
  assert.equal(changesOver(null, '2026-10-23'), null);
  assert.equal(changesOver(rows('2026-10-22'), '2026-10-23'), null);
});

test('rows missing a city or fuel do not throw: that cell is unknown', () => {
  const data = rows('2026-10-23');
  delete data[data.length - 1].diesel.kolkata;
  const out = changesOver(data, '2026-10-23');
  assert.deepEqual(out.diesel.kolkata, { day: null, week: null, month: null });
  assert.equal(out.petrol.kolkata.day, 0);
});

// --- how long a price has held -------------------------------------------------------------------------------
const lastChange = (date) => ({ petrol: { delhi: { date, from: 99.51, to: 102.12 } }, diesel: { delhi: null } });

test('heldFor counts the days from the last change to the newest day', () => {
  assert.deepEqual(heldFor(lastChange('2026-05-25'), 'petrol', 'delhi', '2026-10-23'), { since: '2026-05-25', days: 151 });
  assert.deepEqual(heldFor(lastChange('2026-10-23'), 'petrol', 'delhi', '2026-10-23'), { since: '2026-10-23', days: 0 });
});

test('heldFor is null when the API gave no usable last change for that price', () => {
  assert.equal(heldFor(undefined, 'petrol', 'delhi', '2026-10-23'), null);
  assert.equal(heldFor(lastChange('2026-05-25'), 'petrol', 'mumbai', '2026-10-23'), null, 'no entry for the city');
  assert.equal(heldFor(lastChange('2026-05-25'), 'diesel', 'delhi', '2026-10-23'), null, 'a price that never changed');
  assert.equal(heldFor(lastChange('not a date'), 'petrol', 'delhi', '2026-10-23'), null);
  assert.equal(heldFor(lastChange('2026-11-01'), 'petrol', 'delhi', '2026-10-23'), null, 'a change after the newest day makes no sense');
});

test('a price is announced as held only from the longest period the board shows', () => {
  assert.equal(HOLD_NOTICE_DAYS, 30);
});
