#!/usr/bin/env node
/**
 * Refresh the four Birmingham event cards in data/birmingham-intro-resend-broadcast.html
 * from the live public API (claimed groups first, with event image when available).
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
const MARK_END = '<!-- Free browse pill -->';

const claimableCache = new Map();

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

function eventImage(ev) {
  const url = String(ev.photo || ev.organiserLogo || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return url;
}

async function isOrganiserClaimed(slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return false;
  if (claimableCache.has(key)) return claimableCache.get(key);
  try {
    const res = await fetch(SITE + '/api/organisers?slug=' + encodeURIComponent(key));
    if (!res.ok) {
      claimableCache.set(key, false);
      return false;
    }
    const data = await res.json();
    const claimable = Boolean(data.organiser && data.organiser.claimable);
    const claimed = !claimable;
    claimableCache.set(key, claimed);
    return claimed;
  } catch {
    claimableCache.set(key, false);
    return false;
  }
}

function sortScore(ev, claimed) {
  let score = 0;
  if (claimed) score += 1000;
  if (eventImage(ev)) score += 200;
  const ts = Date.parse(ev.dateRaw || ev.nextDate || '') || 0;
  return { score, ts };
}

async function pickEvents(events) {
  const birm = events.filter(isBirmingham);
  const scored = [];
  for (const ev of birm) {
    const claimed = await isOrganiserClaimed(ev.organiserSlug);
    const { score, ts } = sortScore(ev, claimed);
    scored.push({ ev, score, ts, claimed });
  }
  scored.sort((a, b) => b.score - a.score || a.ts - b.ts);

  const withImage = scored.filter((r) => eventImage(r.ev));
  const pool = withImage.length >= 4 ? withImage : scored;
  return pool.slice(0, 4).map((r) => ({ ...r.ev, _claimed: r.claimed }));
}

function cardHtml(ev, isLast) {
  const slug = ev.slug;
  const title = escHtml(ev.title);
  const price = escHtml(ev.price || 'See site');
  const time = escHtml(ev.time || '').replace(/ – /g, '&ndash;');
  const venue = escHtml(ev.venueName || ev.venue || 'Birmingham');
  const when = escHtml(shortDate(ev.dateRaw || ev.nextDate || ev.date));
  const img = eventImage(ev);
  const href =
    SITE +
    '/events/' +
    encodeURIComponent(slug) +
    '?utm_source=resend&amp;utm_medium=email&amp;utm_campaign=birmingham-intro&amp;utm_content=event-' +
    encodeURIComponent(slug.slice(0, 24));
  const margin = isLast ? 'margin:0;' : 'margin:0 0 10px;';

  const imageCell = img
    ? '                      <td width="112" valign="middle" style="padding:0 14px 0 0;width:112px;">\n' +
      '                        <a href="' +
      href +
      '" style="text-decoration:none;"><img src="' +
      escHtml(img) +
      '" alt="" width="112" height="84" style="display:block;width:112px;height:84px;object-fit:cover;border-radius:8px;border:0;"></a>\n' +
      '                      </td>\n'
    : '';

  const textColspan = img ? '' : ' colspan="2"';

  return (
    '                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #d9c4e0;border-radius:10px;border-left:4px solid #9a7aa8;' +
    margin +
    '">\n' +
    '                    <tr>\n' +
    imageCell +
    '                      <td valign="middle" style="padding:14px 16px 14px ' +
    (img ? '0' : '16px') +
    ';"' +
    textColspan +
    '>\n' +
    '                        <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;color:#9a7aa8;margin:0 0 6px;">' +
    when +
    ' &middot; ' +
    time +
    ' &middot; ' +
    price +
    '</p>\n' +
    '                        <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;font-weight:700;color:#1c2040;margin:0 0 4px;line-height:1.35;"><a href="' +
    href +
    '" style="color:#1c2040;text-decoration:none;">' +
    title +
    '</a></p>\n' +
    '                        <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:#635c5e;margin:0;">' +
    venue +
    '</p>\n' +
    '                      </td>\n' +
    '                    </tr>\n' +
    '                  </table>\n'
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = SITE + '/api/events?browse=1&location=birmingham&limit=60';
  const res = await fetch(url);
  if (!res.ok) throw new Error('API ' + res.status);
  const data = await res.json();
  const picks = await pickEvents(data.events || []);
  if (picks.length < 4) {
    console.warn('Only found', picks.length, 'Birmingham events for cards.');
  }
  if (!picks.length) throw new Error('No Birmingham events returned');

  const today = new Date().toISOString().slice(0, 10);
  const block =
    '        <!-- Birmingham event cards (refresh: node scripts/build-birmingham-intro-resend-events.js) · updated ' +
    today +
    ' -->\n' +
    '        <tr>\n' +
    '          <td class="mobile-pad" style="padding:0 32px 20px;">\n' +
    '            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:14px;overflow:hidden;border:2px solid #9a7aa8;">\n' +
    '              <tr>\n' +
    '                <td bgcolor="#9a7aa8" style="background-color:#9a7aa8;padding:14px 18px;text-align:center;">\n' +
    '                  <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Live in Birmingham on The Networker UK</p>\n' +
    '                </td>\n' +
    '              </tr>\n' +
    '              <tr>\n' +
    '                <td bgcolor="#f5f0e8" style="background-color:#f5f0e8;padding:14px;">\n' +
    picks.map((ev, i) => cardHtml(ev, i === picks.length - 1)).join('') +
    '                </td>\n' +
    '              </tr>\n' +
    '            </table>\n' +
    '          </td>\n' +
    '        </tr>\n';

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
  picks.forEach((e) => console.log('-', e.title, e._claimed ? '(claimed group)' : '', eventImage(e) ? '[image]' : ''));
  console.log('Updated', path.relative(process.cwd(), HTML));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
