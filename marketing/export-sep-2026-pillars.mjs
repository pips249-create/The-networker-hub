/**
 * Export UK-branded pillar graphics for Sep 2026 social calendar.
 * Usage: node marketing/export-sep-2026-pillars.mjs
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'social', 'sep-2026-pillars.html');
const outDir = path.join(__dirname, 'social', 'sep-2026-posts');

const exports = [
  { v: 'breakfast', file: '03-thu-10-attendee-find-breakfast.png' },
  { v: 'networkers', file: '04-fri-11-for-networkers.png' },
  { v: 'pillars', file: '04b-fri-11-events-organisers-opportunities.png' },
  { v: 'organisers', file: '05-mon-14-organiser-why-switch.png' },
  { v: 'ticketing', file: '05b-mon-14-organiser-ticketing.png' },
  { v: 'networkers', file: '07-wed-16-for-networkers.png' },
  { v: 'guestVisits', file: '07b-wed-16-attendee-guest-visits.png' },
  { v: 'opportunities', file: '09-fri-18-business-opportunities.png' },
  { v: 'opportunities', file: '09b-fri-18-opportunity-listers.png' },
  { v: 'promote', file: '10b-mon-21-easy-linkedin-posts.png' },
  { v: 'exhibition', file: '10c-mon-21-exhibition-organisers.png' },
  { v: 'founding', file: '15-mon-28-founding-organisers.png' },
  { v: 'masterclass', file: '15b-mon-28-masterclass-hosts-october.png' },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 2,
});

for (const item of exports) {
  const url = pathToFileURL(htmlPath).href + '?v=' + encodeURIComponent(item.v);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#canvas img')];
    return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const outPath = path.join(outDir, item.file);
  await page.locator('#canvas').screenshot({ path: outPath, type: 'png' });
  console.log('Exported', item.file, '(' + item.v + ')');
}

await browser.close();
console.log('Done →', outDir);
