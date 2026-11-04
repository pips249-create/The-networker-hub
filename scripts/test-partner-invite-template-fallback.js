/**
 * Ensures partner_programme_invite builds from the branded HTML file
 * even when the email_templates DB row is missing.
 */
const assert = require('assert');
const path = require('path');

// Avoid requiring full send-template-email (pulls Supabase). Test branded resolve + subject only.
const {
  isBrandedEmailSlug,
  resolveBrandedEmailBody,
  getBrandedEmailSubject,
} = require('../api/_lib/branded-email-templates');

assert.strictEqual(isBrandedEmailSlug('partner_programme_invite'), true, 'slug is branded');

const resolved = resolveBrandedEmailBody('partner_programme_invite', '');
assert.strictEqual(resolved.source, 'file', 'empty DB body falls back to file');
assert.ok(
  String(resolved.bodyHtml || '').includes('Accept terms'),
  'file body includes Accept terms CTA'
);
assert.ok(
  String(resolved.bodyHtml || '').includes('{{partner_code}}'),
  'file body includes partner_code placeholder'
);

const subject = getBrandedEmailSubject('partner_programme_invite');
assert.ok(String(subject || '').includes('{{partner_code}}'), 'branded subject includes code');

// Mirror the buildEmailFromTemplate missing-DB branch (without live DB).
const template = {
  slug: 'partner_programme_invite',
  subject: subject || 'partner_programme_invite',
  body_html: resolved.bodyHtml,
};
assert.ok(template.body_html.length > 500, 'template body loaded from disk');
assert.ok(
  path.basename(require.resolve('../email-templates/partner-programme-invite.html')) ===
    'partner-programme-invite.html',
  'html file is resolvable'
);

console.log('ok — partner_programme_invite file fallback ready');
