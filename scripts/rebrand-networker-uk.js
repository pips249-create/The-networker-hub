#!/usr/bin/env node
/**
 * Bulk rebrand: The Networker Hub → The Networker UK
 * Run: node scripts/rebrand-networker-uk.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.cursor',
  'agent-transcripts',
]);

const SKIP_PATH_PARTS = [
  `${path.sep}supabase${path.sep}migrations${path.sep}`,
];

const SKIP_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip']);

/** Longest matches first. */
const REPLACEMENTS = [
  ['www.thenetworkerhub.com', 'www.thenetworkeruk.com'],
  ['thenetworkerhub.com', 'thenetworkeruk.com'],
  ['The Networker Hub', 'The Networker UK'],
  ['Networker Hub', 'Networker UK'],
  ['TheNetworkerHub', 'TheNetworkerUK'],
  ['My Hub', 'My account'],
  ['logo-nav-transparent.png?v=20260729a', 'logo.svg?v=20260823uk'],
  ['logo-email-footer.png?v=20260805footer', 'logo.svg?v=20260823uk'],
  ['LOGO_ASSET_VERSION = \'20260805footer\'', 'LOGO_ASSET_VERSION = \'20260823uk\''],
];

function shouldProcess(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (!rel || rel.startsWith('..')) return false;
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIR_NAMES.has(p))) return false;
  if (SKIP_PATH_PARTS.some((part) => rel.includes(part.replace(/\\/g, '/'))) || SKIP_PATH_PARTS.some((part) => filePath.includes(part))) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return false;
  if (rel.endsWith('scripts/rebrand-networker-uk.js')) return false;
  return true;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(full, files);
    } else if (shouldProcess(full)) {
      files.push(full);
    }
  }
  return files;
}

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

let changed = 0;
for (const filePath of walk(ROOT)) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = applyReplacements(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed += 1;
    console.log('updated', path.relative(ROOT, filePath));
  }
}

console.log('Done —', changed, 'file(s) updated.');
