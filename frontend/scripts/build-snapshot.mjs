// Writes src/generated/snapshot.json from the stored data and from the real API's own answers.
// Run by every build, so prerendered pages carry the numbers the API will return.
//   node scripts/build-snapshot.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app.js';
import { DEFAULT_DATA_DIR } from '../../backend/src/fuel-service.js';
import { examplePaths } from './example-paths.mjs';
import { buildSnapshot } from './snapshot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'src', 'generated', 'snapshot.json');

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DEFAULT_DATA_DIR, name), 'utf8'));

async function collectExamples(meta) {
  const { app } = createApp({ rateLimit: false, quiet: true });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const examples = {};
    for (const [key, route] of Object.entries(examplePaths(meta))) {
      const res = await fetch(base + route);
      examples[key] = { path: route, status: res.status, body: await res.json() };
    }
    return examples;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export async function writeSnapshot() {
  const days = readJson('daily.json').days;
  const moves = readJson('changes.json').changes;
  const meta = readJson('meta.json');
  const snapshot = buildSnapshot({ days, moves, meta, examples: await collectExamples(meta) });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(snapshot)}\n`);
  return snapshot;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const snapshot = await writeSnapshot();
  console.log(
    `[snapshot] ${snapshot.meta.day_count} days, ${snapshot.meta.first_date} to ${snapshot.meta.last_date}, ` +
      `${Object.keys(snapshot.examples).length} API examples -> ${path.relative(process.cwd(), outFile)}`,
  );
}
