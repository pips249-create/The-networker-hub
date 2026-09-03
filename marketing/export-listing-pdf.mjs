/**
 * Export listing guide PDFs (A4 + LinkedIn square).
 * Usage: node export-listing-pdf.mjs
 *
 * Prefers Google Chrome on macOS for reliable A4 print + link annotations.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(__dirname, '..', 'assets', 'guides');

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_PATH,
].filter(Boolean);

function exportWithChrome(htmlUrl, outPath) {
  for (const bin of chromeCandidates) {
    if (!fs.existsSync(bin)) continue;
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
    if (result.status === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      return bin;
    }
  }
  return null;
}

async function exportWithPlaywright(htmlUrl, outPath, options) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  if (options.viewport) await page.setViewportSize(options.viewport);
  await page.goto(htmlUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.pdf({
    path: outPath,
    printBackground: true,
    ...options.pdf,
  });
  await browser.close();
  return 'playwright';
}

async function exportPdf(htmlFile, outName, options) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outPath = path.join(exportsDir, outName);
  const htmlUrl = pathToFileURL(htmlPath).href;

  let used = null;
  if (!options.viewport) {
    used = exportWithChrome(htmlUrl, outPath);
  }
  if (!used) {
    used = await exportWithPlaywright(htmlUrl, outPath, options);
  }

  const assetPath = path.join(assetsDir, outName);
  fs.copyFileSync(outPath, assetPath);
  console.log('Exported with', used);
  console.log('Exported:', outPath);
  console.log('Copied to assets:', assetPath);
}

await exportPdf('list-business-opportunity-pdf.html', 'list-business-opportunity-guide.pdf', {
  pdf: {
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

await exportPdf('list-business-opportunity-linkedin.html', 'list-business-opportunity-linkedin.pdf', {
  viewport: { width: 1080, height: 1080 },
  pdf: {
    width: '1080px',
    height: '1080px',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

const downloads = [
  ['list-business-opportunity-guide.pdf', 'Networker UK - How to List Business Opportunities.pdf'],
  ['list-business-opportunity-linkedin.pdf', 'Networker UK - How to List Business Opportunities (LinkedIn).pdf'],
];

for (const [src, dest] of downloads) {
  try {
    fs.copyFileSync(
      path.join(exportsDir, src),
      path.join(process.env.HOME || '', 'Downloads', dest)
    );
    console.log('Copied to Downloads:', dest);
  } catch (err) {
    console.warn('Skip Downloads copy:', dest, String(err.message || err));
  }
}
