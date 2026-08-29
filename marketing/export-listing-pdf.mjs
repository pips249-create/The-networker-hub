/**
 * Export listing guide PDFs (A4 + LinkedIn square).
 * Usage: node export-listing-pdf.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(__dirname, '..', 'assets', 'guides');

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

async function exportPdf(browser, htmlFile, outName, options) {
  const htmlPath = path.join(__dirname, htmlFile);
  const outPath = path.join(exportsDir, outName);
  const url = pathToFileURL(htmlPath).href;

  const page = await browser.newPage();
  if (options.viewport) {
    await page.setViewportSize(options.viewport);
  }
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  await page.pdf({
    path: outPath,
    printBackground: true,
    ...options.pdf,
  });
  await page.close();

  const assetPath = path.join(assetsDir, outName);
  fs.copyFileSync(outPath, assetPath);
  console.log('Exported:', outPath);
  console.log('Copied to assets:', assetPath);
  return outPath;
}

const browser = await chromium.launch({ headless: true });

await exportPdf(browser, 'list-business-opportunity-pdf.html', 'list-business-opportunity-guide.pdf', {
  pdf: {
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

await exportPdf(browser, 'list-affiliate-opportunity-pdf.html', 'list-affiliate-opportunity-guide.pdf', {
  pdf: {
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

await exportPdf(browser, 'list-business-opportunity-linkedin.html', 'list-business-opportunity-linkedin.pdf', {
  viewport: { width: 1080, height: 1080 },
  pdf: {
    width: '1080px',
    height: '1080px',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

await exportPdf(browser, 'list-affiliate-opportunity-linkedin.html', 'list-affiliate-opportunity-linkedin.pdf', {
  viewport: { width: 1080, height: 1080 },
  pdf: {
    width: '1080px',
    height: '1080px',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  },
});

await browser.close();

const downloads = [
  ['list-business-opportunity-guide.pdf', 'Networker UK - How to List Business Opportunities.pdf'],
  ['list-affiliate-opportunity-guide.pdf', 'Networker UK - List Affiliate Opportunity.pdf'],
  ['list-business-opportunity-linkedin.pdf', 'Networker UK - How to List Business Opportunities (LinkedIn).pdf'],
  ['list-affiliate-opportunity-linkedin.pdf', 'Networker UK - List Affiliate Opportunity (LinkedIn).pdf'],
];

const downloadsDir = path.join(process.env.HOME || '', 'Downloads');
if (fs.existsSync(downloadsDir)) {
  for (const [src, dest] of downloads) {
    fs.copyFileSync(path.join(exportsDir, src), path.join(downloadsDir, dest));
    console.log('Copied to Downloads:', dest);
  }
}
