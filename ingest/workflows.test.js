// A job that runs the project's npm scripts needs the project's dependencies first. The backend
// tests import express, which a clean runner does not have until `npm ci` has run. The check is
// per job (a later job does not inherit an earlier job's install) and sees `run: |` blocks too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const workflows = readdirSync(dir).filter((f) => f.endsWith('.yml'));

export function jobsMissingInstall(text) {
  const start = text.search(/^jobs:\s*$/m);
  if (start === -1) return [];
  const jobs = [];
  let current = null;
  for (const line of text.slice(start).split('\n').slice(1)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (header) {
      current = { name: header[1], lines: [] };
      jobs.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  const code = (l) => !/^\s*#/.test(l);
  return jobs
    .filter((job) => {
      const npm = job.lines.findIndex((l) => code(l) && /\bnpm (test|run)\b/.test(l));
      if (npm === -1) return false;
      const install = job.lines.findIndex((l) => code(l) && /\bnpm ci\b/.test(l));
      return install === -1 || install > npm;
    })
    .map((job) => job.name);
}

test('the checker names a job that runs npm test without an earlier npm ci', () => {
  const yaml = [
    'jobs:',
    '  good:',
    '    steps:',
    '      - run: npm ci',
    '      - run: npm test',
    '  late-install:',
    '    steps:',
    '      - run: npm test',
    '      - run: npm ci',
    '  inherits-nothing:',
    '    steps:',
    '      - run: |',
    '          echo start',
    '          npm run build',
    '  only-a-comment:',
    '    steps:',
    '      # npm test happens elsewhere',
    '      - run: node ingest/freshness.js',
  ].join('\n');
  assert.deepEqual(jobsMissingInstall(yaml), ['late-install', 'inherits-nothing']);
});

test('there are workflows to check', () => {
  assert.ok(workflows.length >= 3);
});

for (const name of workflows) {
  test(`${name}: every job that runs npm installs first`, () => {
    assert.deepEqual(jobsMissingInstall(readFileSync(new URL(name, dir), 'utf8')), []);
  });
}

test('workflows do not point at a file that is not in the repository', () => {
  for (const name of workflows) {
    for (const m of readFileSync(new URL(name, dir), 'utf8').matchAll(/\bdocs\/[A-Za-z0-9_.-]+\.md\b/g)) {
      assert.doesNotThrow(() => readFileSync(new URL(`../${m[0]}`, import.meta.url)), `${name} mentions ${m[0]}, which does not exist`);
    }
  }
});

// The daily data job: what makes it dependable is in the workflow text, so a careless edit is caught here.
const ingestYml = () => readFileSync(new URL('fuel-ingest.yml', dir), 'utf8');

test('fuel-ingest runs on a schedule several times a day and can still be started by hand', () => {
  const yml = ingestYml();
  assert.match(yml, /^on:\n {2}schedule:\n {4}- cron: '[0-9]+ \*\/[0-9]+ \* \* \*'/m, 'a cron with an hourly step');
  assert.match(yml, /workflow_dispatch/);
});

test('fuel-ingest never overlaps itself', () => {
  assert.match(ingestYml(), /concurrency:\n {2}group: fuel-ingest\n {2}cancel-in-progress: false/);
});

test('fetch-proof has no schedule, so two jobs do not both ask PPAC for the same file', () => {
  assert.doesNotMatch(readFileSync(new URL('fetch-proof.yml', dir), 'utf8'), /^\s*schedule:/m);
});

test('the commit step retries pull and push, so a concurrent push does not lose a day', () => {
  const yml = ingestYml();
  assert.match(yml, /for attempt in 1 2 3/);
  assert.match(yml, /git pull --rebase/);
  assert.match(yml, /git push/);
});

test('a failed or stale run opens one rolling issue and a good run closes it', () => {
  const yml = ingestYml();
  assert.match(yml, /issues: write/);
  assert.match(yml, /notify:/);
  assert.match(yml, /gh issue create/);
  assert.match(yml, /gh issue close/);
  assert.match(yml, /gh issue edit/);
  assert.match(yml, /needs: \[ingest, freshness\]/);
});
