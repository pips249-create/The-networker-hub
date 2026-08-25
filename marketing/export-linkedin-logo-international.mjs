/**
 * Export The Networker International LinkedIn logo squares (1080 + 400).
 * Usage: node marketing/export-linkedin-logo-international.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'social', 'linkedin-logo-international.html');
const out1080 = path.join(__dirname, 'social', 'linkedin-logo-international-1080.png');
const out400 = path.join(__dirname, 'social', 'linkedin-logo-international-400.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('#canvas').screenshot({ path: out1080, type: 'png' });
await browser.close();

const sips = spawnSync('sips', ['-z', '400', '400', out1080, '--out', out400], {
  encoding: 'utf8',
});
if (sips.status !== 0) {
  console.error(sips.stderr || sips.stdout);
  process.exit(1);
}

console.log('Exported:', out1080);
console.log('Exported:', out400);
