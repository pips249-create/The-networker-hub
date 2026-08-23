/**
 * Shared LinkedIn PDF square layout — include styles in each HTML file.
 * Export all LinkedIn one-pagers: node export-linkedin-pdfs.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportsDir = path.join(__dirname, 'exports');
const assetsDir = path.join(__dirname, '..', 'assets', 'guides');
const downloadsDir = path.join(process.env.HOME || '', 'Downloads');

fs.mkdirSync(exportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const LINKEDIN_PDFS = [
  {
    html: 'linkedin-pdf-business-opportunities-explainer.html',
    file: 'business-opportunities-explainer-linkedin.pdf',
    download: 'Networker UK - What is Business Opportunities (LinkedIn).pdf',
  },
  {
    html: 'linkedin-pdf-organiser-benefits.html',
    file: 'organiser-benefits-linkedin.pdf',
    download: 'Networker UK - Organiser Benefits (LinkedIn).pdf',
  },
  {
    html: 'linkedin-pdf-attendee-benefits.html',
    file: 'attendee-benefits-linkedin.pdf',
    download: 'Networker UK - Why Browse Here (LinkedIn).pdf',
  },
  {
    html: 'list-business-opportunity-linkedin.html',
    file: 'list-business-opportunity-linkedin.pdf',
    download: 'Networker UK - How to List Business Opportunities (LinkedIn).pdf',
  },
];

async function exportSquarePdf(browser, { html, file }) {
  const htmlPath = path.join(__dirname, html);
  const outPath = path.join(exportsDir, file);
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.pdf({
    path: outPath,
    printBackground: true,
    width: '1080px',
    height: '1080px',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await page.close();
  fs.copyFileSync(outPath, path.join(assetsDir, file));
  console.log('Exported:', file);
  return outPath;
}

const browser = await chromium.launch({ headless: true });
for (const item of LINKEDIN_PDFS) {
  await exportSquarePdf(browser, item);
}
await browser.close();

for (const item of LINKEDIN_PDFS) {
  fs.copyFileSync(
    path.join(exportsDir, item.file),
    path.join(downloadsDir, item.download)
  );
  console.log('Downloads:', item.download);
}
