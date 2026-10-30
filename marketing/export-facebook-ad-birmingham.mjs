/**
 * Export Birmingham geo Facebook ad (1080×1080 PNG).
 * Usage: node marketing/export-facebook-ad-birmingham.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 1080;
const htmlPath = path.join(__dirname, 'social', 'facebook-ad-birmingham.html');
const outDir = path.join(__dirname, 'exports');
const outPath = path.join(outDir, 'facebook-ad-birmingham-1080.png');

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => {
  const img = document.querySelector('.brand');
  return img && img.complete && img.naturalWidth > 0;
});
await page.waitForTimeout(400);

await page.locator('#canvas').screenshot({ path: outPath, type: 'png' });
await browser.close();

console.log('Exported:', outPath);
