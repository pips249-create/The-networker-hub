/**
 * Export 1200×630 Open Graph share image for The Networker International.
 * Usage: node marketing/export-og-image-international.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'social', 'og-image-international.html');
const outPath = path.join(__dirname, '..', 'assets', 'logo-networker-international-og.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('#canvas').screenshot({ path: outPath, type: 'png' });
await browser.close();

console.log('Exported:', outPath);
