#!/usr/bin/env node
/**
 * Sync faq.html from api/_lib/hubert-faq.js (single AEO source):
 * - FAQ panels + deep links
 * - Static FAQPage JSON-LD in <head>
 * - Canonical URL aligned to SITE_URL
 */
const fs = require('fs');
const path = require('path');
const { FAQ_AEO_ENTRIES, FAQ_CATEGORIES } = require('../api/_lib/hubert-faq');
const { buildFaqPageSchema, siteOrigin, DEFAULT_ORIGIN } = require('../api/_lib/hubert-seo');

const CATEGORY_ORDER = ['general', 'buyers', 'organisers'];
const CANONICAL_ORIGIN = siteOrigin(process.env.SITE_URL || DEFAULT_ORIGIN);

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifyAnswer(text) {
  let html = escapeHtml(text);
  const absUrls = [];
  html = html.replace(/(https?:\/\/[^\s<]+)/g, function (match) {
    // Keep trailing sentence punctuation out of the URL.
    const trimmed = match.replace(/[.,;:!?)]+$/g, '');
    const trail = match.slice(trimmed.length);
    absUrls.push(trimmed);
    return '\u0000ABS' + (absUrls.length - 1) + '\u0000' + trail;
  });
  // Relative Hub paths only (not fragments of already-captured absolute URLs).
  html = html.replace(/(^|[^"'>/\w])(\/[a-z0-9][a-z0-9/_.#-]*)/gi, function (_m, lead, path) {
    return lead + '<a href="' + path + '">' + path + '</a>';
  });
  html = html.replace(/hello@thenetworker(?:uk|hub)\.com/g, '<a href="mailto:hello@thenetworkeruk.com">hello@thenetworkeruk.com</a>');
  html = html.replace(/rosie@thenetworker(?:uk|hub)\.com/g, '<a href="mailto:rosie@thenetworkeruk.com">rosie@thenetworkeruk.com</a>');
  html = html.replace(/\u0000ABS(\d+)\u0000/g, function (_m, idx) {
    const url = absUrls[Number(idx)];
    return '<a href="' + url + '">' + url + '</a>';
  });
  return html;
}

function buildAnswerHtml(item) {
  let html = linkifyAnswer(item.answer);
  if (item.helpLink) {
    html +=
      '\n                    <p class="faq-help-link"><a href="' +
      escapeHtml(item.helpLink) +
      '">View full detailed terms page →</a></p>';
  }
  return html;
}

function buildFaqItemHtml(item) {
  const searchText = [item.question, item.answer, item.category, FAQ_CATEGORIES[item.category]?.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    '              <li class="faq-list-item" data-category="' +
    escapeHtml(item.category) +
    '" data-search="' +
    escapeHtml(searchText) +
    '">\n' +
    '                <details class="faq-item">\n' +
    '                  <summary><span class="faq-item-icon" aria-hidden="true">' +
    escapeHtml(item.icon || '') +
    '</span><span class="faq-item-text">' +
    escapeHtml(item.question) +
    '</span></summary>\n' +
    '                  <div class="faq-answer">\n' +
    '                    ' +
    buildAnswerHtml(item) +
    '\n' +
    '                  </div>\n' +
    '                </details>\n' +
    '              </li>'
  );
}

function buildCategoryBlockHtml(categoryId) {
  const meta = FAQ_CATEGORIES[categoryId];
  const items = FAQ_AEO_ENTRIES.filter(function (item) {
    return item.category === categoryId;
  });

  const listHtml = items.map(buildFaqItemHtml).join('\n');

  return (
    '        <section class="faq-category-block" data-category-block="' +
    categoryId +
    '" aria-labelledby="faq-cat-' +
    categoryId +
    '">\n' +
    '          <header class="faq-category-head">\n' +
    '            <h2 class="faq-category-title" id="faq-cat-' +
    categoryId +
    '">' +
    escapeHtml(meta.label) +
    '</h2>\n' +
    '            <p class="faq-category-lede">' +
    escapeHtml(meta.lede) +
    '</p>\n' +
    '          </header>\n' +
    '          <ul class="faq-list" role="list">\n' +
    listHtml +
    '\n' +
    '          </ul>\n' +
    '        </section>'
  );
}

function buildFaqPanelsHtml() {
  return CATEGORY_ORDER.map(buildCategoryBlockHtml).join('\n');
}

function buildFaqJsonLdTag() {
  const schema = buildFaqPageSchema(FAQ_AEO_ENTRIES, CANONICAL_ORIGIN);
  return (
    '<script type="application/ld+json" data-hubert-seo="static">' +
    JSON.stringify(schema) +
    '</script>'
  );
}

function syncFaqHtml(html) {
  let changed = false;
  const panelsHtml = buildFaqPanelsHtml();
  const panelsBlock =
    '<div class="faq-panels" id="faq-panels">\n' + panelsHtml + '\n      </div>\n\n      <p class="faq-empty"';
  const panelsRe = /<div class="faq-panels" id="faq-panels">[\s\S]*?<\/div>\s*\n\s*<p class="faq-empty"/;

  if (!panelsRe.test(html)) {
    console.error('Could not find faq-panels block in faq.html');
    process.exit(1);
  }

  if (html.match(panelsRe)[0] !== panelsBlock) {
    html = html.replace(panelsRe, panelsBlock);
    changed = true;
  }

  const jsonLdTag = buildFaqJsonLdTag();
  const jsonLdRe = /<script type="application\/ld\+json" data-hubert-seo="static">[\s\S]*?<\/script>/;
  if (jsonLdRe.test(html)) {
    if (html.match(jsonLdRe)[0] !== jsonLdTag) {
      html = html.replace(jsonLdRe, jsonLdTag);
      changed = true;
    }
  } else {
    html = html.replace('</head>', '  ' + jsonLdTag + '\n</head>');
    changed = true;
  }

  const canonical = CANONICAL_ORIGIN + '/faq';
  const canonicalTag = '<link rel="canonical" href="' + canonical + '">';
  const canonicalRe = /<link rel="canonical" href="[^"]*">/;
  if (canonicalRe.test(html)) {
    if (html.match(canonicalRe)[0] !== canonicalTag) {
      html = html.replace(canonicalRe, canonicalTag);
      changed = true;
    }
  } else {
    html = html.replace('</head>', '  ' + canonicalTag + '\n</head>');
    changed = true;
  }

  return { html: html, changed: changed };
}

const faqPath = path.join(__dirname, '..', 'faq.html');
const result = syncFaqHtml(fs.readFileSync(faqPath, 'utf8'));

if (!result.changed) {
  console.log('faq.html already up to date (' + FAQ_AEO_ENTRIES.length + ' entries)');
  process.exit(0);
}

fs.writeFileSync(faqPath, result.html, 'utf8');
console.log('Updated faq.html with', FAQ_AEO_ENTRIES.length, 'FAQ entries, static JSON-LD, and canonical');
