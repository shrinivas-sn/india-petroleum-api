import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDES } from './guidesData.js';
import { NOT_FOUND_META, PAGE_META, resolvePageMeta } from './pageMeta.js';

const all = [
  ...Object.entries(PAGE_META).map(([route, meta]) => [route, meta]),
  ...GUIDES.map((g) => [`/guides/${g.id}`, resolvePageMeta(`/guides/${g.id}`, GUIDES)]),
  ['not found', NOT_FOUND_META],
];

test('titles are under 60 characters and descriptions are 50 to 160', () => {
  for (const [route, meta] of all) {
    assert.ok(meta.title.length <= 60, `${route} title is ${meta.title.length}`);
    assert.ok(meta.description.length >= 50 && meta.description.length <= 160, `${route} description is ${meta.description.length}`);
  }
});

test('every title and description is unique', () => {
  const titles = all.map(([, m]) => m.title);
  const descriptions = all.map(([, m]) => m.description);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('an unknown guide id resolves to the not-found metadata', () => {
  assert.equal(resolvePageMeta('/guides/nope', GUIDES), NOT_FOUND_META);
  assert.equal(resolvePageMeta('/nope', GUIDES), NOT_FOUND_META);
});
