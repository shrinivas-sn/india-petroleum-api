// Contrast of the colours in src/index.css, read from the stylesheet itself so they cannot drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)[1];
const color = Object.fromEntries([...root.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('text colours reach 4.5:1 on the surfaces they sit on', () => {
  const surfaces = ['paper', 'sheet'];
  for (const text of ['ink', 'muted', 'petrol', 'diesel', 'warn', 'danger']) {
    for (const surface of surfaces) {
      assert.ok(ratio(color[text], color[surface]) >= 4.5, `${text} on ${surface} is ${ratio(color[text], color[surface]).toFixed(2)}`);
    }
  }
  assert.ok(ratio(color.ink, color.shade) >= 4.5, 'ink on shade');
  assert.ok(ratio(color.muted, color.shade) >= 4.5, 'muted on shade');
  assert.ok(ratio(color.paper, color.petrol) >= 4.5, 'button text on petrol');
  assert.ok(ratio(color.paper, color.muted) >= 4.5, 'disabled button text on muted');
  assert.ok(ratio(color.paper, color.ink) >= 4.5, 'skip link and chart markers');
});

test('petrol and diesel differ in lightness, not only in hue', () => {
  const ratioOfLuminance = ratio(color.petrol, color.diesel);
  assert.ok(ratioOfLuminance >= 1.5, `petrol against diesel is ${ratioOfLuminance.toFixed(2)}`);
});

test('control borders and the focus ring reach 3:1', () => {
  assert.ok(ratio(color['rule-strong'], color.sheet) >= 3, 'input border on sheet');
  assert.ok(ratio(color['rule-strong'], color.paper) >= 3, 'border on paper');
  assert.ok(ratio(color.focus, color.paper) >= 3, 'focus ring on paper');
  assert.ok(ratio(color.focus, color.sheet) >= 3, 'focus ring on sheet');
});
