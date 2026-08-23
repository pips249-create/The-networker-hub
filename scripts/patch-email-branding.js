#!/usr/bin/env node
/**
 * Enlarge header/footer logos and remove footer "The Networker UK" text line.
 * Run: node scripts/patch-email-branding.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../email-templates');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));

const FOOTER_TEXT_RE =
  /\s*<p style="font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:600;color:#ffffff;margin:0 0 8px;">The Networker UK<\/p>/g;

const FOOTER_TEXT_RE_PURPLE =
  /\s*<p style="font-family:'DM Sans',system-ui,sans-serif;font-size:12px;font-weight:600;color:#ffffff;margin:0 0 8px;">The Networker UK<\/p>/g;

function patchHtml(html) {
  let out = html;

  // Header logos (hub-email-layout-v2)
  out = out.replace(
    /width="180" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:180px;width:100%;"/g,
    'width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;width:100%;"'
  );
  out = out.replace(
    /width="180" style="height:auto;display:inline-block;margin:0 auto;border:0;"/g,
    'width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;"'
  );

  // Newsletter classic header (on dark bg)
  out = out.replace(
    /width="160" style="height:auto;display:inline-block;margin:0 auto 12px;border:0;max-width:160px;filter:brightness\(1\.05\);"/g,
    'width="220" style="height:auto;display:inline-block;margin:0 auto 12px;border:0;max-width:220px;filter:brightness(1.05);"'
  );

  // Footer logos
  out = out.replace(
    /width="140" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:140px;"/g,
    'width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;"'
  );
  out = out.replace(
    /width="140" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;"/g,
    'width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;"'
  );
  out = out.replace(
    /width="120" style="height:auto;display:inline-block;margin:0 auto 12px;border:0;max-width:120px;"/g,
    'width="180" style="height:auto;display:inline-block;margin:0 auto 12px;border:0;max-width:180px;"'
  );
  out = out.replace(
    /width="120" style="height:auto;display:block;margin:0 0 14px;border:0;max-width:120px;"/g,
    'width="180" style="height:auto;display:block;margin:0 0 14px;border:0;max-width:180px;"'
  );

  // Remove footer brand name line (keep logo only)
  out = out.replace(FOOTER_TEXT_RE, '');
  out = out.replace(FOOTER_TEXT_RE_PURPLE, '');

  return out;
}

let changed = 0;
for (const file of files) {
  const filePath = path.join(dir, file);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = patchHtml(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed += 1;
    console.log('patched', file);
  }
}

console.log('Done —', changed, 'file(s) updated.');
