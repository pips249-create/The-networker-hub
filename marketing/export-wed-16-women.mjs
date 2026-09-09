/**
 * Export Wed 16 Sep women-in-business graphic.
 * Usage: node marketing/export-wed-16-women.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'social', 'wed-16-women-in-business.html');
const outDir = path.join(__dirname, 'social', 'sep-2026-posts');
const outHi = path.join(outDir, '07-wed-16-women-in-business-2x.png');
const outPath = path.join(outDir, '07-wed-16-women-in-business.png');
const aliasPath = path.join(outDir, '07-wed-16-for-networkers.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('#canvas img')];
  return imgs.length >= 7 && imgs.every((img) => img.complete && img.naturalWidth > 0);
}, { timeout: 20000 });
await page.waitForTimeout(400);
await page.locator('#canvas').screenshot({ path: outHi, type: 'png' });
await browser.close();

spawnSync('sips', ['-z', '1080', '1080', outHi, '--out', outPath], { encoding: 'utf8' });
spawnSync('cp', [outPath, aliasPath]);
spawnSync('rm', [outHi]);

console.log('Exported:', outPath);
console.log('Also updated:', aliasPath);
