/**
 * Export the London Business Show TINA A5 landscape leave-behind PDF (front + reverse)
 * at print resolution (~300 DPI raster pages) so logos/QR stay sharp when printed.
 *
 * Usage: node marketing/export-tina-lbs-leaflet.mjs
 *
 * Prefers Playwright when installed; falls back to system Chrome via puppeteer-core.
 * Assembles the PDF with Pillow from high-DPI page screenshots.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(__dirname, 'london-business-show-tina-leaflet.html');
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(root, 'assets', 'marketing');
const outName = 'london-business-show-tina-leaflet.pdf';

/** A5 landscape at 300 DPI */
const DPI = 300;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 148;
const PAGE_WIDTH_PX = Math.round((PAGE_WIDTH_MM / 25.4) * DPI); // ~2480
const PAGE_HEIGHT_PX = Math.round((PAGE_HEIGHT_MM / 25.4) * DPI); // ~1748
const CSS_PX_PER_MM = 96 / 25.4;
const DEVICE_SCALE = DPI / 96; // 3.125

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const outPath = path.join(exportsDir, outName);
const assetPath = path.join(assetsDir, outName);
const frontPngExport = path.join(exportsDir, 'london-business-show-tina-leaflet-front.png');
const backPngExport = path.join(exportsDir, 'london-business-show-tina-leaflet-back.png');
const frontPngAsset = path.join(assetsDir, 'london-business-show-tina-leaflet-front.png');
const backPngAsset = path.join(assetsDir, 'london-business-show-tina-leaflet-back.png');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tina-lbs-leaflet-'));
const frontTmp = path.join(tmpDir, 'front.png');
const backTmp = path.join(tmpDir, 'back.png');

const PRINT_CAPTURE_CSS = `
  .screen-bar { display: none !important; }
  body { background: #fff !important; }
  .wrap {
    padding: 0 !important;
    gap: 0 !important;
    align-items: flex-start !important;
  }
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
  await handle.scrollIntoViewIfNeeded?.();
  // Playwright / Puppeteer both support evaluate scroll
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({ block: 'start' });
  }, selector);
  await new Promise((r) => setTimeout(r, 120));
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  // Clip to the laid-out A5 box (avoids capturing overflow scroll height)
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

async function capturePages(page) {
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: PRINT_CAPTURE_CSS });
  await shotPage(page, '.page-front', frontTmp);
  await shotPage(page, '.page-back', backTmp);
}

async function withPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: Math.ceil(PAGE_WIDTH_MM * CSS_PX_PER_MM) + 40,
      height: Math.ceil(PAGE_HEIGHT_MM * CSS_PX_PER_MM) + 40,
    },
    deviceScaleFactor: DEVICE_SCALE,
  });
  await capturePages(page);
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
  await page.setViewport({
    width: Math.ceil(PAGE_WIDTH_MM * CSS_PX_PER_MM) + 40,
    height: Math.ceil(PAGE_HEIGHT_MM * CSS_PX_PER_MM) + 40,
    deviceScaleFactor: DEVICE_SCALE,
  });
  // puppeteer uses networkidle0
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 700));
  await page.addStyleTag({ content: PRINT_CAPTURE_CSS });
  await shotPage(page, '.page-front', frontTmp);
  await shotPage(page, '.page-back', backTmp);
  await browser.close();
}

function assemblePdf() {
  const script = `
from PIL import Image
import sys
front_path, back_path, out_path, dpi, w, h = sys.argv[1:7]
dpi = int(dpi); w = int(w); h = int(h)
front = Image.open(front_path).convert('RGB')
back = Image.open(back_path).convert('RGB')
# Exact A5 pixel canvas at target DPI (letterbox/crop-center if off by a few px)
def fit(img):
    if img.size == (w, h):
        return img
    # High-quality resample to exact A5 @ DPI (screenshots can be 1px off)
    resample = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS', Image.LANCZOS)
    return img.resize((w, h), resample)
front = fit(front)
back = fit(back)
front.save(
    out_path,
    'PDF',
    resolution=float(dpi),
    save_all=True,
    append_images=[back],
)
print(f'PDF {w}x{h}px @ {dpi}dpi, pages=2')
`;
  const result = spawnSync(
    'python3',
    ['-c', script, frontTmp, backTmp, outPath, String(DPI), String(PAGE_WIDTH_PX), String(PAGE_HEIGHT_PX)],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(`PDF assemble failed: ${result.stderr || result.stdout}`);
  }
  process.stdout.write(result.stdout || '');
}

try {
  await withPlaywright();
} catch {
  await withPuppeteerChrome();
}

assemblePdf();

fs.copyFileSync(frontTmp, frontPngExport);
fs.copyFileSync(backTmp, backPngExport);
fs.copyFileSync(frontTmp, frontPngAsset);
fs.copyFileSync(backTmp, backPngAsset);
fs.copyFileSync(outPath, assetPath);

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('Exported:', outPath);
console.log('Copied to assets:', assetPath);
console.log('Front PNG:', frontPngAsset);
console.log('Back PNG:', backPngAsset);
console.log(`Target: ${PAGE_WIDTH_PX}×${PAGE_HEIGHT_PX}px @ ${DPI} DPI (A5 landscape)`);
