/**
 * Export SSL certificate summary PDF for IT / partner sharing.
 * Run: node marketing/export-ssl-certificate-pdf.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultBrowsersPath = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(defaultBrowsersPath)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = defaultBrowsersPath;
}
const htmlPath = path.join(__dirname, 'ssl-certificate-details.html');
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(__dirname, '..', 'assets', 'guides');
const downloadsDir = path.join(process.env.HOME || '', 'Downloads');
const fileName = 'ssl-certificate-thenetworkeruk.pdf';
const downloadName = 'Networker UK - SSL Certificate Details.pdf';

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

const outPath = path.join(exportsDir, fileName);
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();

fs.copyFileSync(outPath, path.join(assetsDir, fileName));
if (downloadsDir) {
  fs.copyFileSync(outPath, path.join(downloadsDir, downloadName));
}

console.log('Exported:', outPath);
console.log('Assets:', path.join(assetsDir, fileName));
console.log('Downloads:', path.join(downloadsDir, downloadName));
