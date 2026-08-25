/**
 * Export square feed post: Going bigger (UK + International).
 * Usage: node marketing/export-going-bigger-post.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 1080;
const htmlPath = path.join(__dirname, 'social', 'going-bigger-uk-intl.html');
const outPath = path.join(__dirname, 'social', 'going-bigger-uk-intl-1080.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

await page.locator('#canvas').screenshot({ path: outPath, type: 'png' });
await browser.close();

console.log('Exported:', outPath);
