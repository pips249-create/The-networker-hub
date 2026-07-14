#!/usr/bin/env node
/**
 * Rewrite .html hrefs / location paths to pretty URLs (Vercel cleanUrls).
 * Directory indexes become trailing-slash paths (/account/, /organiser/, …).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '.cursor',
  'email-templates',
  'supabase',
]);

function fileToPretty(relPosix) {
  const rel = String(relPosix || '').replace(/^\/+/, '');
  if (!rel || rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) {
    return '/' + rel.slice(0, -'index.html'.length);
  }
  if (rel.endsWith('.html')) {
    return '/' + rel.slice(0, -'.html'.length);
  }
  return '/' + rel;
}

function prettyFromHref(href, fromFile) {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
    return null;
  }
  if (/^(https?:|\/\/)/i.test(raw)) return null;
  if (raw.startsWith('/api/') || raw.startsWith('/assets/') || raw.startsWith('/css/') || raw.startsWith('/js/')) {
    return null;
  }

  const hashIdx = raw.indexOf('#');
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : '';
  const beforeHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const qIdx = beforeHash.indexOf('?');
  const query = qIdx >= 0 ? beforeHash.slice(qIdx) : '';
  let pathname = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  if (!pathname || pathname === '.') return null;

  let resolved;
  if (pathname.startsWith('/')) {
    resolved = pathname.replace(/^\/+/, '');
  } else {
    const fromDir = path.posix.dirname(fromFile.replace(/\\/g, '/'));
    resolved = path.posix.normalize(fromDir === '.' ? pathname : fromDir + '/' + pathname);
    if (resolved.startsWith('../')) return null;
  }

  if (!resolved.endsWith('.html') && !resolved.endsWith('/index.html')) {
    // Already pretty or non-html — still normalize known /foo/index.html style
    if (!/\.html$/i.test(resolved)) return null;
  }

  let pretty = fileToPretty(resolved);
  // Preserve intentional trailing slash for directory indexes only (already in fileToPretty)
  if (pretty === '/index') pretty = '/';
  return pretty + query + hash;
}

function rewriteHtml(relFile, html) {
  let changed = false;
  const out = html.replace(/\b(href|action)=(["'])([^"']+)\2/gi, function (full, attr, quote, value) {
    const pretty = prettyFromHref(value, relFile);
    if (!pretty || pretty === value) return full;
    changed = true;
    return attr + '=' + quote + pretty + quote;
  });
  return { html: out, changed: changed };
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (name.endsWith('.html')) out.push(abs);
  }
  return out;
}

const files = walk(ROOT, []);
let updated = 0;
for (const abs of files) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  const result = rewriteHtml(rel, src);
  if (result.changed) {
    fs.writeFileSync(abs, result.html, 'utf8');
    updated += 1;
    console.log('updated', rel);
  }
}
console.log('Pretty-url href rewrite: %d HTML files updated', updated);
