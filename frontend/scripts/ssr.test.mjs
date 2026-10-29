// Draws the real pages and components on the server with made-up live states, then reads the HTML.
// This is how the states a visitor can reach but a build never shows are checked: fresh, stale, offline,
// a day newer than the build, an API without last_change, empty and very long ranges, and a failed chart.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { writeSnapshot } from './build-snapshot.mjs';
import { formatChange, formatCount, formatDate } from '../src/lib/format.js';
import { bannerFor, offlineState, readLive, snapshotState } from '../src/lib/live-state.js';
import { exampleWindow } from '../src/lib/range.js';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-10-24T03:00:00Z');
const h = React.createElement;

let vite;
let snap;
let mod;
let realDays;

before(async () => {
  snap = await writeSnapshot();
  vite = await createServer({ root: projectDir, server: { middlewareMode: true }, appType: 'custom', mode: 'test', logLevel: 'error' });
  mod = {
    App: await vite.ssrLoadModule('/src/App.jsx'),
    live: await vite.ssrLoadModule('/src/lib/live.jsx'),
    site: await vite.ssrLoadModule('/src/lib/site.jsx'),
    view: await vite.ssrLoadModule('/src/components/HistoryView.jsx'),
    result: await vite.ssrLoadModule('/src/components/PlaygroundResult.jsx'),
    guides: await vite.ssrLoadModule('/src/content/guidesData.js'),
    boundary: await vite.ssrLoadModule('/src/components/ErrorBoundary.jsx'),
  };
  realDays = JSON.parse(fs.readFileSync(path.join(projectDir, '..', 'data', 'fuel', 'daily.json'), 'utf8')).days;
});

after(async () => {
  await vite?.close();
});

// react-router warns about useLayoutEffect on the server in every render; the prerenderer sees the same.
function quietly(fn) {
  const original = console.error;
  console.error = (...args) => {
    if (!String(args[0]).includes('useLayoutEffect')) original(...args);
  };
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

const page = (route, state) =>
  quietly(() =>
    renderToString(
      h(
        mod.site.OriginProvider,
        { value: 'https://api.test' },
        h(
          mod.live.LiveContext.Provider,
          { value: { state, busy: false, retry() {} } },
          h(MemoryRouter, { initialEntries: [route] }, h(mod.App.AppContent)),
        ),
      ),
    ),
  );

const plain = (html) => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const count = (html, needle) => html.split(needle).length - 1;

// --- live states ------------------------------------------------------------------------------------------
const metaBody = (over = {}) => ({
  success: true,
  data: { ...snap.meta, days_behind: 0, data_source: 'remote', checked_at: NOW.toISOString(), refresh_error: null, ...over },
});
const latestBody = (day = snap.latest, lastChange) => ({
  success: true,
  data: day,
  meta: { count: 1, ...(lastChange && { last_change: lastChange }) },
});
// What /v1/prices/latest says about when each price last moved: every price on `date`, except those in `except`.
const lastChangeOn = (date, except = {}) =>
  Object.fromEntries(
    ['petrol', 'diesel'].map((fuel) => [
      fuel,
      Object.fromEntries(['delhi', 'mumbai', 'chennai', 'kolkata'].map((city) => [city, { date: except[`${fuel}.${city}`] ?? date, from: 1, to: 2 }])),
    ]),
  );
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const monthBody = () => snap.examples.board.body;
const fresh = () => readLive(metaBody(), latestBody(), NOW, monthBody());
const stale = (daysBehind = 5) => readLive(metaBody({ days_behind: daysBehind }), latestBody(), NOW, monthBody());
// The stored data grows every day, so "later than the build" is counted from the build's newest day.
const isoDaysFrom = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekAfterBuild = () => isoDaysFrom(snap.latest.date, 7);
const offline = () => offlineState(snapshotState(snap), 'Could not reach the API. Check your connection and try again.', new Date(`${weekAfterBuild()}T03:00:00Z`));
// A new day whose Delhi petrol price moved 1.38 from the build's, whatever the build's price was.
const newDelhi = () => Math.round((snap.latest.petrol.delhi + 1.38) * 100) / 100;
const delhiDay = (date) => ({ ...snap.latest, date, petrol: { ...snap.latest.petrol, delhi: newDelhi() }, diesel: { ...snap.latest.diesel } });
// The rows the API would return: the build's days, then one flat day after another up to `day`, which alone
// carries the new Delhi petrol price.
const rowsUpTo = (day) => {
  const rows = [...monthBody().data];
  for (let d = isoDaysFrom(snap.latest.date, 1); d < day.date; d = isoDaysFrom(d, 1)) rows.push({ ...snap.latest, date: d });
  rows.push(day);
  return rows;
};
// The Delhi board cell as text, each change worked out from the rows themselves, so a real price move in the
// stored data before the build changes the expected 30-day figure instead of failing the test.
const delhiCell = (rows, newest) => {
  const delhiOn = new Map(rows.map((row) => [row.date, row.petrol?.delhi]));
  const changes = [[1, '1 day'], [7, '7 days'], [30, '30 days']].map(([n, label]) => {
    const before = delhiOn.get(isoDaysFrom(newest, -n));
    return `${label} ${typeof before === 'number' ? formatChange(newDelhi() - before) : '–'}`;
  });
  return `Delhi ${newDelhi().toFixed(2)} ${changes.join(' ')}`;
};
const newerDay = (date) => readLive(metaBody({ last_date: date, day_count: snap.meta.day_count + 7 }), latestBody(delhiDay(date)), NOW, { success: true, data: rowsUpTo(delhiDay(date)) });
const boardOf = (html) => html.slice(html.indexOf('<table class="board">'), html.indexOf('</table>', html.indexOf('<table class="board">')) + 8);

const ROUTES = () => ['/', '/docs', '/playground', '/guides', `/guides/${mod.guides.GUIDES[0].id}`, '/status', '/no-such-page'];

test('the prerendered page (snapshot state) shows build-time figures, says so, and has no banner', () => {
  const html = page('/', snapshotState(snap));
  assert.equal(count(html, 'data-banner'), 0);
  assert.match(plain(html), new RegExp(`Data up to ${formatDate(snap.meta.last_date)}\\. Checking for newer figures`));
  assert.match(html, /<svg[^>]*role="img"/);
  // The exact sentence for each kind of window is covered in src/lib/history.test.mjs.
  assert.match(plain(html), /Delhi petrol (held at|ended at|rose from|fell from) \d+\.\d{2}/);
  assert.ok(html.includes(snap.latest.petrol.delhi.toFixed(2)));
});

test('fresh live data says it is live and shows no banner on any page', () => {
  const state = fresh();
  assert.match(plain(page('/', state)), /Live from the API: newest day/);
  for (const route of ROUTES()) assert.equal(count(page(route, state), 'data-banner'), 0, route);
});

test('two days behind is normal; three or more puts one banner on every page, linking to the status page', () => {
  assert.equal(bannerFor(stale(2)), null);
  for (const route of ROUTES()) assert.equal(count(page(route, stale(2)), 'data-banner'), 0, `${route} at 2 days`);
  for (const route of ROUTES()) {
    const html = page(route, stale(5));
    assert.equal(count(html, 'class="data-banner data-banner--stale"'), 1, route);
    assert.match(plain(html), /Prices are behind\./, route);
    assert.match(plain(html), /5 days ago/, route);
    assert.match(html, /<a href="\/status">Status page<\/a>/, route);
    assert.match(html, /role="status"/, route);
  }
});

test('offline keeps the build-time figures on screen, says so everywhere, and offers a retry', () => {
  const state = offline();
  for (const route of ROUTES()) {
    const html = page(route, state);
    assert.equal(count(html, 'data-banner--offline'), 1, route);
    assert.match(plain(html), /Live data unavailable\./, route);
    assert.match(plain(html), /Could not reach the API\. Check your connection/, route);
    assert.match(plain(html), /Try again/, route);
    assert.match(plain(html), /7 days ago/, `${route}: the build is seven days old`);
  }
  const home = plain(page('/', state));
  assert.match(home, /Showing data from \d+ \w+ \d{4}, the last build\. The live API did not answer\./);
  assert.ok(page('/', state).includes(snap.latest.diesel.kolkata.toFixed(2)), 'the build-time board is still drawn');
});

test('with no last-change dates the board shows the change over 1, 7 and 30 days under every price, and no "last change" or old date', () => {
  for (const [name, state] of [['live', fresh()], ['stale', stale()]]) {
    const board = boardOf(page('/', state));
    assert.equal(count(board, 'class="board__changes"'), 8, `${name}: one block per city and fuel`);
    assert.equal(count(board, '<dt>1 day</dt>'), 8, name);
    assert.equal(count(board, '<dt>7 days</dt>'), 8, name);
    assert.equal(count(board, '<dt>30 days</dt>'), 8, name);
    assert.doesNotMatch(plain(board), /Last change|No change on record|Unchanged for|2026-/, `${name}: nothing about an old price move`);
    assert.match(plain(board), /Under each price: the change over the last 1, 7 and 30 days/, name);
  }
});

test('a price that has held for a month or more says for how long instead of a row of zeros, in the build and when live', () => {
  // Live: every price last moved 60 days before the build, so the outcome does not depend on the stored data.
  const since = isoDaysFrom(snap.latest.date, -60);
  const live = readLive(metaBody(), latestBody(snap.latest, lastChangeOn(since)), NOW, monthBody());
  const board = boardOf(page('/', live));
  assert.equal(count(board, 'class="board__held"'), 8, 'one line per city and fuel');
  assert.equal(count(board, 'board__changes'), 0, 'no rows of changes');
  assert.equal(count(plain(board), `Unchanged for ${formatCount(60)} days since ${formatDate(since)}`), 8);
  assert.doesNotMatch(plain(board), /Last change|No change on record/, 'no old wording');
  assert.match(plain(board), /Under each price: how long it has stayed the same\./);
  assert.ok(board.includes(snap.latest.petrol.delhi.toFixed(2)));

  // Prerendered: the build's own last-change dates decide, price by price, which cells say how long they held.
  const built = snap.examples.latest.body.meta.last_change;
  const heldCells = ['petrol', 'diesel'].flatMap((fuel) =>
    ['delhi', 'mumbai', 'chennai', 'kolkata'].map((city) => built?.[fuel]?.[city]?.date).filter((d) => d && daysBetween(d, snap.latest.date) >= 30),
  );
  const prerendered = plain(boardOf(page('/', snapshotState(snap))));
  assert.equal(count(prerendered, 'Unchanged for'), heldCells.length, 'one held line per price that has not moved for 30 days or more');
  for (const d of heldCells) assert.ok(prerendered.includes(`Unchanged for ${formatCount(daysBetween(d, snap.latest.date))} days since ${formatDate(d)}`), d);
});

test('a price that moved lately still shows its change, next to the others that have held', () => {
  const newest = weekAfterBuild();
  const day = delhiDay(newest);
  const rows = rowsUpTo(day);
  const lastChange = lastChangeOn(isoDaysFrom(snap.latest.date, -60), { 'petrol.delhi': newest });
  const state = readLive(metaBody({ last_date: newest }), latestBody(day, lastChange), NOW, { success: true, data: rows });
  const board = boardOf(page('/', state));
  assert.equal(count(board, 'class="board__held"'), 7);
  assert.equal(count(board, 'class="board__changes"'), 1);
  assert.ok(plain(board).includes(delhiCell(rows, newest)), delhiCell(rows, newest));
  assert.ok(delhiCell(rows, newest).includes('1 day +1.38 7 days +1.38'), 'the move is one day old and the week before it was flat');
  assert.match(plain(board), /how long it has stayed the same, or its change over the last 1, 7 and 30 days/);
});

test('without a month of rows the board shows today\'s prices alone, with no changes and no made-up zeros', () => {
  const board = boardOf(page('/', readLive(metaBody(), latestBody(), NOW)));
  assert.equal(count(board, 'board__changes'), 0);
  assert.doesNotMatch(plain(board), /Under each price/);
  assert.ok(board.includes(snap.latest.petrol.delhi.toFixed(2)));
});

test('without last-change dates, a price that did not move reads 0.00 for every period', () => {
  const flat = { success: true, data: monthBody().data.map((row) => ({ ...snap.latest, date: row.date })) };
  const board = plain(boardOf(page('/', readLive(metaBody(), latestBody(), NOW, flat))));
  assert.equal(count(board, '1 day 0.00 7 days 0.00 30 days 0.00'), 8);
});

test('a day newer than the build reaches the board and moves the playground window with it', () => {
  const newest = weekAfterBuild();
  const state = newerDay(newest);
  const home = page('/', state);
  assert.ok(home.includes(newDelhi().toFixed(2)), 'the new Delhi price is on the board');
  const cell = delhiCell(rowsUpTo(delhiDay(newest)), newest);
  assert.ok(plain(boardOf(home)).includes(cell), `and what it moved over the last 1, 7 and 30 days: ${cell}`);
  assert.match(plain(home), new RegExp(`newest day ${formatDate(newest)}`));
  const playground = page('/playground', state);
  const { from } = exampleWindow(newest, 30);
  assert.match(playground, new RegExp(`<input type="date" [^>]*max="${newest}"`));
  assert.ok(playground.includes(`value="${from}"`), `from defaults to ${from}`);
  assert.ok(playground.includes(`value="${newest}"`), 'to defaults to the newest day');
});

test('the playground is compact: one form, chart and table together, code samples folded, newest day first', () => {
  const html = page('/playground', fresh());
  assert.equal(count(html, '<form'), 1);
  assert.equal(count(html, '<select'), 2);
  assert.equal(count(html, 'type="date"'), 2);
  assert.match(html, /<details class="fold">/, 'code samples start folded');
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.ok(html.indexOf('class="results__chart"') < html.indexOf('class="results__table"'));
  assert.match(html, new RegExp(`<tbody><tr><th scope="row">${formatDate(snap.meta.last_date)}</th>`), 'the newest day is the first table row');
  const text = plain(html);
  assert.match(text, /Delhi, last 30 days/);
  assert.match(text, /All four cities, last 7 days/);
  assert.match(text, /Delhi petrol, last 12 months/);
});

test('no page hardcodes a May window: the playground and docs follow the newest day', () => {
  for (const route of ['/playground', '/docs']) {
    const html = page(route, fresh());
    assert.doesNotMatch(plain(html), /May 2022|2022-05/, route);
  }
  const docs = page('/docs', fresh());
  const week = exampleWindow(snap.meta.last_date, 7);
  assert.ok(docs.includes(`from=${week.from}&amp;to=${week.to}`), 'the range example covers the last 7 days');
});

// --- the chart component ----------------------------------------------------------------------------------
const rowsOf = (n, city = 'delhi', start = '2026-01-01') =>
  Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    return { date, petrol: { [city]: 100 + Math.floor(i / 10) }, diesel: { [city]: 90 + Math.floor(i / 15) } };
  });
const viewOf = (rows, city = 'delhi') => ({
  key: 'k',
  city,
  window: { from: rows[0]?.date ?? '2026-01-01', to: rows[rows.length - 1]?.date ?? '2026-01-31' },
  rows,
});
const chartHtml = (props) =>
  quietly(() => renderToString(h(mod.view.default, { rangeId: '3m', onRange() {}, city: 'delhi', onCity() {}, ...props })));

test('the chart controls mark exactly one range as selected and list the four cities', () => {
  const html = chartHtml({ view: viewOf(rowsOf(30)), rangeId: '1y' });
  assert.equal(count(html, 'aria-pressed="true"'), 1);
  assert.match(html, /aria-pressed="true">1 year</);
  assert.match(html, /aria-pressed="false">3 months</);
  assert.match(html, /aria-pressed="false">All</);
  for (const city of ['Delhi', 'Mumbai', 'Chennai', 'Kolkata']) assert.match(html, new RegExp(`<option value="[a-z]+"[^>]*>${city}</option>`));
});

test('an empty range says there are no prices instead of drawing nothing', () => {
  const html = chartHtml({ view: viewOf([]) });
  assert.match(plain(html), /There are no prices in this range\./);
  assert.match(plain(html), /0 days/);
  assert.doesNotMatch(html, /<svg[^>]*role="img"/);
  assert.equal(count(html, 'class="summary"'), 0);
});

test('a single day gets a sentence but no chart', () => {
  const html = chartHtml({ view: viewOf(rowsOf(1)) });
  assert.match(plain(html), /A chart needs at least two days of prices in the range\./);
  assert.match(plain(html), /1 day\b/);
  assert.match(plain(html), /Delhi petrol was 100\.00 on 1 Jan 2026\./);
});

test('a flat quarter is described in words and still drawn', () => {
  const flat = rowsOf(93).map((r) => ({ ...r, petrol: { delhi: 102.12 }, diesel: { delhi: 95.2 } }));
  const html = chartHtml({ view: viewOf(flat) });
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(plain(html), /Delhi petrol held at 102\.12 on all 93 days shown, with no revision\./);
  assert.match(plain(html), /Delhi diesel held at 95\.20 on all 93 days shown, with no revision\./);
});

test('while another selection loads, the old chart stays up, dimmed, and the page says what is loading', () => {
  const html = chartHtml({ view: viewOf(rowsOf(30)), city: 'mumbai', loading: true });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /class="is-loading"/);
  assert.match(plain(html), /Delhi, 1 Jan 2026 to 30 Jan 2026, 30 days · Loading Mumbai…/, 'labels still describe the chart on screen');
});

test('a failed request shows its message, offers a retry, and says what is still on screen', () => {
  const html = chartHtml({ view: viewOf(rowsOf(30)), city: 'mumbai', problem: 'Could not reach the API. Check your connection and try again.' });
  assert.match(html, /role="alert"/);
  assert.match(plain(html), /Could not reach the API/);
  assert.match(plain(html), /Still showing Delhi, 1 Jan 2026 to 30 Jan 2026\./);
  assert.match(plain(html), /Try again/);
  const fallback = chartHtml({ view: viewOf(rowsOf(30)), problem: 'The API answered 503.', fallback: true });
  assert.match(plain(fallback), /Showing the figures from the last build\./);
  assert.doesNotMatch(plain(fallback), /Still showing/);
});

test('the whole history draws: every stored day, and the numbered moves only for Delhi and only inside the range', () => {
  const delhi = realDays.map((d) => ({ date: d.date, petrol: { delhi: d.petrol.delhi }, diesel: { delhi: d.diesel.delhi } }));
  const markers = snap.highlights.map((m) => ({ n: m.n, date: m.date, series: m.moves.petrol ? 'delhi.petrol' : 'delhi.diesel' }));
  const all = chartHtml({ view: viewOf(delhi), rangeId: 'all', markers });
  assert.match(plain(all), new RegExp(`${delhi.length.toLocaleString('en-IN')} days`));
  assert.equal(count(all, 'class="marker"'), markers.length, 'every numbered move is inside the full history');
  assert.match(plain(all), /Numbered points mark the largest single-day moves/);
  const lastThreeMonths = delhi.slice(-93);
  const recent = chartHtml({ view: viewOf(lastThreeMonths), markers });
  const inside = markers.filter((m) => m.date >= lastThreeMonths[0].date && m.date <= lastThreeMonths.at(-1).date).length;
  assert.equal(count(recent, 'class="marker"'), inside, 'only the moves inside the last three months are drawn');
  const mumbai = realDays.map((d) => ({ date: d.date, petrol: { mumbai: d.petrol.mumbai }, diesel: { mumbai: d.diesel.mumbai } }));
  const other = chartHtml({ view: viewOf(mumbai, 'mumbai'), city: 'mumbai', rangeId: 'all', markers });
  assert.equal(count(other, 'class="marker"'), 0, 'the numbered moves are Delhi moves');
  assert.match(plain(other), /Mumbai petrol (rose|fell)/);
});

// --- the playground result --------------------------------------------------------------------------------
const resultHtml = (result, over = {}) =>
  quietly(() =>
    renderToString(
      h(mod.result.default, { result, first: snap.meta.first_date, last: snap.meta.last_date, origin: 'https://api.test', ...over }),
    ),
  );
const resultOf = (rows, ms = 12) => ({ path: '/v1/prices?x', body: { success: true, data: rows, meta: {} }, ms });

test('a result with no rows names the stored range instead of showing an empty table', () => {
  const html = resultHtml(resultOf([]));
  assert.match(plain(html), /No days in that range\. The stored data runs from 16 Jun 2017 to/);
  assert.equal(count(html, '<table'), 0);
  assert.match(plain(html), /0 rows/);
});

test('one row gets a table but no chart; more than a hundred rows say only the newest hundred are listed', () => {
  const one = resultHtml(resultOf(rowsOf(1)));
  assert.match(plain(one), /A chart needs at least two days\./);
  assert.match(plain(one), /1 row,/);
  const long = resultHtml(resultOf(rowsOf(400)));
  assert.match(plain(long), /The table shows the newest 100 of 400 rows/);
  assert.equal(count(long, '<tr>'), 101, 'a header row and one hundred days');
  const firstBodyRow = long.slice(long.indexOf('<tbody>'));
  assert.ok(firstBodyRow.includes(formatDate(rowsOf(400)[399].date)), 'newest first');
});

test('eight lines are too many: four cities with two fuels chart petrol only and say so', () => {
  const cities = ['delhi', 'mumbai', 'chennai', 'kolkata'];
  const rows = rowsOf(10).map((r) => ({
    date: r.date,
    petrol: Object.fromEntries(cities.map((c, i) => [c, 100 + i + (r.date > '2026-01-05' ? 1 : 0)])),
    diesel: Object.fromEntries(cities.map((c, i) => [c, 90 + i])),
  }));
  const html = resultHtml(resultOf(rows));
  assert.match(plain(html), /The chart shows petrol only/);
  assert.equal(count(html, 'class="legend"') , 1);
  assert.equal(count(html, '<li><svg'), 4, 'four petrol lines in the legend');
  assert.match(plain(html), /Delhi petrol/);
  assert.match(plain(html), /Kolkata diesel/, 'the table still has both fuels');
});

test('a result captured at build time says so, a live one shows its timing, and the samples are folded', () => {
  assert.match(plain(resultHtml(resultOf(rowsOf(5), null))), /captured when the site was built/);
  assert.match(plain(resultHtml(resultOf(rowsOf(5), 87))), /5 rows, 87 ms/);
  assert.match(resultHtml(resultOf(rowsOf(5))), /<details class="fold"><summary>Code samples and the raw response<\/summary>/);
  assert.match(resultHtml(resultOf(rowsOf(5), 3), { loading: true }), /aria-busy="true"/);
});

// --- a page that fails to draw ----------------------------------------------------------------------------
test('the error boundary turns a failed render into a message with a way out, and a healthy page passes through', () => {
  const Boundary = mod.boundary.default;
  assert.deepEqual(Boundary.getDerivedStateFromError(new Error('boom')), { failed: true });
  const healthy = new Boundary({ children: h('p', null, 'fine') });
  assert.equal(quietly(() => renderToString(healthy.render())), '<p>fine</p>');
  const broken = new Boundary({ children: h('p', null, 'never shown') });
  broken.state = Boundary.getDerivedStateFromError(new Error('boom'));
  const html = quietly(() => renderToString(broken.render()));
  assert.match(html, /role="alert"/);
  assert.match(plain(html), /This page could not be shown/);
  assert.match(html, /<a href="\/docs">API reference<\/a>/);
  assert.match(plain(html), /Reload/);
  assert.doesNotMatch(html, /never shown/);
});

test('every route renders inside the boundary without changing its content', () => {
  for (const route of ROUTES()) assert.match(page(route, fresh()), /<main id="main">/, route);
});
