/**
 * Export the sendable A4 organiser leave-behind PDF.
 * Usage: node export-organiser-leavebehind.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'guides', 'organiser-leavebehind.html');
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(root, 'assets', 'guides');
const outName = 'organiser-leavebehind.pdf';

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const outPath = path.join(exportsDir, outName);
const assetPath = path.join(assetsDir, outName);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.pdf({
  path: outPath,
  printBackground: true,
  format: 'A4',
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();

fs.copyFileSync(outPath, assetPath);
console.log('Exported:', outPath);
console.log('Copied to assets:', assetPath);
