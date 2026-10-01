/**
 * Export square feed post: We're live (1 September launch).
 * Usage: node marketing/export-we-are-live-post.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = 1080;
const htmlPath = path.join(__dirname, 'social', 'we-are-live.html');
const outPath = path.join(__dirname, 'social', 'we-are-live-1080.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

await page.locator('#canvas').screenshot({ path: outPath, type: 'png' });
await browser.close();

console.log('Exported:', outPath);
