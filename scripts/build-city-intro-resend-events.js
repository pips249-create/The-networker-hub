#!/usr/bin/env node
/**
 * Refresh four live event cards in city intro Resend HTML from the public API.
 *
 * Usage:
 *   node scripts/build-city-intro-resend-events.js birmingham
 *   node scripts/build-city-intro-resend-events.js manchester
 *   node scripts/build-city-intro-resend-events.js birmingham --dry-run
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://www.thenetworkeruk.com';

const CITIES = {
  birmingham: {
    html: path.join(__dirname, '../data/birmingham-intro-resend-broadcast.html'),
    markStart: '<!-- Birmingham event cards',
    markEnd: '<!-- Free browse pill -->',
    apiLocation: 'birmingham',
    trustApiLocation: true,
    campaign: 'birmingham-intro',
    liveHeader: 'Live in Birmingham on The Networker UK',
    defaultVenue: 'Birmingham',
    excludeSlugs: ['coffee-cannoli-with-gusto-birmingham'],
    /** Fixed card order (must have images); slot 3 ≈ one week out instead of Gusto */
    fixedSlugs: [
      'the-business-network-birmingham-live-event',
      'property-poppadoms-birmingham',
      'non-league-networking-lunch-halesowen-town-fc',
      'bpc-a-premium-networking-event-for-ambitious-professionals',
    ],
    match(ev) {
      const blob = [ev.city, ev.location, ev.locationSlug, ev.venueName]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return blob.includes('birmingham') || ev.locationSlug === 'birmingham';
    },
  },
  manchester: {
    html: path.join(__dirname, '../data/manchester-intro-resend-broadcast.html'),
    markStart: '<!-- Manchester event cards',
    markEnd: '<!-- Free browse pill -->',
    apiLocation: 'manchester',
    campaign: 'manchester-intro',
    liveHeader: 'Live in Manchester on The Networker UK',
    defaultVenue: 'Manchester',
    match(ev) {
      const blob = [ev.city, ev.location, ev.locationSlug, ev.venueName]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return blob.includes('manchester') || ev.locationSlug === 'manchester';
    },
  },
};

const claimableCache = new Map();

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

async function pickEvents(events, matchFn, excludeSlugs = [], trustApiLocation = false) {
  const exclude = new Set((excludeSlugs || []).map((s) => String(s).toLowerCase()));
  const local = events.filter((ev) => {
    if (exclude.has(String(ev.slug || '').toLowerCase())) return false;
    return trustApiLocation || matchFn(ev);
  });
  const scored = [];
  for (const ev of local) {
    const claimed = await isOrganiserClaimed(ev.organiserSlug);
    const { score, ts } = sortScore(ev, claimed);
    scored.push({ ev, score, ts, claimed });
  }
  scored.sort((a, b) => b.score - a.score || a.ts - b.ts);

  const withImage = scored.filter((r) => eventImage(r.ev));
  const pool = withImage.length >= 4 ? withImage : scored;
  return { picks: pool.slice(0, 4).map((r) => ({ ...r.ev, _claimed: r.claimed })), scored };
}

function applyFixedSlugs(result, fixedSlugs) {
  if (!fixedSlugs || !fixedSlugs.length || !result.scored.length) return result.picks;
  const picks = [];
  const seen = new Set();
  for (const slug of fixedSlugs) {
    const want = String(slug || '').toLowerCase();
    if (!want || seen.has(want)) continue;
    const row = result.scored.find((r) => String(r.ev.slug || '').toLowerCase() === want);
    if (!row) continue;
    seen.add(want);
    picks.push({ ...row.ev, _claimed: row.claimed });
  }
  if (picks.length >= 4) return picks.slice(0, 4);
  for (const row of result.scored) {
    const k = String(row.ev.slug || '').toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    picks.push({ ...row.ev, _claimed: row.claimed });
    if (picks.length >= 4) break;
  }
  return picks;
}

function cardHtml(ev, isLast, cfg) {
  const slug = ev.slug;
  const title = escHtml(ev.title);
  const price = escHtml(ev.price || 'See site');
  const time = escHtml(ev.time || '').replace(/ – /g, '&ndash;');
  const venue = escHtml(ev.venueName || ev.venue || cfg.defaultVenue);
  const when = escHtml(shortDate(ev.dateRaw || ev.nextDate || ev.date));
  const img = eventImage(ev);
  const href =
    SITE +
    '/events/' +
    encodeURIComponent(slug) +
    '?utm_source=resend&amp;utm_medium=email&amp;utm_campaign=' +
    cfg.campaign +
    '&amp;utm_content=event-' +
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

async function run(cityKey, dryRun) {
  const cfg = CITIES[cityKey];
  if (!cfg) {
    throw new Error('Unknown city: ' + cityKey + '. Use: ' + Object.keys(CITIES).join(', '));
  }

  const url = SITE + '/api/events?browse=1&location=' + encodeURIComponent(cfg.apiLocation) + '&limit=60';
  const res = await fetch(url);
  if (!res.ok) throw new Error('API ' + res.status);
  const data = await res.json();
  const picked = await pickEvents(
    data.events || [],
    cfg.match,
    cfg.excludeSlugs,
    cfg.trustApiLocation
  );
  let picks = cfg.fixedSlugs ? applyFixedSlugs(picked, cfg.fixedSlugs) : picked.picks;
  if (picks.length < 4) {
    console.warn('Only found', picks.length, cityKey, 'events for cards.');
  }
  if (!picks.length) throw new Error('No ' + cityKey + ' events returned');

  const today = new Date().toISOString().slice(0, 10);
  const label = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
  const block =
    '        <!-- ' +
    label +
    ' event cards (refresh: node scripts/build-city-intro-resend-events.js ' +
    cityKey +
    ') · updated ' +
    today +
    ' -->\n' +
    '        <tr>\n' +
    '          <td class="mobile-pad" style="padding:0 32px 20px;">\n' +
    '            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:14px;overflow:hidden;border:2px solid #9a7aa8;">\n' +
    '              <tr>\n' +
    '                <td bgcolor="#9a7aa8" style="background-color:#9a7aa8;padding:14px 18px;text-align:center;">\n' +
    '                  <p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;margin:0;">' +
    cfg.liveHeader +
    '</p>\n' +
    '                </td>\n' +
    '              </tr>\n' +
    '              <tr>\n' +
    '                <td bgcolor="#f5f0e8" style="background-color:#f5f0e8;padding:14px;">\n' +
    picks.map((ev, i) => cardHtml(ev, i === picks.length - 1, cfg)).join('') +
    '                </td>\n' +
    '              </tr>\n' +
    '            </table>\n' +
    '          </td>\n' +
    '        </tr>\n';

  const html = fs.readFileSync(cfg.html, 'utf8');
  const start = html.indexOf(cfg.markStart);
  const end = html.indexOf(cfg.markEnd);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not find event card markers in ' + cfg.html);
  }
  const next = html.slice(0, start) + block + '\n\n        ' + html.slice(end);
  if (dryRun) {
    console.log(block);
    return;
  }
  fs.writeFileSync(cfg.html, next);
  picks.forEach((e) => console.log('-', e.title, e._claimed ? '(claimed group)' : '', eventImage(e) ? '[image]' : ''));
  console.log('Updated', path.relative(process.cwd(), cfg.html));
}

const cityArg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const city = (cityArg || 'birmingham').toLowerCase();
const dryRun = process.argv.includes('--dry-run');

run(city, dryRun).catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
