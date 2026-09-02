/**
 * Export 1200×630 Open Graph share image for The Networker UK.
 * Usage: node marketing/export-og-image-uk.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'social', 'og-image-uk.html');
const outPath = path.join(__dirname, '..', 'assets', 'logo-networker-uk-og.png');
const hiRes = outPath.replace(/\.png$/, '-2x.png');

const browser = await chromium.launch({ headless: true });
// 2× export then downscale → sharper edges after LinkedIn compression
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded');
await page.waitForTimeout(600);
await page.locator('#canvas').screenshot({ path: hiRes, type: 'png' });
await browser.close();

const sips = spawnSync('sips', ['-z', '630', '1200', hiRes, '--out', outPath], {
  encoding: 'utf8',
});
if (sips.status !== 0) {
  console.error(sips.stderr || sips.stdout);
  process.exit(1);
}
fs.unlinkSync(hiRes);

console.log('Exported:', outPath);
