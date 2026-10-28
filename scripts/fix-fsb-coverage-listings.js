#!/usr/bin/env node
/**
 * One-off fix for FSB coverage listings: correct prices/dates/booking URLs from
 * events.fsb.org.uk, replace logo placeholders with venue/city photos, strip em dashes.
 *
 *   node scripts/fix-fsb-coverage-listings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { eventImageDbValue } = require('../api/_lib/event-image');
const {
  CHECKOUT_LINK_OUT,
  normalizeExternalBookingUrl,
  normalizeExternalPriceLabel,
} = require('../api/_lib/connected-booking-util');

if (!isSupabaseConfigured()) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const sb = getSupabaseAdmin();

const IMG = {
  britishLibrary:
    'https://images.unsplash.com/photo-1771139576882-95890e299938?w=1200&auto=format&fit=crop',
  liverpool:
    'https://images.unsplash.com/photo-1715523535328-d534f33f93d3?w=1200&auto=format&fit=crop',
  glasgow:
    'https://images.unsplash.com/photo-1621519604512-85ea63c15ca2?w=1200&auto=format&fit=crop',
  cowork:
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop',
  networking:
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop',
  meeting:
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop',
  online:
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&auto=format&fit=crop',
};

async function find(sourceId) {
  const { data, error } = await sb
    .from('events')
    .select('id,title,airtable_id,status')
    .eq('airtable_id', sourceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function patchBySource(sourceId, patch) {
  const row = await find(sourceId);
  if (!row) {
    console.log('MISS', sourceId);
    return null;
  }
  const { error: uerr } = await sb.from('events').update(patch).eq('id', row.id);
  if (uerr) console.log('ERR', sourceId, uerr.message);
  else console.log('OK', sourceId, '|', patch.external_price_label || '-', '|', (patch.title || row.title).slice(0, 55));
  return row.id;
}

async function unpublish(sourceId) {
  const row = await find(sourceId);
  if (!row) {
    console.log('MISS unpublish', sourceId);
    return;
  }
  const { error } = await sb.from('events').update({ status: 'draft' }).eq('id', row.id);
  if (error) console.log('ERR unpublish', sourceId, error.message);
  else console.log('UNPUBLISH', sourceId, row.title);
}

async function main() {
  const { data: all, error } = await sb
    .from('events')
    .select('id,title,airtable_id,status,external_price_label')
    .like('airtable_id', 'fsb-coverage:%')
    .order('starts_at');
  if (error) throw error;
  console.log(
    'CURRENT\n',
    (all || []).map((e) => `${e.airtable_id} | ${e.status} | ${e.external_price_label} | ${e.title}`).join('\n')
  );

  // No Brighton / St Albans Dec on the live FSB calendar
  await unpublish('fsb-coverage:brighton:2026-11-12');
  await unpublish('fsb-coverage:east-of-england:2026-12-01');

  await patchBySource('fsb-coverage:yorkshire:2026-10-28', {
    description:
      'Free networking in Barnsley for South Yorkshire small businesses. Welcoming, networking-first session for local owners and the self-employed.\n\nFree. Book via Eventbrite.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    image_url: eventImageDbValue(IMG.networking),
    photo_url: null,
  });

  await patchBySource('fsb-coverage:scotland:2026-10-29', {
    description:
      'Popular FSB Connect networking for small businesses and the self-employed at the FSB Scotland office. Tea, coffee and face-to-face introductions.\n\nFree for FSB members and non-members. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    image_url: eventImageDbValue(IMG.glasgow),
    photo_url: null,
  });

  // Was wrongly dated 29 Oct; official listing is 26 Nov from £7.50
  await patchBySource('fsb-coverage:north-west:2026-10-29', {
    title: 'FSB Connect Liverpool - November',
    starts_at: '2026-11-26T17:00:00+00:00',
    ends_at: '2026-11-26T19:00:00+00:00',
    airtable_id: 'fsb-coverage:north-west:2026-11-26',
    description:
      'FSB Connect Liverpool with Colony Networking at The Municipal Hotel & Spa Liverpool (MGallery). Evening networking for Merseyside small businesses.\n\nMembers £7.50, non-members £15. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('From £7.50'),
    external_booking_url: normalizeExternalBookingUrl(
      'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-liverpool-nov-3aJ8PzNFx'
    ),
    checkout_mode: CHECKOUT_LINK_OUT,
    image_url: eventImageDbValue(IMG.liverpool),
    photo_url: null,
    city: 'Liverpool',
    postcode: 'L2 2DH',
    venue: 'The Municipal Hotel & Spa Liverpool - MGallery',
  });

  await patchBySource('fsb-coverage:east-of-england:2026-11-03', {
    description:
      'Morning FSB Connect networking for small businesses around St Albans at Co-Space. Informal conversation and local connections. Tea and coffee included.\n\nFree for FSB members, £5 for non-members. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    image_url: eventImageDbValue(IMG.cowork),
    photo_url: null,
    ends_at: '2026-11-03T12:00:00+00:00',
  });

  await patchBySource('fsb-coverage:greater-london:2026-11-04', {
    title: 'FSB Connect Central London - November',
    description:
      'Monthly Central London FSB Connect at the British Library Business & IP Centre. Open informal networking for FSB members and non-members.\n\nFrom £5. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('From £5'),
    external_booking_url: normalizeExternalBookingUrl(
      'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-central-london-nov-3aJ8Pzjzd'
    ),
    checkout_mode: CHECKOUT_LINK_OUT,
    image_url: eventImageDbValue(IMG.britishLibrary),
    photo_url: null,
  });

  await patchBySource('fsb-coverage:greater-london:2026-11-10', {
    description:
      'FSB Connect Wimbledon at Metro Bank, Wimbledon Bridge. Local SME networking with FSB membership advisers and Metro Bank support. Free to attend; booking essential.\n\nFree. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    starts_at: '2026-11-10T17:30:00+00:00',
    ends_at: '2026-11-10T19:30:00+00:00',
    image_url: eventImageDbValue(IMG.meeting),
    photo_url: null,
    venue: 'Metro Bank London',
    address: '1-2 Wimbledon Bridge',
  });

  await patchBySource('fsb-coverage:wales:2026-12-03', {
    description:
      'FSB Connect South East Wales in Cardiff at Space2B @ The Maltings. Introductions, informal networking and small-business support.\n\nMembers £5, non-members £7.50. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('From £5'),
    image_url: eventImageDbValue(IMG.networking),
    photo_url: null,
  });

  await patchBySource('fsb-coverage:wales:2026-12-10', {
    description:
      'Online FSB Connect for Wales. Join remotely for networking and updates.\n\nFree. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    image_url: eventImageDbValue(IMG.online),
    photo_url: null,
  });

  await patchBySource('fsb-coverage:wales:2026-12-16', {
    description:
      'Monthly FSB Connect North Wales at Coleg Cambria Business School, Northop. Open to members and non-members for face-to-face small-business networking.\n\nFree. Book via FSB events.',
    external_price_label: normalizeExternalPriceLabel('Free'),
    external_booking_url: normalizeExternalBookingUrl(
      'https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/fsb-connect-north-wales-december-3aJ8PzoOD'
    ),
    checkout_mode: CHECKOUT_LINK_OUT,
    image_url: eventImageDbValue(IMG.cowork),
    photo_url: null,
    venue: 'Coleg Cambria Business School',
    city: 'Mold',
    postcode: 'CH7 6AA',
  });

  const { data: after } = await sb
    .from('events')
    .select('title,starts_at,status,external_price_label,image_url,airtable_id,description')
    .like('airtable_id', 'fsb-coverage:%')
    .order('starts_at');
  console.log('\nAFTER');
  for (const e of after || []) {
    const hasEm = /[—–]/.test(e.description || '');
    console.log(
      [
        String(e.starts_at).slice(0, 16),
        e.status,
        e.external_price_label,
        hasEm ? 'HAS_EMDASH' : 'copy-ok',
        (e.image_url || '').includes('unsplash') ? 'img-ok' : 'img?',
        e.title.slice(0, 48),
      ].join(' | ')
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
