/**
 * Export the International overview one-pager PDF.
 * Usage: node marketing/export-international-overview.mjs
 *
 * Prefers Google Chrome on macOS (Playwright Chromium is unavailable on some macOS versions).
 */
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'guides', 'international-overview.html');
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(root, 'assets', 'guides');
const outName = 'international-overview.pdf';

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const outPath = path.join(exportsDir, outName);
const assetPath = path.join(assetsDir, outName);
const htmlUrl = pathToFileURL(htmlPath).href;

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].filter(Boolean);

function exportWithChrome(bin) {
  const result = spawnSync(
    bin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outPath}`,
      htmlUrl,
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || 'Chrome print failed').slice(0, 400)
    );
  }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1000) {
    throw new Error('Chrome did not write a usable PDF');
  }
}

async function exportWithPlaywright() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(htmlUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.pdf({
    path: outPath,
    printBackground: true,
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
}

let used = '';
for (const bin of chromeCandidates) {
  if (!fs.existsSync(bin)) continue;
  try {
    exportWithChrome(bin);
    used = bin;
    break;
  } catch (err) {
    console.warn('Chrome export failed via', bin, String(err.message || err));
  }
}

if (!used) {
  await exportWithPlaywright();
  used = 'playwright';
}

fs.copyFileSync(outPath, assetPath);
console.log('Exported with', used);
console.log('Exported:', outPath);
console.log('Copied to assets:', assetPath);
