import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteUrl } from './site-url.mjs';

test('no configuration means no canonical origin', () => {
  assert.equal(resolveSiteUrl({}, {}), null);
});

test('SITE_URL from the environment wins over the file and over Vercel', () => {
  assert.equal(
    resolveSiteUrl({ SITE_URL: 'https://a.example', VERCEL_PROJECT_PRODUCTION_URL: 'b.example' }, { SITE_URL: 'https://c.example' }),
    'https://a.example',
  );
});

test('the Vercel production host is used when nothing else is set', () => {
  assert.equal(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'fuel.example.app' }, {}), 'https://fuel.example.app');
});

test('a trailing slash is normalised away', () => {
  assert.equal(resolveSiteUrl({ SITE_URL: 'https://a.example/' }, {}), 'https://a.example');
});

test('http, paths and garbage are refused', () => {
  assert.throws(() => resolveSiteUrl({ SITE_URL: 'http://a.example' }, {}), /https/);
  assert.throws(() => resolveSiteUrl({ SITE_URL: 'https://a.example/docs' }, {}), /no path/);
  assert.throws(() => resolveSiteUrl({ SITE_URL: 'not a url' }, {}), /not a valid URL/);
});
