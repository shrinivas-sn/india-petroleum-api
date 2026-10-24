import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalHref } from './canonical.js';

test('the canonical keeps its own origin and takes the new path', () => {
  assert.equal(canonicalHref('https://fuel.example/docs', '/playground'), 'https://fuel.example/playground');
  assert.equal(canonicalHref('https://fuel.example/', '/'), 'https://fuel.example/');
  assert.equal(canonicalHref('https://fuel.example/', '/guides/'), 'https://fuel.example/guides');
});

test('an unreplaced template value or a missing canonical is left alone, not thrown on', () => {
  assert.equal(canonicalHref('__SITE_URL__/', '/docs'), null);
  assert.equal(canonicalHref('', '/docs'), null);
  assert.equal(canonicalHref(null, '/docs'), null);
});
