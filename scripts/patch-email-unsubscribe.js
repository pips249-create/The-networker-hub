#!/usr/bin/env node
/**
 * Add Unsubscribe footer links to all email templates.
 * Run: node scripts/patch-email-unsubscribe.js
 */
const fs = require('fs');
const path = require('path');
const { ensureUnsubscribePlaceholder } = require('../api/_lib/email-footer-unsubscribe');

const dir = path.join(__dirname, '../email-templates');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));

let changed = 0;
for (const file of files) {
  const filePath = path.join(dir, file);
  const before = fs.readFileSync(filePath, 'utf8');
  let after = ensureUnsubscribePlaceholder(before);

  // Logo-only dark footers (no Privacy/Contact row yet)
  if (!/Unsubscribe/i.test(after)) {
    after = after.replace(
      /(<img[^>]*(?:logo_footer_url|logo-email-footer)[^>]*>\s*)(<\/td>\s*<\/tr>\s*<\/table>)/i,
      function (_m, img, close) {
        return (
          img +
          '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:12px 0 0;">' +
          '<a href="{{privacy_url}}" style="color:#ebe0f0;text-decoration:none;">Privacy</a>' +
          '&nbsp;&middot;&nbsp;' +
          '<a href="{{terms_url}}" style="color:#ebe0f0;text-decoration:none;">Terms</a>' +
          '&nbsp;&middot;&nbsp;' +
          '<a href="{{unsubscribe_url}}" style="color:#ebe0f0;text-decoration:none;">Unsubscribe</a>' +
          '</p>' +
          close
        );
      }
    );
  }

  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed += 1;
    console.log('patched', file);
  } else if (!/Unsubscribe/i.test(after)) {
    console.warn('needs manual unsubscribe:', file);
  }
}

console.log('Done —', changed, 'file(s) updated.');
