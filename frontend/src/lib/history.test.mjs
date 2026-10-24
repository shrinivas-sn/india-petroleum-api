import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchHistory } from './history.js';
import { MAX_REQUEST_DAYS, chunks } from './range.js';
import { describeRows } from './summary.js';

const rowFor = (date, petrol, diesel) => ({ date, petrol: { delhi: petrol }, diesel: { delhi: diesel } });
const addDay = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** A fake API that answers /v1/prices with one row per day, and records what it was asked. */
function fakeApi(price = () => [100, 90]) {
  const asked = [];
  const get = async (path) => {
    const url = new URL(path, 'https://example.test');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    asked.push({ path: url.pathname, city: url.searchParams.get('city'), from, to });
    const data = [];
    for (let d = from; d <= to; d = addDay(d, 1)) data.push(rowFor(d, ...price(d)));
    return { body: { success: true, data, meta: { count: data.length } }, status: 200, ms: 3 };
  };
  return { get, asked };
}

test('fetchHistory asks once for a short range and returns the rows in date order', async () => {
  const api = fakeApi();
  const rows = await fetchHistory(api.get, { city: 'delhi', from: '2026-07-23', to: '2026-10-23' });
  assert.equal(api.asked.length, 1);
  assert.deepEqual(api.asked[0], { path: '/v1/prices', city: 'delhi', from: '2026-07-23', to: '2026-10-23' });
  assert.equal(rows.length, 93);
  assert.equal(rows[0].date, '2026-07-23');
  assert.equal(rows[rows.length - 1].date, '2026-10-23');
});

test('fetchHistory splits a range longer than the API allows and joins it without a gap or a repeat', async () => {
  const api = fakeApi();
  const to = addDay('2017-06-16', MAX_REQUEST_DAYS + 400);
  const rows = await fetchHistory(api.get, { city: 'mumbai', from: '2017-06-16', to });
  assert.equal(api.asked.length, chunks('2017-06-16', to).length);
  assert.ok(api.asked.length >= 2);
  assert.equal(rows.length, MAX_REQUEST_DAYS + 401);
  for (let i = 1; i < rows.length; i += 1) assert.equal(rows[i].date, addDay(rows[i - 1].date, 1));
});

test('fetchHistory fails if any part fails, so a half chart is never drawn', async () => {
  let calls = 0;
  const get = async () => {
    calls += 1;
    if (calls === 2) throw new Error('Could not reach the API.');
    return { body: { success: true, data: [rowFor('2017-06-16', 1, 1)] }, status: 200, ms: 1 };
  };
  await assert.rejects(fetchHistory(get, { city: 'delhi', from: '2017-06-16', to: addDay('2017-06-16', MAX_REQUEST_DAYS + 5) }), /Could not reach/);
});

test('fetchHistory rejects an answer that is not a list of dated rows', async () => {
  const bad = async () => ({ body: { success: true, data: { not: 'a list' } }, status: 200, ms: 1 });
  await assert.rejects(fetchHistory(bad, { city: 'delhi', from: '2026-10-01', to: '2026-10-05' }), /unexpected shape/);
  const undated = async () => ({ body: { success: true, data: [{ petrol: {} }] }, status: 200, ms: 1 });
  await assert.rejects(fetchHistory(undated, { city: 'delhi', from: '2026-10-01', to: '2026-10-05' }), /unexpected shape/);
});

test('fetchHistory returns an empty list for a window with no rows', async () => {
  const get = async () => ({ body: { success: true, data: [] }, status: 200, ms: 1 });
  assert.deepEqual(await fetchHistory(get, { city: 'delhi', from: '2026-10-01', to: '2026-10-05' }), []);
});

test('describeRows says a flat window was flat, in words', () => {
  const rows = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => rowFor(d, 102.12, 95.2));
  const [petrol, diesel] = describeRows(rows, 'delhi');
  assert.equal(petrol.fuel, 'petrol');
  assert.equal(petrol.text, 'Delhi petrol held at 102.12 on all 3 days shown, with no revision.');
  assert.equal(diesel.text, 'Delhi diesel held at 95.20 on all 3 days shown, with no revision.');
});

test('describeRows names the direction, the revision count and the latest revision date', () => {
  const rows = [
    rowFor('2026-05-18', 97.77, 90.67),
    rowFor('2026-05-19', 98.64, 91.58),
    rowFor('2026-05-20', 98.64, 91.58),
    rowFor('2026-05-23', 99.51, 92.49),
    rowFor('2026-05-25', 102.12, 95.2),
  ];
  const [petrol] = describeRows(rows, 'delhi');
  assert.equal(petrol.text, 'Delhi petrol rose from 97.77 to 102.12 over 3 revisions, the latest on 25 May 2026.');
});

test('describeRows handles a fall, a single revision and a return to the starting price', () => {
  const fall = describeRows([rowFor('2022-05-21', 105.41, 96.67), rowFor('2022-05-22', 96.72, 89.62)], 'delhi');
  assert.equal(fall[0].text, 'Delhi petrol fell from 105.41 to 96.72 over 1 revision, the latest on 22 May 2022.');
  const back = describeRows([rowFor('2026-01-01', 100, 90), rowFor('2026-01-02', 101, 90), rowFor('2026-01-03', 100, 90)], 'delhi');
  assert.equal(back[0].text, 'Delhi petrol ended at 100.00, where it started, after 2 revisions, the latest on 3 Jan 2026.');
  assert.equal(back[1].text, 'Delhi diesel held at 90.00 on all 3 days shown, with no revision.');
});

test('describeRows copes with one row, no rows, and a fuel or city that is missing', () => {
  assert.equal(describeRows([rowFor('2026-10-23', 102.12, 95.2)], 'delhi')[0].text, 'Delhi petrol was 102.12 on 23 Oct 2026.');
  assert.deepEqual(describeRows([], 'delhi'), []);
  const partial = [{ date: '2026-10-22', petrol: { delhi: 100 } }, { date: '2026-10-23', petrol: { delhi: 100 } }];
  const out = describeRows(partial, 'delhi');
  assert.equal(out.length, 1, 'diesel has no values, so it gets no sentence');
  assert.deepEqual(describeRows(partial, 'mumbai'), []);
});
