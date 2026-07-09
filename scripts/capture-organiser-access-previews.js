#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });

const { chromium } = require('playwright');
const { buildEmailFromTemplate } = require('../api/_lib/send-template-email');
const { mergeEmailPreviewVariables } = require('../api/_lib/email-preview-variables');
const { publicSiteBase } = require('../api/_lib/hub-email-urls');

const outDir = path.join(root, '.cursor', 'projects', 'Users-catherinehancher-Desktop-The-networker-hub', 'assets');
const baseUrl = process.argv[2] || 'http://127.0.0.1:8765';

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.includes('organiser-enable.js') || u.includes('organiser-verify-email.js')) {
      return route.abort();
    }
    return route.continue();
  });

  for (const [slug, file] of [
    ['organiser/enable.html', 'preview-enable-page.png'],
    ['organiser/verify-email.html', 'preview-verify-email-page.png'],
  ]) {
    await page.goto(baseUrl + '/' + slug, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const out = path.join(outDir, file);
    await page.screenshot({ path: out, fullPage: true });
    console.log('saved', out);
  }

  const site = publicSiteBase(process.env.SITE_URL);
  const vars = mergeEmailPreviewVariables(
    'organiser_email_verify',
    { user_name: 'Catherine', user_email: 'hancher249@gmail.com' },
    site
  );
  const built = await buildEmailFromTemplate('organiser_email_verify', vars);
  const emailPath = path.join(outDir, 'preview-organiser-email-verify.html');
  fs.writeFileSync(emailPath, built.html);

  await page.unroute('**/*');
  await page.setViewportSize({ width: 680, height: 1200 });
  await page.goto('file://' + emailPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const emailShot = path.join(outDir, 'preview-organiser-email-verify.png');
  await page.screenshot({ path: emailShot, fullPage: true });
  console.log('saved', emailShot);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
