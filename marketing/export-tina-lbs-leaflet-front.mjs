/**
 * Export VistaPrint-ready FRONT ONLY (TINA page) PDF with embedded static TTFs.
 * Usage: node marketing/export-tina-lbs-leaflet-front.mjs
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
const outName = 'london-business-show-tina-leaflet-front.pdf';

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

const FRONT_ONLY_CSS = `
  .screen-bar { display: none !important; }
  .wrap { padding: 0 !important; gap: 0 !important; }
  .page-back { display: none !important; }
  .page-front {
    page-break-after: auto !important;
    break-after: auto !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
`;

async function waitForFonts(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Force-load weights used on the front
    await Promise.all([
      document.fonts.load("400 16px 'DM Sans'"),
      document.fonts.load("500 16px 'DM Sans'"),
      document.fonts.load("600 16px 'DM Sans'"),
      document.fonts.load("700 16px 'DM Sans'"),
      document.fonts.load("800 16px 'DM Sans'"),
      document.fonts.load("400 32px 'DM Serif Display'"),
    ]);
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function withPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await waitForFonts(page);
  await page.addStyleTag({ content: FRONT_ONLY_CSS });
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
  await waitForFonts(page);
  await page.addStyleTag({ content: FRONT_ONLY_CSS });
  await page.pdf(pdfOpts);
  await browser.close();
}

try {
  await withPlaywright();
} catch {
  await withPuppeteerChrome();
}

fs.copyFileSync(outPath, assetPath);
console.log('Exported front PDF:', outPath);
console.log('Copied to assets:', assetPath);
