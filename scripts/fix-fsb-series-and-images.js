#!/usr/bin/env node
/**
 * Group recurring FSB Connect listings into series (shared series_group_id +
 * shared series title) and replace repeated Unsplash stock covers with
 * distinct per-series images.
 *
 *   node scripts/fix-fsb-series-and-images.js
 *   node scripts/fix-fsb-series-and-images.js --apply
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { eventImageDbValue } = require('../api/_lib/event-image');

const APPLY = process.argv.includes('--apply');

/** Distinct covers — avoid the overused networking stock shot. */
const IMG = {
  southwark: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&auto=format&fit=crop', // London street
  glasgow: 'https://images.unsplash.com/photo-1571494146906-86de15d3817b?w=1200&auto=format&fit=crop',
  edinburgh: 'https://images.unsplash.com/photo-1621519604512-85ea63c15ca2?w=1200&auto=format&fit=crop',
  britishLibrary: 'https://images.unsplash.com/photo-1771139576882-95890e299938?w=1200&auto=format&fit=crop',
  liverpool: 'https://images.unsplash.com/photo-1715523535328-d534f33f93d3?w=1200&auto=format&fit=crop',
  coast: 'https://images.unsplash.com/photo-1621349473076-bf700a533713?w=1200&auto=format&fit=crop',
  cowork: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop',
  office: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop',
  cafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop',
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop',
  hall: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop',
  online: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop',
  countryside: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&auto=format&fit=crop',
  waterfront: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&auto=format&fit=crop',
  boardroom: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=1200&auto=format&fit=crop',
};

const MONTH =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

function seriesTitle(raw) {
  let s = String(raw || '').trim();
  // "FSB Connect in Wimbledon" → "FSB Connect Wimbledon"
  s = s.replace(/^FSB Connect in\s+/i, 'FSB Connect ');
  // "Online in North London" ↔ "Online North London"
  s = s.replace(/\bOnline in\s+/i, 'Online ');
  // Day+month first so " - 3 November" doesn't become " - 3"
  s = s.replace(new RegExp(`\\s*[–—-]\\s*\\d{1,2}\\s+(${MONTH})(\\s*\\d{4})?\\s*$`, 'i'), '');
  s = s.replace(new RegExp(`\\s+\\d{1,2}\\s+(${MONTH})(\\s*\\d{4})?\\s*$`, 'i'), '');
  // "Pure Networking - Jan 2027" / " - October" / " – Nov"
  s = s.replace(new RegExp(`\\s*[–—-]\\s*(${MONTH})(\\s*\\d{4})?\\s*$`, 'i'), '');
  s = s.replace(new RegExp(`\\s+(${MONTH})(\\s*\\d{4})?\\s*$`, 'i'), '');
  return s.replace(/\s+/g, ' ').trim();
}

function imageForSeries(title) {
  const t = title.toLowerCase();
  if (/online/.test(t)) return IMG.online;
  if (/southwark|peckham|croydon|ealing|bromley|central london|british library/.test(t))
    return /central london/.test(t) ? IMG.britishLibrary : IMG.southwark;
  if (/wimbledon|esher/.test(t)) return IMG.cafe;
  if (/glasgow|lanarkshire|ayrshire|glenrothes|fife|kirkcaldy|moray|angus|rosyth|dundee/.test(t))
    return IMG.glasgow;
  if (/edinburgh|scotland/.test(t)) return IMG.edinburgh;
  if (/liverpool|chester|preston|blackpool|knutsford|altrincham|north.?west|oldham/.test(t))
    return IMG.liverpool;
  if (/brighton|eastbourne|hastings|fontwell|bognor|mid sussex|burgess|southampton|coast/.test(t))
    return IMG.coast;
  if (/hull|york|bradford|sheffield|hartlepool|sunderland|barnsley|yorkshire/.test(t))
    return IMG.waterfront;
  if (/wales|cardiff|bangor|narberth|north wales|west wales/.test(t)) return IMG.countryside;
  if (/oxford|reading|bracknell|thames|weybridge|hogs|reigate|canterbury/.test(t)) return IMG.cowork;
  if (/ipswich|cambridge|essex|fenland|chelmsford|st albans|bury|king.?s lynn|dacorum/.test(t))
    return IMG.office;
  if (/northern ireland|belfast|dungannon/.test(t)) return IMG.hall;
  if (/shropshire|rugby|heart of england|lincoln|midlands|colony/.test(t)) return IMG.hotel;
  if (/poole|salisbury|hampshire|south west/.test(t)) return IMG.countryside;
  return IMG.boardroom;
}

function newSeriesId() {
  return crypto.randomUUID();
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN');

  const { data, error } = await sb
    .from('events')
    .select(
      'id,title,starts_at,ends_at,organiser_id,venue,city,image_url,series_group_id,airtable_id,external_booking_url'
    )
    .like('airtable_id', 'fsb-coverage:%')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);

  const groups = new Map();
  for (const ev of data || []) {
    const title = seriesTitle(ev.title);
    const key = `${ev.organiser_id}::${title.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { title, organiserId: ev.organiser_id, events: [] });
    groups.get(key).events.push(ev);
  }

  let seriesCount = 0;
  let imageUpdates = 0;
  let titleUpdates = 0;

  for (const group of groups.values()) {
    const img = imageForSeries(group.title);
    const isSeries = group.events.length >= 2;
    const seriesId = isSeries ? newSeriesId() : null;
    if (isSeries) {
      seriesCount += 1;
      console.log(
        `\nSERIES (${group.events.length}) → "${group.title}"` +
          group.events.map((e) => `\n   ${String(e.starts_at).slice(0, 10)}`).join('')
      );
    }

    for (const ev of group.events) {
      const patch = {};
      if (isSeries) {
        if (ev.title !== group.title) {
          patch.title = group.title;
          titleUpdates += 1;
        }
        patch.series_group_id = seriesId;
      }
      const currentImg = String(ev.image_url || '');
      // Replace generic networking stock + empty + overused cafe stock
      if (
        !currentImg ||
        /photo-1517245386807|photo-1556761175|MCJP6NXJPUOVCFNGCO7EGWPKREMM/i.test(currentImg) ||
        isSeries
      ) {
        patch.image_url = eventImageDbValue(img);
        patch.photo_url = null;
        imageUpdates += 1;
      }

      if (!Object.keys(patch).length) continue;
      if (!APPLY) {
        if (!isSeries) console.log(`  · would image: ${ev.title.slice(0, 50)}`);
        continue;
      }
      const { error: uerr } = await sb.from('events').update(patch).eq('id', ev.id);
      if (uerr) console.warn('  update failed', ev.id, uerr.message);
    }
  }

  // One-offs that still share the networking stock
  const stock =
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop';
  const singles = [...groups.values()].filter((g) => g.events.length === 1);
  for (const g of singles) {
    const ev = g.events[0];
    if (!String(ev.image_url || '').includes('photo-1517245386807')) continue;
    const img = imageForSeries(g.title);
    console.log(`  · one-off image: ${ev.title.slice(0, 55)}`);
    imageUpdates += 1;
    if (APPLY) {
      await sb
        .from('events')
        .update({ image_url: eventImageDbValue(img), photo_url: null })
        .eq('id', ev.id);
    }
  }

  console.log(
    `\nDone. series=${seriesCount} titleUpdates=${titleUpdates} imageUpdates=${imageUpdates}` +
      (APPLY ? '' : ' (dry-run)')
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
