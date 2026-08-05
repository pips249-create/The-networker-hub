#!/usr/bin/env node
/**
 * Build Email 1 HTML for Brevo (variables filled) + browser preview.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const SITE = 'https://www.thenetworkerhub.com';
const LEGACY = 'https://the-networker.co.uk';

const vars = {
  organiser_name: 'Pip (test)',
  site_url: SITE,
  legacy_site_url: LEGACY,
  legacy_logo_url: SITE + '/assets/logo-networker-legacy.png',
  logo_footer_url: SITE + '/assets/logo-email-footer.png',
  for_organisers_url: SITE + '/for-organisers',
  company_name: 'The Networker Group Ltd',
  company_number: '15252227',
  privacy_url: SITE + '/legal-policies#privacy',
  terms_url: SITE + '/legal-policies#terms',
  contact_url: SITE + '/contact',
  // Brevo's built-in unsubscribe placeholder
  unsubscribe_url: '{{ unsubscribe }}',
};

let html = fs.readFileSync(
  path.join(root, 'email-templates/organiser-rebrand-announcement.html'),
  'utf8'
);
for (const [k, v] of Object.entries(vars)) {
  html = html.split('{{' + k + '}}').join(v);
}

const ready = html.replace(
  'Pip (test)',
  '{{ contact.ORGANISER_NAME | default: "there" }}'
);
fs.writeFileSync(path.join(root, 'data/email1-brevo-ready.html'), ready);
fs.writeFileSync(path.join(root, 'data/email1-brevo-preview.html'), html);
console.log('Wrote data/email1-brevo-ready.html');
console.log('Wrote data/email1-brevo-preview.html');

const leftover = ready.match(/\{\{[a-z_]+\}\}/g);
console.log('Leftover {{token}} (should be none):', leftover || 'none');

const hrefs = [
  ...new Set([...html.matchAll(/href="(https:[^"]+)"/g)].map((m) => m[1])),
];
const imgs = [
  ...new Set([...html.matchAll(/src="(https:[^"]+)"/g)].map((m) => m[1])),
];

function check(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'TNH-email-link-check' } }, (res) => {
        resolve({ status: res.statusCode, loc: res.headers.location || '' });
        res.resume();
      })
      .on('error', (e) => resolve({ status: 'ERR', error: e.message }));
  });
}

(async () => {
  console.log('\nLink check:');
  for (const u of hrefs) {
    const r = await check(u);
    const gated = r.status === 302 && String(r.loc).includes('site-access');
    const ok = r.status === 200 && !gated;
    console.log(
      (ok ? 'OK' : '!!'),
      String(r.status).padEnd(4),
      u,
      gated ? '(GATED — do not use)' : ''
    );
  }
  console.log('\nImage check:');
  for (const u of imgs) {
    const r = await check(u);
    console.log((r.status === 200 ? 'OK' : '!!'), String(r.status).padEnd(4), u);
  }
})();
