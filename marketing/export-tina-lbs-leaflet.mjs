/**
 * Export the London Business Show TINA A5 landscape leave-behind PDF (front + reverse).
 * Usage: node marketing/export-tina-lbs-leaflet.mjs
 *
 * Prefers Playwright when installed (same as organiser leave-behind);
 * falls back to system Chrome via puppeteer-core.
 *
 * Primary output is Chromium's vector print PDF (matches the HTML design).
 * Also writes optional 300 DPI page PNGs for print proofs — these do not replace the PDF.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

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
const frontPngExport = path.join(exportsDir, 'london-business-show-tina-leaflet-front.png');
const backPngExport = path.join(exportsDir, 'london-business-show-tina-leaflet-back.png');
const frontPngAsset = path.join(assetsDir, 'london-business-show-tina-leaflet-front.png');
const backPngAsset = path.join(assetsDir, 'london-business-show-tina-leaflet-back.png');

/** VistaPrint A5 landscape full-bleed upload size; ~300 DPI proof PNGs (optional; PDF stays vector) */
const DPI = 300;
const PAGE_WIDTH_MM = 213;
const PAGE_HEIGHT_MM = 151;
const DEVICE_SCALE = DPI / 96;
const CSS_PX_PER_MM = 96 / 25.4;

const pdfOpts = {
  path: outPath,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
};

const PRINT_CAPTURE_CSS = `
  .screen-bar { display: none !important; }
  body { background: #fff !important; }
  .wrap { padding: 0 !important; gap: 0 !important; align-items: flex-start !important; }
  .page {
    width: ${PAGE_WIDTH_MM}mm !important;
    height: ${PAGE_HEIGHT_MM}mm !important;
    max-height: ${PAGE_HEIGHT_MM}mm !important;
    min-height: ${PAGE_HEIGHT_MM}mm !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    overflow: hidden !important;
  }
`;

async function shotPage(page, selector, outFile) {
  const handle = await page.$(selector);
  if (!handle) throw new Error(`Missing ${selector}`);
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'start' });
  }, selector);
  await new Promise((r) => setTimeout(r, 120));
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  await page.screenshot({
    path: outFile,
    type: 'png',
    omitBackground: false,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: box.height,
    },
  });
}

async function withPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  // Vector PDF — matches on-screen / print HTML design
  const pdfPage = await browser.newPage();
  await pdfPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await pdfPage.evaluate(() => document.fonts.ready);
  await pdfPage.waitForTimeout(600);
  await pdfPage.pdf(pdfOpts);
  await pdfPage.close();

  // Optional 300 DPI PNG proofs
  const proofPage = await browser.newPage({
    viewport: {
      width: Math.ceil(PAGE_WIDTH_MM * CSS_PX_PER_MM) + 40,
      height: Math.ceil(PAGE_HEIGHT_MM * CSS_PX_PER_MM) + 40,
    },
    deviceScaleFactor: DEVICE_SCALE,
  });
  await proofPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await proofPage.evaluate(() => document.fonts.ready);
  await proofPage.waitForTimeout(600);
  await proofPage.addStyleTag({ content: PRINT_CAPTURE_CSS });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tina-lbs-proof-'));
  const frontTmp = path.join(tmpDir, 'front.png');
  const backTmp = path.join(tmpDir, 'back.png');
  try {
    await shotPage(proofPage, '.page-front', frontTmp);
    await shotPage(proofPage, '.page-back', backTmp);
    fs.copyFileSync(frontTmp, frontPngExport);
    fs.copyFileSync(backTmp, backPngExport);
    fs.copyFileSync(frontTmp, frontPngAsset);
    fs.copyFileSync(backTmp, backPngAsset);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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

  const pdfPage = await browser.newPage();
  await pdfPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
  await pdfPage.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  await pdfPage.pdf(pdfOpts);
  await pdfPage.close();

  const proofPage = await browser.newPage();
  await proofPage.setViewport({
    width: Math.ceil(PAGE_WIDTH_MM * CSS_PX_PER_MM) + 40,
    height: Math.ceil(PAGE_HEIGHT_MM * CSS_PX_PER_MM) + 40,
    deviceScaleFactor: DEVICE_SCALE,
  });
  await proofPage.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
  await proofPage.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 600));
  await proofPage.addStyleTag({ content: PRINT_CAPTURE_CSS });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tina-lbs-proof-'));
  const frontTmp = path.join(tmpDir, 'front.png');
  const backTmp = path.join(tmpDir, 'back.png');
  try {
    await shotPage(proofPage, '.page-front', frontTmp);
    await shotPage(proofPage, '.page-back', backTmp);
    fs.copyFileSync(frontTmp, frontPngExport);
    fs.copyFileSync(backTmp, backPngExport);
    fs.copyFileSync(frontTmp, frontPngAsset);
    fs.copyFileSync(backTmp, backPngAsset);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  await browser.close();
}

try {
  await withPlaywright();
} catch {
  await withPuppeteerChrome();
}

fs.copyFileSync(outPath, assetPath);
console.log('Exported vector PDF:', outPath);
console.log('Copied to assets:', assetPath);
console.log('Also wrote 300 DPI PNG proofs:', frontPngAsset, backPngAsset);
