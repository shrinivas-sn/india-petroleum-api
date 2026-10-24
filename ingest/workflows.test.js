// A workflow that runs the project's tests needs the project's dependencies first. The backend
// tests import express, which a clean runner does not have until `npm ci` has run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const workflows = readdirSync(dir).filter((f) => f.endsWith('.yml'));

test('there are workflows to check', () => {
  assert.ok(workflows.length >= 2);
});

for (const name of workflows) {
  test(`${name} installs dependencies before it runs npm`, () => {
    const lines = readFileSync(new URL(name, dir), 'utf8').split('\n');
    const firstNpm = lines.findIndex((l) => /^\s*(-\s*)?run:\s*npm (test|run)\b/.test(l));
    if (firstNpm === -1) return;
    const install = lines.findIndex((l) => /^\s*(-\s*)?run:\s*npm ci\b/.test(l));
    assert.ok(install !== -1 && install < firstNpm, `${name}: line ${firstNpm + 1} runs npm before any "npm ci"`);
  });
}

test('workflows do not point at a file that is not in the repository', () => {
  for (const name of workflows) {
    for (const m of readFileSync(new URL(name, dir), 'utf8').matchAll(/\bdocs\/[A-Za-z0-9_.-]+\.md\b/g)) {
      assert.doesNotThrow(() => readFileSync(new URL(`../${m[0]}`, import.meta.url)), `${name} mentions ${m[0]}, which does not exist`);
    }
  }
});
