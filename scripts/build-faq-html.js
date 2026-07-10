#!/usr/bin/env node
/**
 * Sync faq.html list items from api/_lib/hubert-faq.js (single AEO source).
 */
const fs = require('fs');
const path = require('path');
const { FAQ_AEO_ENTRIES } = require('../api/_lib/hubert-faq');

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
  html = html.replace(
    /(\/[a-z0-9][a-z0-9/_-]*)/gi,
    '<a href="$1">$1</a>'
  );
  html = html.replace(/hello@the-networker\.co\.uk/g, '<a href="mailto:hello@the-networker.co.uk">hello@the-networker.co.uk</a>');
  html = html.replace(/rosie@thenetworkerhub\.com/g, '<a href="mailto:rosie@thenetworkerhub.com">rosie@thenetworkerhub.com</a>');
  return '<p>' + html + '</p>';
}

function buildFaqListHtml() {
  return FAQ_AEO_ENTRIES.map(function (item) {
    return (
      '      <li>\n' +
      '        <details class="faq-item">\n' +
      '          <summary>' +
      escapeHtml(item.question) +
      '</summary>\n' +
      '          <div class="faq-answer">\n' +
      '            ' +
      linkifyAnswer(item.answer) +
      '\n' +
      '          </div>\n' +
      '        </details>\n' +
      '      </li>'
    );
  }).join('\n');
}

const faqPath = path.join(__dirname, '..', 'faq.html');
let html = fs.readFileSync(faqPath, 'utf8');
const listHtml = buildFaqListHtml();
const blockRe = /<ul class="faq-list" role="list">[\s\S]*?<\/ul>/;
const match = html.match(blockRe);

if (!match) {
  console.error('Could not find faq-list block in faq.html');
  process.exit(1);
}

const nextBlock = '<ul class="faq-list" role="list">\n' + listHtml + '\n    </ul>';
if (match[0] === nextBlock) {
  console.log('faq.html already up to date (' + FAQ_AEO_ENTRIES.length + ' entries)');
  process.exit(0);
}

const replaced = html.replace(blockRe, nextBlock);
fs.writeFileSync(faqPath, replaced, 'utf8');
console.log('Updated faq.html with', FAQ_AEO_ENTRIES.length, 'FAQ entries');
