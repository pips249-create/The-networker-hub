#!/usr/bin/env node
/**
 * Opportunity save must not send logo + cover base64 in one JSON body
 * (Vercel ~4.5MB limit → blank "Could not save opportunity" on mobile).
 *
 * Run: node scripts/test-opportunity-save-media-split.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const edit = fs.readFileSync(path.join(root, 'js/organiser-opportunity-edit.js'), 'utf8');
const editHtml = fs.readFileSync(path.join(root, 'organiser/opportunity-edit.html'), 'utf8');
const route = fs.readFileSync(path.join(root, 'api/_lib/routes/organiser-opportunities.js'), 'utf8');

function ok(name, condition) {
  assert.ok(condition, name);
  console.log('ok -', name);
}

ok(
  'client stages dual image uploads',
  /async function saveOpportunityWithMedia\(/.test(edit) &&
    /hasPhotoUpload && hasLogoUpload/.test(edit) &&
    /stripOpportunityMediaBase64/.test(edit) &&
    /adoptOpportunityEditId/.test(edit)
);

ok(
  'client maps payload_too_large and exclusive_brand_conflict',
  /payload_too_large/.test(edit) && /exclusive_brand_conflict/.test(edit)
);

ok(
  'client treats non-JSON 413 as payload_too_large',
  /res\.status === 413/.test(edit) && /payload_too_large/.test(edit)
);

ok(
  'cache-busted opportunity edit script',
  /organiser-opportunity-edit\.js\?v=20261109saveimg1/.test(editHtml)
);

ok(
  'API maps oversized image errors to cover_upload_failed',
  /sendOpportunityImageUploadError/.test(route) && /under 2MB/i.test(route)
);

console.log('\nAll opportunity save media-split checks passed.');
