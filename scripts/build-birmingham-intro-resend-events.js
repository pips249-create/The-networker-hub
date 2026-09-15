#!/usr/bin/env node
/**
 * Refresh the four Birmingham event cards in data/birmingham-intro-resend-broadcast.html
 * from the live public browse API.
 *
 * Usage:
 *   node scripts/build-birmingham-intro-resend-events.js
 *   node scripts/build-birmingham-intro-resend-events.js --dry-run
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.thenetworkeruk.com';
const HTML = path.join(__dirname, '../data/birmingham-intro-resend-broadcast.html');
const MARK_START = '<!-- Birmingham event cards';
const MARK_END = '<!-- Feature stack -->';

function isBirmingham(ev) {
  const blob = [ev.city, ev.location, ev.locationSlug, ev.venueName]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return blob.includes('birmingham') || ev.locationSlug === 'birmingham';
}

function shortDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr || '').slice(0, 12);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function cardHtml(ev) {
  const slug = ev.slug;
  const title = escHtml(ev.title);
  const price = escHtml(ev.price || 'See site');
  const time = escHtml(ev.time || '');
  const venue = escHtml(ev.venueName || ev.venue || 'Birmingham');
  const when = escHtml(shortDate(ev.dateRaw || ev.nextDate || ev.date));
  const href =
    SITE +
    '/events/' +
    encodeURIComponent(slug) +
    '?utm_source=resend&utm_medium=email&utm_campaign=birmingham-intro&utm_content=event-' +
    encodeURIComponent(slug.slice(0, 24));
  return (
    '        <tr>\n' +
    '          <td class="mobile-pad" style="padding:0 32px 10px;">\n' +
    '            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #d9c4e0;border-radius:12px;border-left:4px solid #9a7aa8;">\n' +
    '              <tr>\n' +
    '                <td style="padding:16px 18px;">\n' +
    '                  <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;color:#9a7aa8;margin:0 0 6px;">' +
    when +
    ' &middot; ' +
    time +
    ' &middot; ' +
    price +
    '</p>\n' +
    '                  <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#1c2040;margin:0 0 4px;line-height:1.35;"><a href="' +
    href +
    '" style="color:#1c2040;text-decoration:none;">' +
    title +
    '</a></p>\n' +
    '                  <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0;">' +
    venue +
    '</p>\n' +
    '                </td>\n' +
    '              </tr>\n' +
    '            </table>\n' +
    '          </td>\n' +
    '        </tr>\n'
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = SITE + '/api/events?browse=1&location=birmingham&limit=40';
  const res = await fetch(url);
  if (!res.ok) throw new Error('API ' + res.status);
  const data = await res.json();
  const picks = (data.events || []).filter(isBirmingham).slice(0, 4);
  if (picks.length < 4) {
    console.warn('Only found', picks.length, 'Birmingham events — keeping manual HTML if fewer than 4.');
  }
  if (!picks.length) throw new Error('No Birmingham events returned');

  const today = new Date().toISOString().slice(0, 10);
  const block =
    '        <!-- Birmingham event cards (refresh: node scripts/build-birmingham-intro-resend-events.js) · updated ' +
    today +
    ' -->\n' +
    '        <tr>\n' +
    '          <td class="mobile-pad" style="padding:4px 32px 8px;">\n' +
    '            <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9a7aa8;margin:0 0 12px;">Coming up in Birmingham</p>\n' +
    '          </td>\n' +
    '        </tr>\n' +
    picks
      .map((ev, i) => cardHtml(ev).replace('padding:0 32px 10px', i === picks.length - 1 ? 'padding:0 32px 20px' : 'padding:0 32px 10px'))
      .join('');

  const html = fs.readFileSync(HTML, 'utf8');
  const start = html.indexOf(MARK_START);
  const end = html.indexOf(MARK_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not find event card markers in ' + HTML);
  }
  const next = html.slice(0, start) + block + '\n\n        ' + html.slice(end);
  if (dryRun) {
    console.log(block);
    return;
  }
  fs.writeFileSync(HTML, next);
  picks.forEach((e) => console.log('-', e.title));
  console.log('Updated', path.relative(process.cwd(), HTML));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
