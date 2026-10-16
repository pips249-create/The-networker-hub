#!/usr/bin/env node
/**
 * Fill Glasgow directory gaps found in the Oct 2026 coverage check.
 *
 * Workflow (matches Command Centre):
 *  - Existing published groups → add events only (no invite email).
 *  - New groups → create as published with send_invite OFF, then add events.
 *    (Plain "Create group" leaves listing_status=draft, which hides events.)
 *
 * Usage:
 *   node scripts/import-glasgow-coverage-gaps.js            # dry-run
 *   node scripts/import-glasgow-coverage-gaps.js --apply    # write to Supabase
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in local.env / env.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createGroup } = require('../api/_lib/supabase-organiser');
const { assignUniqueOrganiserSlug } = require('../api/_lib/organiser-slug');
const { createEvent, createEventsForOccurrences, resolveSeriesGroupId } =
  require('../api/_lib/supabase-organiser-events');
const { deriveLocationFields, resolveRegionSlug, parseOutcode } = require('../api/_lib/uk-outcode');
const { geocodeUkPostcode } = require('../api/_lib/postcode-geocode');

const APPLY = process.argv.includes('--apply');

/** Existing organisers — do not recreate; do not email. */
const EXISTING = {
  b2bMixer: '520fc5c4-d16b-422d-abe2-2d453da30ff9',
  glasgowGirlsClub: '373cdaaf-39a5-4800-b3a6-dbdcfa1b7681',
  scottishNationalNetwork: 'b1c7f012-682f-482a-b5d9-d219c5592a57',
  striveNetworking: '71af2e2a-8b85-4e67-9c80-4707e7b19829',
  infinityBniGlasgow: '22133fd7-526a-443a-8415-97b5860b48db',
};

const B2B_MIXER_GLASGOW_ID = '5a2dae36-3cd8-47eb-a760-691545ac090b';

const NEW_GROUPS = [
  {
    key: 'scottishConstructionSummit',
    name: 'Scottish Construction Summit',
    email: 'raymond@scottishnews.com',
    website: 'https://www.scottishconstructionsummit.com/',
    description:
      'Scotland’s gathering for construction professionals — exhibition, speakers and networking at the SEC Glasgow.',
  },
  {
    key: 'foundersCoffeeClubGlasgow',
    name: 'Founders Coffee Club Glasgow',
    // No public organiser inbox confirmed — hub inbox until claim; invite stays OFF.
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.eventbrite.com/o/founders-coffee-club',
    description:
      'Monthly coffee meetup for founders, freelancers and small business owners in Glasgow — no pitches, real conversations.',
  },
  {
    key: 'bniNexusGlasgow',
    name: 'BNI Nexus Glasgow',
    // Separate from Infinity BNI (Glasgow) until we confirm they are the same chapter.
    email: 'hi@thenetworkeruk.com',
    website: 'https://www.bni.com/',
    description:
      'Weekly BNI chapter meeting in Bellahouston — local business owners exchanging referrals every Friday morning.',
  },
];

function bookingBlurb(url, priceNote) {
  const lines = [];
  if (priceNote) lines.push(priceNote);
  if (url) lines.push('Book / reserve: ' + url);
  return lines.join('\n\n');
}

async function enrichGeo({ venue, addressLine1, city, postcode }) {
  const derived = deriveLocationFields({ venue, addressLine1, city, postcode });
  const outcode = parseOutcode(postcode) || null;
  let lat = null;
  let lng = null;
  let resolvedCity = city || derived.city || '';
  if (postcode) {
    const geo = await geocodeUkPostcode(postcode);
    if (geo) {
      if (geo.latitude != null) lat = geo.latitude;
      if (geo.longitude != null) lng = geo.longitude;
      if (!resolvedCity && geo.city) resolvedCity = geo.city;
    }
  }
  const locationLabel = derived.location || resolvedCity || venue || '';
  const regionSlug =
    resolveRegionSlug({
      outcode,
      postcode,
      city: resolvedCity,
      location: locationLabel,
    }) || 'glasgow';
  return {
    venue: venue || '',
    addressLine1: addressLine1 || '',
    city: resolvedCity || 'Glasgow',
    postcode: postcode || '',
    location: locationLabel,
    outcode,
    lat,
    lng,
    regionSlug,
  };
}

async function ensureNewGroup(sb, spec, createdMap) {
  if (spec.preferExistingId) {
    const { data: existing } = await sb
      .from('organisers')
      .select('id, name, listing_status, slug, email')
      .eq('id', spec.preferExistingId)
      .maybeSingle();
    if (existing) {
      console.log(
        `  · reuse existing ${existing.name} (${existing.id}) instead of creating ${spec.name}`
      );
      createdMap[spec.key] = existing.id;
      // Keep Infinity published; rename is intentionally NOT applied.
      return existing.id;
    }
  }

  const { data: byName } = await sb
    .from('organisers')
    .select('id, name, listing_status, slug')
    .ilike('name', spec.name)
    .limit(1)
    .maybeSingle();
  if (byName) {
    console.log(`  · already exists: ${byName.name} (${byName.id})`);
    if (String(byName.listing_status || '').toLowerCase() !== 'published' && APPLY) {
      await sb.from('organisers').update({ listing_status: 'published' }).eq('id', byName.id);
      console.log('    published (no invite email)');
    }
    createdMap[spec.key] = byName.id;
    return byName.id;
  }

  if (!APPLY) {
    console.log(`  · would create published group (no email): ${spec.name} <${spec.email}>`);
    createdMap[spec.key] = `dry-run:${spec.key}`;
    return createdMap[spec.key];
  }

  const created = await createGroup({
    name: spec.name,
    contactEmail: spec.email,
    email: spec.email,
    description: spec.description,
    website: spec.website,
    listingStatus: 'published',
    verificationStatus: 'Pending',
  });
  try {
    await assignUniqueOrganiserSlug(sb, created.id, spec.name);
  } catch (e) {
    console.warn('    slug assign failed:', e.message || e);
  }
  console.log(`  · created published group (no invite): ${spec.name} (${created.id})`);
  createdMap[spec.key] = created.id;
  return created.id;
}

async function eventExists(sb, organiserId, titlePrefix) {
  if (String(organiserId).startsWith('dry-run:')) return false;
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at')
    .eq('organiser_id', organiserId)
    .ilike('title', titlePrefix + '%')
    .gte('starts_at', new Date().toISOString())
    .limit(5);
  if (error) throw new Error(error.message);
  return (data && data[0]) || null;
}

async function publishEvent(sb, organiserId, spec) {
  const existing = await eventExists(sb, organiserId, spec.titleMatch || spec.title.slice(0, 24));
  if (existing) {
    console.log(`  · skip (already listed): ${existing.title} @ ${existing.starts_at}`);
    return existing;
  }

  const geo = await enrichGeo(spec);
  const description = [spec.description, bookingBlurb(spec.bookingUrl, spec.priceNote)]
    .filter(Boolean)
    .join('\n\n');

  const base = {
    title: spec.title,
    groupId: organiserId,
    type: spec.eventType || 'Meeting',
    eventFormat: 'In person',
    listingStatus: 'published',
    description,
    venue: geo.venue,
    addressLine1: geo.addressLine1,
    city: geo.city,
    postcode: geo.postcode,
    attendanceMode: spec.attendanceMode || 'tickets',
  };

  if (!APPLY) {
    console.log(
      `  · would publish: ${spec.title} | ${spec.date} | ${geo.city} ${geo.postcode} | org=${organiserId}`
    );
    return null;
  }

  if (String(organiserId).startsWith('dry-run:')) {
    console.log('  · skip create — organiser was dry-run');
    return null;
  }

  const occurrences = (spec.occurrences || [{ date: spec.date, endDate: spec.endDate }]).map(
    (o) => ({
      date: o.date,
      endDate: o.endDate || o.date,
    })
  );
  const seriesGroupId = resolveSeriesGroupId(null, occurrences.length);
  let events;
  if (occurrences.length === 1) {
    events = [
      await createEvent({
        ...base,
        seriesGroupId,
        date: occurrences[0].date,
        endDate: occurrences[0].endDate,
      }),
    ];
  } else {
    const result = await createEventsForOccurrences(
      { ...base, seriesGroupId },
      occurrences,
      seriesGroupId,
      null
    );
    events = result.events;
  }

  // Ensure geo columns are populated even if createEvent path omitted some.
  const patch = {
    city: geo.city,
    postcode: geo.postcode || null,
    outcode: geo.outcode,
    venue: geo.venue || null,
    address: geo.addressLine1 || null,
    location_label: geo.location || geo.city,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
  };
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;

  for (const ev of events) {
    const { error } = await sb.from('events').update(patch).eq('id', ev.id);
    if (error) console.warn('    geo patch failed', ev.id, error.message);
  }

  console.log(`  · published ${events.length} date(s): ${spec.title}`);
  return events[0];
}

async function fixB2bMixerGeo(sb) {
  console.log('\n1) Fix B2B Mixer Glasgow geo fields');
  const geo = await enrichGeo({
    venue: "Waxy O'Connor's Glasgow",
    addressLine1: '44 West George Street',
    city: 'Glasgow',
    postcode: 'G2 1DH',
  });
  if (!APPLY) {
    console.log('  · would set', {
      city: geo.city,
      postcode: geo.postcode,
      outcode: geo.outcode,
      venue: geo.venue,
      lat: geo.lat,
      lng: geo.lng,
      region_slug: geo.regionSlug,
    });
    return;
  }
  const { error } = await sb
    .from('events')
    .update({
      city: geo.city,
      postcode: geo.postcode,
      outcode: geo.outcode,
      venue: geo.venue,
      address: geo.addressLine1,
      location_label: `${geo.venue}, ${geo.city}`,
      region_slug: geo.regionSlug,
      latitude: geo.lat,
      longitude: geo.lng,
    })
    .eq('id', B2B_MIXER_GLASGOW_ID);
  if (error) throw new Error(error.message);
  console.log('  · updated B2B Mixer Glasgow location → G2 1DH');
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  console.log(APPLY ? 'APPLY mode — writing to Supabase' : 'DRY-RUN — pass --apply to write');

  await fixB2bMixerGeo(sb);

  console.log('\n2) Ensure new groups (published, no invite email)');
  const createdMap = {};
  for (const spec of NEW_GROUPS) {
    await ensureNewGroup(sb, spec, createdMap);
  }

  console.log('\n3) Add missing Glasgow events');

  const events = [
    {
      organiserId: EXISTING.glasgowGirlsClub,
      title: 'The Connection Games – November',
      titleMatch: 'The Connection Games',
      eventType: 'Meeting',
      date: '2026-11-26T10:00:00+00:00',
      endDate: '2026-11-26T12:00:00+00:00',
      venue: 'GGC HQ / The Clubhouse',
      addressLine1: 'Suite 119, Central Chambers, 91 Hope Street',
      city: 'Glasgow',
      postcode: 'G2 6LL',
      bookingUrl: 'https://www.eventbrite.com/e/the-connection-games-november-tickets-1999383605185',
      priceNote: 'Tickets from £5 + VAT (members) / £10 + VAT (guests) via Eventbrite.',
      description:
        'Monthly gamified networking for women in business at Glasgow Girls Club HQ — creative icebreakers, guided discussions and peer support over morning coffee.',
    },
    {
      organiserId: EXISTING.scottishNationalNetwork,
      title: 'SNN Business Exchange',
      eventType: 'Conference',
      date: '2026-11-12T09:00:00+00:00',
      endDate: '2026-11-12T17:00:00+00:00',
      venue: 'Celtic Park',
      addressLine1: 'Janefield Street',
      city: 'Glasgow',
      postcode: 'G40 3RE',
      bookingUrl: 'https://www.eventbrite.co.uk/e/snn-business-exchange-tickets-1992691360501',
      priceNote: 'Tickets via Eventbrite. Pitch Perfect entry via hello@scottishnationalnetwork.com.',
      description:
        'Full-day Scottish National Network Business Exchange at Celtic Park — structured networking, founder stories, workshops and the £5,000 Pitch Perfect investor-readiness prize.',
    },
    {
      organiserId: EXISTING.striveNetworking,
      title: 'Multi-Vertical Business Networking | Elevating Your Potential - Glasgow',
      titleMatch: 'Multi-Vertical Business Networking',
      eventType: 'Meeting',
      date: '2026-11-11T18:00:00+00:00',
      endDate: '2026-11-11T21:00:00+00:00',
      venue: 'Bunker Bar',
      addressLine1: '193-199 Bath Street',
      city: 'Glasgow',
      postcode: 'G2 4HU',
      bookingUrl:
        'https://www.eventbrite.com/e/multi-vertical-business-networking-elevating-your-potential-glasgow-tickets-1992706758557',
      priceNote: 'Tickets via Eventbrite (free–£16.99).',
      description:
        'Strive multi-vertical evening networking at Bunker Bar in Glasgow city centre — for tenured professionals and newcomers.',
    },
    {
      organiserId: createdMap.scottishConstructionSummit,
      title: 'Scottish Construction Summit 2026',
      eventType: 'Exhibition',
      date: '2026-10-22T09:30:00+01:00',
      endDate: '2026-10-22T16:00:00+01:00',
      venue: 'SEC Centre, Hall 5',
      addressLine1: 'Exhibition Way',
      city: 'Glasgow',
      postcode: 'G3 8YW',
      bookingUrl: 'https://www.scottishconstructionsummit.com/',
      priceNote: 'Free to attend for visitors — register via the summit website.',
      description:
        'Scotland’s largest gathering of construction professionals at the SEC Glasgow — exhibition floor, speakers, Future Talent Hub and networking across the industry.',
    },
    {
      organiserId: createdMap.foundersCoffeeClubGlasgow,
      title: 'Glasgow Networking Events for Founders | Founders Coffee Club',
      titleMatch: 'Founders Coffee Club',
      eventType: 'Meeting',
      date: '2026-11-20T11:00:00+00:00',
      endDate: '2026-11-20T12:00:00+00:00',
      venue: 'Clockwise Glasgow',
      addressLine1: '77 Renfrew Street',
      city: 'Glasgow',
      postcode: 'G2 3BZ',
      bookingUrl:
        'https://www.eventbrite.com/e/glasgow-networking-events-for-founders-founders-coffee-club-tickets-2002710497008',
      priceNote: 'Tickets £15 (launch £7.50) via Eventbrite. Monthly — 3rd Friday.',
      description:
        'Relaxed founders coffee meetup at Clockwise Glasgow — no pitches, host-led introductions, option to stay and co-work after.',
    },
    {
      organiserId: createdMap.bniNexusGlasgow || EXISTING.infinityBniGlasgow,
      title: 'BNI Nexus Glasgow Weekly Business Networking Meeting',
      titleMatch: 'BNI Nexus Glasgow',
      eventType: 'Meeting',
      attendanceMode: 'membership_meeting',
      occurrences: [
        { date: '2026-10-23T06:45:00+01:00', endDate: '2026-10-23T08:30:00+01:00' },
        { date: '2026-10-30T06:45:00+00:00', endDate: '2026-10-30T08:30:00+00:00' },
        { date: '2026-11-06T06:45:00+00:00', endDate: '2026-11-06T08:30:00+00:00' },
        { date: '2026-11-13T06:45:00+00:00', endDate: '2026-11-13T08:30:00+00:00' },
        { date: '2026-11-20T06:45:00+00:00', endDate: '2026-11-20T08:30:00+00:00' },
        { date: '2026-11-27T06:45:00+00:00', endDate: '2026-11-27T08:30:00+00:00' },
      ],
      venue: 'Prince & Princess of Wales Hospice',
      addressLine1: '20 Dumbreck Road, Bellahouston',
      city: 'Glasgow',
      postcode: 'G41 5BW',
      bookingUrl: 'https://somo.social/s/bni-nexus-glasgow-weekly-business-networking-meeting',
      priceNote: 'Visitor places via the chapter — enquire on the listing / Somo page.',
      description:
        'Weekly Friday BNI Nexus Glasgow meeting — local business owners building referral relationships. One member per business category.',
    },
  ];

  for (const spec of events) {
    const orgId = spec.organiserId;
    if (!orgId) {
      console.log(`  · skip ${spec.title} — missing organiser id`);
      continue;
    }
    await publishEvent(sb, orgId, spec);
  }

  console.log('\nDone.', APPLY ? 'Review /networking/glasgow' : 'Re-run with --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
