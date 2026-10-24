// Renders public/og-image.png (1200x630) from the latest stored prices and the site's colours.
// Run after a data refresh if you want the card to show the newest day:
//   npm install --no-save puppeteer-core && node scripts/build-snapshot.mjs && node scripts/og-image.mjs
// It drives an installed Chrome or Edge; set CHROME_PATH if neither default path exists.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const snapshot = JSON.parse(readFileSync(new URL('src/generated/snapshot.json', root), 'utf8'));
const css = readFileSync(new URL('src/index.css', root), 'utf8');
const color = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const { latest, meta } = snapshot;
const cities = ['delhi', 'mumbai', 'chennai', 'kolkata'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const [y, m, d] = latest.date.split('-').map(Number);
const asOf = `${d} ${MONTHS[m - 1]} ${y}`;

const rows = cities
  .map(
    (c) => `<tr><th>${c[0].toUpperCase()}${c.slice(1)}</th><td class="p">${latest.petrol[c].toFixed(2)}</td><td class="d">${latest.diesel[c].toFixed(2)}</td></tr>`,
  )
  .join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: ${color.paper}; color: ${color.ink}; font-family: 'IBM Plex Sans', sans-serif;
    padding: 64px 72px; display: grid; grid-template-columns: 1fr 440px; gap: 64px; }
  .brand { font: 600 28px 'Source Serif 4', serif; }
  h1 { margin-top: 40px; font: 600 62px/1.1 'Source Serif 4', serif; letter-spacing: -0.01em; }
  p { margin-top: 24px; font-size: 26px; line-height: 1.4; color: ${color.muted}; }
  .board { align-self: center; background: ${color['sheet']}; border: 1px solid ${color.rule}; padding: 28px 32px; }
  .board small { display: block; margin-bottom: 14px; font-size: 20px; color: ${color.muted}; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 0; border-top: 1px solid ${color.rule}; font-size: 28px; text-align: right; }
  th { text-align: left; font-weight: 600; font-size: 22px; }
  thead th:first-child { text-align: left; }
  td { font-family: 'IBM Plex Mono', monospace; font-weight: 500; }
  thead th { border-top: 0; font-size: 20px; text-align: right; border-bottom: 3px solid currentColor; padding-bottom: 8px; }
  thead th.p, td.p { color: ${color.petrol}; } thead th.d, td.d { color: ${color.diesel}; }
</style></head><body>
  <div><div class="brand">India Petroleum API</div>
  <h1>Daily petrol and diesel prices for four Indian metros</h1>
  <p>Keyless REST API on PPAC&rsquo;s published table, ${meta.day_count.toLocaleString('en-IN')} days since June 2017.</p></div>
  <div class="board"><small>Rupees per litre, ${asOf}</small>
  <table><thead><tr><th>City</th><th class="p">Petrol</th><th class="d">Diesel</th></tr></thead><tbody>${rows}</tbody></table></div>
</body></html>`;

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found; set CHROME_PATH.');

const { default: puppeteer } = await import('puppeteer-core');
const browser = await puppeteer.launch({ executablePath, headless: 'new' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const out = fileURLToPath(new URL('public/og-image.png', root));
  await page.screenshot({ path: out, type: 'png' });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
