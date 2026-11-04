/**
 * Export the London Business Show TINA A5 landscape leave-behind PDF (front + reverse).
 * Usage: node marketing/export-tina-lbs-leaflet.mjs
 *
 * Prefers Playwright when installed (same as organiser leave-behind);
 * falls back to system Chrome via puppeteer-core.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(__dirname, 'london-business-show-tina-leaflet.html');
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(root, 'assets', 'marketing');
const outName = 'london-business-show-tina-leaflet.pdf';

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const outPath = path.join(exportsDir, outName);
const assetPath = path.join(assetsDir, outName);

const pdfOpts = {
  path: outPath,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
};

async function withPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.pdf(pdfOpts);
  await browser.close();
}

async function withPuppeteerChrome() {
  const puppeteer = await import('puppeteer-core');
  const executablePath =
    process.env.CHROME_PATH ||
    (fs.existsSync('/usr/bin/google-chrome-stable')
      ? '/usr/bin/google-chrome-stable'
      : '/usr/bin/google-chrome');
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  await page.pdf(pdfOpts);
  await browser.close();
}

try {
  await withPlaywright();
} catch {
  await withPuppeteerChrome();
}

fs.copyFileSync(outPath, assetPath);
console.log('Exported:', outPath);
console.log('Copied to assets:', assetPath);
