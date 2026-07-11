#!/usr/bin/env node
/**
 * Sync faq.html FAQ blocks from api/_lib/hubert-faq.js (single AEO source).
 */
const fs = require('fs');
const path = require('path');
const { FAQ_AEO_ENTRIES, FAQ_CATEGORIES } = require('../api/_lib/hubert-faq');

const CATEGORY_ORDER = ['general', 'buyers', 'organisers'];

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifyAnswer(text) {
  let html = escapeHtml(text);
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  html = html.replace(/(\/[a-z0-9][a-z0-9/_.-]*)/gi, '<a href="$1">$1</a>');
  html = html.replace(/hello@thenetworkerhub\.com/g, '<a href="mailto:hello@thenetworkerhub.com">hello@thenetworkerhub.com</a>');
  html = html.replace(/rosie@thenetworkerhub\.com/g, '<a href="mailto:rosie@thenetworkerhub.com">rosie@thenetworkerhub.com</a>');
  return '<p>' + html + '</p>';
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
    linkifyAnswer(item.answer) +
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

const faqPath = path.join(__dirname, '..', 'faq.html');
let html = fs.readFileSync(faqPath, 'utf8');
const panelsHtml = buildFaqPanelsHtml();
const blockRe = /<div class="faq-panels" id="faq-panels">[\s\S]*?<\/div>\s*\n\s*<p class="faq-empty"/;

if (!blockRe.test(html)) {
  console.error('Could not find faq-panels block in faq.html');
  process.exit(1);
}

const nextBlock =
  '<div class="faq-panels" id="faq-panels">\n' +
  panelsHtml +
  '\n      </div>\n\n      <p class="faq-empty"';

const match = html.match(blockRe);
if (match[0] === nextBlock) {
  console.log('faq.html already up to date (' + FAQ_AEO_ENTRIES.length + ' entries)');
  process.exit(0);
}

html = html.replace(blockRe, nextBlock);
fs.writeFileSync(faqPath, html, 'utf8');
console.log('Updated faq.html with', FAQ_AEO_ENTRIES.length, 'FAQ entries in', CATEGORY_ORDER.length, 'categories');
