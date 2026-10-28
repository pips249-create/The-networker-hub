#!/usr/bin/env node
/**
 * FSB coverage batch 2 — Nov/Dec Connect events for regional Hub organisers.
 * Prices/dates/URLs taken from the live events.fsb.org.uk calendar.
 *
 *   node scripts/import-fsb-coverage-batch2.js
 *   node scripts/import-fsb-coverage-batch2.js --apply
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createEvent, resolveSeriesGroupId } = require('../api/_lib/supabase-organiser-events');
const { deriveLocationFields, resolveRegionSlug, parseOutcode } = require('../api/_lib/uk-outcode');
const { geocodeUkPostcode } = require('../api/_lib/postcode-geocode');
const { eventImageDbValue } = require('../api/_lib/event-image');
const {
  CHECKOUT_LINK_OUT,
  preferEventbriteCheckoutUrl,
  normalizeExternalBookingUrl,
  normalizeExternalPriceLabel,
} = require('../api/_lib/connected-booking-util');

const APPLY = process.argv.includes('--apply');
const SOURCE_PREFIX = 'fsb-coverage';

const ORG = {
  greaterLondon: '0e57f4c3-2d9a-4fe6-add2-7e0f91a0040d',
  eastOfEngland: '27db9afc-a761-4e7a-a351-09cd713a3455',
  wales: '28c31e5d-8d74-42ff-bc36-eeaea0851144',
  scotland: '3ac0176b-b903-46df-9801-26bd702fc78b',
  northWest: 'fc6d66f6-7267-4a31-8b0c-257bb3c0673c',
  yorkshire: '57e873dc-96f4-4aa7-b0f0-29643045d4bf',
  brighton: '3d71a28a-62cc-4158-ac0f-00803b1f8abf',
  thamesValley: '50e88d9f-1372-4a66-b28b-eda952258300',
  northernIreland: '787ebc37-a34b-4dbe-a0a8-dddbbbe2d4d6',
  eastMidlands: 'f736a3ab-4534-4beb-a583-d4b1b13ef9ad',
};

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
  coast:
    'https://images.unsplash.com/photo-1621349473076-bf700a533713?w=1200&auto=format&fit=crop',
};

function sid(regionKey, slug, ymd) {
  return `${SOURCE_PREFIX}:${regionKey}:${slug}:${ymd}`;
}

function fsb(pathSlug) {
  return `https://events.fsb.org.uk/en/8d2bI2X7/g/fJqTd8nh8e/${pathSlug}`;
}

function buildSpecs() {
  const E = [];
  const add = (spec) => E.push(spec);

  // —— Greater London ——
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Southwark - October',
    date: '2026-10-29T09:30:00',
    endDate: '2026-10-29T11:30:00',
    venue: 'The Dock Shed',
    city: 'London',
    postcode: 'SE16 7PJ',
    description: 'FSB Connect Southwark at The Dock Shed. Informal networking for local small businesses.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-southwark-oct-3aJ8PzUXZ'),
    imageUrl: IMG.networking,
    sourceId: sid('greater-london', 'southwark', '2026-10-29'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Online in North London - November',
    date: '2026-11-03T09:30:00',
    endDate: '2026-11-03T10:45:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for North London. Join remotely for networking and updates.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-north-london-nov-3aJ8PzfET'),
    imageUrl: IMG.online,
    sourceId: sid('greater-london', 'online-north-london', '2026-11-03'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Ealing',
    date: '2026-11-03T10:00:00',
    endDate: '2026-11-03T12:00:00',
    venue: 'West London English School',
    city: 'London',
    postcode: 'W5 5AH',
    description: 'FSB Connect Ealing for West London small businesses. Informal networking and local connections.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-ealing-3aJ8PznOv'),
    imageUrl: IMG.meeting,
    sourceId: sid('greater-london', 'ealing', '2026-11-03'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Online in South London - November',
    date: '2026-11-17T09:30:00',
    endDate: '2026-11-17T10:45:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for South London. Join remotely for networking and updates.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-south-london-nov-3aJ8Pzbyr'),
    imageUrl: IMG.online,
    sourceId: sid('greater-london', 'online-south-london', '2026-11-17'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect in Croydon at TBXH',
    date: '2026-11-19T09:30:00',
    endDate: '2026-11-19T11:30:00',
    venue: 'TBXH Ltd',
    city: 'Croydon',
    postcode: 'CR0 1XP',
    description: 'FSB Connect in Croydon at TBXH. Morning networking for local small businesses.',
    priceLabel: 'From £5',
    priceNote: 'From £5. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-in-croydon-at-tbxh-3aJ8PzpCD'),
    imageUrl: IMG.cowork,
    sourceId: sid('greater-london', 'croydon', '2026-11-19'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Peckham - November',
    date: '2026-11-25T18:00:00',
    endDate: '2026-11-25T19:30:00',
    venue: 'Peckham Levels',
    addressLine1: '95a Rye Lane',
    city: 'London',
    postcode: 'SE15 4ST',
    description: 'Evening FSB Connect in Peckham. Relaxed networking for local SME owners.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-peckham-nov-3aJ8PzUcP'),
    imageUrl: IMG.networking,
    sourceId: sid('greater-london', 'peckham', '2026-11-25'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Online North London - December',
    date: '2026-12-01T09:30:00',
    endDate: '2026-12-01T10:45:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for North London in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-north-london-dec-3aJ8Pzocj'),
    imageUrl: IMG.online,
    sourceId: sid('greater-london', 'online-north-london', '2026-12-01'),
  });
  add({
    organiserId: ORG.greaterLondon,
    title: 'FSB Connect Central London - December',
    date: '2026-12-02T11:00:00',
    endDate: '2026-12-02T12:30:00',
    venue: 'The British Library',
    addressLine1: '96 Euston Road',
    city: 'London',
    postcode: 'NW1 2DB',
    description:
      'Monthly Central London FSB Connect at the British Library Business & IP Centre. Open informal networking for members and non-members.',
    priceLabel: 'From £5',
    priceNote: 'From £5. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-central-london-dec-3aJ8Pzk1F'),
    imageUrl: IMG.britishLibrary,
    sourceId: sid('greater-london', 'central-london', '2026-12-02'),
  });

  // —— Thames Valley ——
  add({
    organiserId: ORG.thamesValley,
    title: 'FSB Connect Bracknell - October',
    date: '2026-10-29T10:00:00',
    endDate: '2026-10-29T12:00:00',
    venue: 'Regus - Bracknell Arlington Square',
    city: 'Bracknell',
    postcode: 'RG12 1WA',
    description: 'FSB Connect Bracknell at Regus Arlington Square. Networking for Thames Valley small businesses.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-bracknell-oct-3aJ8Pzmnp'),
    imageUrl: IMG.cowork,
    sourceId: sid('thames-valley', 'bracknell', '2026-10-29'),
  });
  add({
    organiserId: ORG.thamesValley,
    title: 'FSB Connect Reading - November',
    date: '2026-11-12T10:00:00',
    endDate: '2026-11-12T12:00:00',
    venue: 'Regus Thames Valley',
    city: 'Reading',
    postcode: 'RG1 3JH',
    description: 'FSB Connect Reading at Regus Thames Valley. Morning networking for local SMEs.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-reading-nov-3aJ8PzoXt'),
    imageUrl: IMG.meeting,
    sourceId: sid('thames-valley', 'reading', '2026-11-12'),
  });
  add({
    organiserId: ORG.thamesValley,
    title: 'FSB Connect Oxford - November',
    date: '2026-11-17T10:00:00',
    endDate: '2026-11-17T12:00:00',
    venue: 'Pure Offices',
    city: 'Oxford',
    postcode: 'OX4 2JZ',
    description: 'FSB Connect Oxford at Pure Offices. Networking for Oxfordshire small businesses.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-oxford-nov-3aJ8PzfRN'),
    imageUrl: IMG.cowork,
    sourceId: sid('thames-valley', 'oxford', '2026-11-17'),
  });
  add({
    organiserId: ORG.thamesValley,
    title: 'FSB Connect Bracknell - November',
    date: '2026-11-26T10:00:00',
    endDate: '2026-11-26T12:00:00',
    venue: 'Regus - Bracknell Arlington Square',
    city: 'Bracknell',
    postcode: 'RG12 1WA',
    description: 'FSB Connect Bracknell at Regus Arlington Square.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-bracknell-nov-3aJ8PzoUf'),
    imageUrl: IMG.cowork,
    sourceId: sid('thames-valley', 'bracknell', '2026-11-26'),
  });
  add({
    organiserId: ORG.thamesValley,
    title: 'FSB Connect Oxford - December',
    date: '2026-12-15T10:00:00',
    endDate: '2026-12-15T12:00:00',
    venue: 'Pure Offices',
    city: 'Oxford',
    postcode: 'OX4 2JZ',
    description: 'FSB Connect Oxford at Pure Offices in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-oxford-dec-3aJ8PzfSz'),
    imageUrl: IMG.cowork,
    sourceId: sid('thames-valley', 'oxford', '2026-12-15'),
  });

  // —— East of England ——
  add({
    organiserId: ORG.eastOfEngland,
    title: 'FSB Connect Essex - Budget Briefing',
    date: '2026-10-30T09:30:00',
    endDate: '2026-10-30T11:30:00',
    venue: 'ARU ARISE Innovation Centre',
    city: 'Chelmsford',
    postcode: 'CM1 1SQ',
    description: 'FSB Connect Essex Budget Briefing at ARU ARISE Innovation Centre.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-essex-budget-briefing-3aJ8PzjYD'),
    imageUrl: IMG.meeting,
    sourceId: sid('east-of-england', 'essex-budget', '2026-10-30'),
  });
  add({
    organiserId: ORG.eastOfEngland,
    title: 'FSB Connect Ipswich - November',
    date: '2026-11-03T09:30:00',
    endDate: '2026-11-03T11:30:00',
    venue: 'Riverhills Health Club & Spa',
    city: 'Ipswich',
    postcode: 'IP2 9AF',
    description: 'FSB Connect Ipswich at Riverhills Health Club & Spa. Networking for Suffolk small businesses.',
    priceLabel: 'From £9.50',
    priceNote: 'From £9.50. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-ipswich-nov-3aJ8PzetV'),
    imageUrl: IMG.networking,
    sourceId: sid('east-of-england', 'ipswich', '2026-11-03'),
  });
  add({
    organiserId: ORG.eastOfEngland,
    title: 'FSB Connect Fenland - November',
    date: '2026-11-12T17:00:00',
    endDate: '2026-11-12T19:00:00',
    venue: 'North Cambridgeshire Training Centre',
    city: 'Wisbech',
    postcode: 'PE13 2RQ',
    description: 'FSB Connect Fenland evening networking at North Cambridgeshire Training Centre.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-fenland-nov-3aJ8PzeVJ'),
    imageUrl: IMG.meeting,
    sourceId: sid('east-of-england', 'fenland', '2026-11-12'),
  });
  add({
    organiserId: ORG.eastOfEngland,
    title: 'FSB Connect Cambridge - November',
    date: '2026-11-24T09:30:00',
    endDate: '2026-11-24T11:30:00',
    venue: 'South Cambridgeshire Hall',
    city: 'Cambourne',
    postcode: 'CB23 6EA',
    description: 'FSB Connect Cambridge at South Cambridgeshire Hall. Morning networking for Cambridgeshire SMEs.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-cambridge-nov-3aJ8Pzeez'),
    imageUrl: IMG.cowork,
    sourceId: sid('east-of-england', 'cambridge', '2026-11-24'),
  });

  // —— Scotland ——
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Online in Scotland - 3 November',
    date: '2026-11-03T10:30:00',
    endDate: '2026-11-03T11:30:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Scotland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-scotland-3-nov-3aJ8PzkKb'),
    imageUrl: IMG.online,
    sourceId: sid('scotland', 'online', '2026-11-03'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Glenrothes - November',
    date: '2026-11-05T10:00:00',
    endDate: '2026-11-05T12:00:00',
    venue: 'The Tax Office',
    city: 'Glenrothes',
    postcode: 'KY7 5ND',
    description: 'FSB Connect Glenrothes. Networking for Fife small businesses.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-glenrothes-nov-3aJ8PzkcL'),
    imageUrl: IMG.meeting,
    sourceId: sid('scotland', 'glenrothes', '2026-11-05'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Ayrshire - November',
    date: '2026-11-05T10:30:00',
    endDate: '2026-11-05T12:30:00',
    venue: 'CentreStage',
    city: 'Kilmarnock',
    postcode: 'KA1 1EH',
    description: 'FSB Connect Ayrshire at CentreStage. Networking for Ayrshire small businesses.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-ayrshire-nov-3aJ8Pzl0X'),
    imageUrl: IMG.networking,
    sourceId: sid('scotland', 'ayrshire', '2026-11-05'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Edinburgh - November',
    date: '2026-11-12T10:30:00',
    endDate: '2026-11-12T12:30:00',
    venue: 'West Craigie Farm',
    city: 'Edinburgh',
    postcode: 'EH14 5UW',
    description: 'FSB Connect Edinburgh at West Craigie Farm. Networking for Edinburgh and Lothian SMEs.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-edinburgh-nov-3aJ8PzmcX'),
    imageUrl: IMG.glasgow,
    sourceId: sid('scotland', 'edinburgh', '2026-11-12'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Moray',
    date: '2026-11-12T09:30:00',
    endDate: '2026-11-12T11:30:00',
    venue: 'Threaplands Garden Centre',
    city: 'Elgin',
    postcode: 'IV30 8NH',
    description: 'FSB Connect Moray at Threaplands Garden Centre.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-moray-3aJ8Pzn5Z'),
    imageUrl: IMG.meeting,
    sourceId: sid('scotland', 'moray', '2026-11-12'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Lanarkshire - November',
    date: '2026-11-17T10:00:00',
    endDate: '2026-11-17T12:00:00',
    venue: 'EK Collective',
    city: 'East Kilbride',
    postcode: 'G74 1LL',
    description: 'FSB Connect Lanarkshire at EK Collective.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-lanarkshire-nov-3aJ8Pzl29'),
    imageUrl: IMG.cowork,
    sourceId: sid('scotland', 'lanarkshire', '2026-11-17'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Fife with Regus Kirkcaldy - November',
    date: '2026-11-17T10:00:00',
    endDate: '2026-11-17T12:00:00',
    venue: 'Regus Kirkcaldy',
    city: 'Kirkcaldy',
    postcode: 'KY1 1HB',
    description: 'FSB Connect Fife at Regus Kirkcaldy.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-fife-with-regus-kirkcaldy-nov-3aJ8PzkZ7'),
    imageUrl: IMG.cowork,
    sourceId: sid('scotland', 'fife', '2026-11-17'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Angus - November',
    date: '2026-11-17T14:00:00',
    endDate: '2026-11-17T16:00:00',
    venue: 'Montrose Football Club, Links Park Stadium',
    city: 'Montrose',
    postcode: 'DD10 8TS',
    description: 'FSB Connect Angus at Links Park Stadium, Montrose.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-angus-nov-3aJ8Pzosr'),
    imageUrl: IMG.networking,
    sourceId: sid('scotland', 'angus', '2026-11-17'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Online in Scotland - 19 November',
    date: '2026-11-19T14:00:00',
    endDate: '2026-11-19T15:00:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Scotland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-scotland-19-nov-3aJ8Pzn3x'),
    imageUrl: IMG.online,
    sourceId: sid('scotland', 'online', '2026-11-19'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Glasgow - November',
    date: '2026-11-26T10:00:00',
    endDate: '2026-11-26T12:00:00',
    venue: 'FSB Scotland Office',
    addressLine1: '58 Waterloo Street',
    city: 'Glasgow',
    postcode: 'G2 7DA',
    description: 'FSB Connect Glasgow at the FSB Scotland office.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-glasgow-nov-3aJ8Pzl5N'),
    imageUrl: IMG.glasgow,
    sourceId: sid('scotland', 'glasgow', '2026-11-26'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Online in Scotland - 1 December',
    date: '2026-12-01T10:30:00',
    endDate: '2026-12-01T11:30:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Scotland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-scotland-1-dec-3aJ8PzkSf'),
    imageUrl: IMG.online,
    sourceId: sid('scotland', 'online', '2026-12-01'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Glenrothes - December',
    date: '2026-12-03T10:00:00',
    endDate: '2026-12-03T12:00:00',
    venue: 'The Tax Office',
    city: 'Glenrothes',
    postcode: 'KY7 5ND',
    description: 'FSB Connect Glenrothes in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-glenrothes-dec-3aJ8PzkfZ'),
    imageUrl: IMG.meeting,
    sourceId: sid('scotland', 'glenrothes', '2026-12-03'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Ayrshire - December',
    date: '2026-12-03T10:30:00',
    endDate: '2026-12-03T12:30:00',
    venue: 'CentreStage',
    city: 'Kilmarnock',
    postcode: 'KA1 1EH',
    description: 'FSB Connect Ayrshire in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-ayrshire-dec-3aJ8PzmB7'),
    imageUrl: IMG.networking,
    sourceId: sid('scotland', 'ayrshire', '2026-12-03'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Edinburgh - December',
    date: '2026-12-10T10:30:00',
    endDate: '2026-12-10T12:30:00',
    venue: 'Manahatta',
    city: 'Edinburgh',
    postcode: 'EH2 2PA',
    description: 'FSB Connect Edinburgh at Manahatta.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-edinburgh-dec-3aJ8Pzknd'),
    imageUrl: IMG.glasgow,
    sourceId: sid('scotland', 'edinburgh', '2026-12-10'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Lanarkshire - December',
    date: '2026-12-15T10:00:00',
    endDate: '2026-12-15T12:00:00',
    venue: 'EK Collective',
    city: 'East Kilbride',
    postcode: 'G74 1LL',
    description: 'FSB Connect Lanarkshire in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-lanarkshire-dec-3aJ8PzmJB'),
    imageUrl: IMG.cowork,
    sourceId: sid('scotland', 'lanarkshire', '2026-12-15'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Fife with Regus Kirkcaldy - December',
    date: '2026-12-15T10:00:00',
    endDate: '2026-12-15T12:00:00',
    venue: 'Regus Kirkcaldy',
    city: 'Kirkcaldy',
    postcode: 'KY1 1HB',
    description: 'FSB Connect Fife at Regus Kirkcaldy in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-fife-with-regus-kirkcaldy-dec-3aJ8Pzkm1'),
    imageUrl: IMG.cowork,
    sourceId: sid('scotland', 'fife', '2026-12-15'),
  });
  add({
    organiserId: ORG.scotland,
    title: 'FSB Connect Glasgow - December',
    date: '2026-12-17T10:00:00',
    endDate: '2026-12-17T12:00:00',
    venue: 'FSB Scotland Office',
    addressLine1: '58 Waterloo Street',
    city: 'Glasgow',
    postcode: 'G2 7DA',
    description: 'FSB Connect Glasgow at the FSB Scotland office in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-glasgow-dec-3aJ8PzmMP'),
    imageUrl: IMG.glasgow,
    sourceId: sid('scotland', 'glasgow', '2026-12-17'),
  });

  // —— North West ——
  add({
    organiserId: ORG.northWest,
    title: 'FSB Connect Preston - November',
    date: '2026-11-04T10:00:00',
    endDate: '2026-11-04T12:00:00',
    venue: 'OneCoWork',
    city: 'Preston',
    postcode: 'PR1 3LT',
    description: 'FSB Connect Preston at OneCoWork.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-preston-nov-3aJ8Pzngf'),
    imageUrl: IMG.cowork,
    sourceId: sid('north-west', 'preston', '2026-11-04'),
  });
  add({
    organiserId: ORG.northWest,
    title: 'FSB Connect Blackpool - November',
    date: '2026-11-10T10:00:00',
    endDate: '2026-11-10T12:00:00',
    venue: 'The Grand Hotel Blackpool',
    city: 'Blackpool',
    postcode: 'FY1 5HU',
    description: 'FSB Connect Blackpool at The Grand Hotel.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-blackpool-nov-3aJ8PznyP'),
    imageUrl: IMG.coast,
    sourceId: sid('north-west', 'blackpool', '2026-11-10'),
  });
  add({
    organiserId: ORG.northWest,
    title: 'FSB Connect Networking - North West - November',
    date: '2026-11-11T11:30:00',
    endDate: '2026-11-11T12:45:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect networking for the North West.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-networking-north-west-nov-3aJ8Pzh3N'),
    imageUrl: IMG.online,
    sourceId: sid('north-west', 'online', '2026-11-11'),
  });
  add({
    organiserId: ORG.northWest,
    title: 'FSB Connect Chester - November',
    date: '2026-11-18T17:00:00',
    endDate: '2026-11-18T19:00:00',
    venue: 'The Chester Townhouse',
    city: 'Chester',
    postcode: 'CH1 2AR',
    description: 'FSB Connect Chester evening networking at The Chester Townhouse.',
    priceLabel: 'From £7.50',
    priceNote: 'From £7.50. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-chester-nov-3aJ8PzN1R'),
    imageUrl: IMG.liverpool,
    sourceId: sid('north-west', 'chester', '2026-11-18'),
  });
  add({
    organiserId: ORG.northWest,
    title: 'FSB Connect Networking - North West - December',
    date: '2026-12-09T11:30:00',
    endDate: '2026-12-09T12:45:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect networking for the North West in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-networking-north-west-dec-3aJ8Pzh4z'),
    imageUrl: IMG.online,
    sourceId: sid('north-west', 'online', '2026-12-09'),
  });

  // —— Yorkshire & North East ——
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Bradford with YBS',
    date: '2026-11-04T10:00:00',
    endDate: '2026-11-04T12:00:00',
    venue: 'YBS, Yorkshire House',
    city: 'Bradford',
    postcode: 'BD1 5SN',
    description: 'FSB Connect Bradford with Yorkshire Building Society.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-bradford-with-ybs-3aJ8PziHB'),
    imageUrl: IMG.networking,
    sourceId: sid('yorkshire', 'bradford', '2026-11-04'),
  });
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Online in Yorkshire and the North East - 10 November',
    date: '2026-11-10T10:00:00',
    endDate: '2026-11-10T11:00:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Yorkshire and the North East.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-yorkshire-and-the-north-east-10-nov-3aJ8Pzpc1'),
    imageUrl: IMG.online,
    sourceId: sid('yorkshire', 'online', '2026-11-10'),
  });
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Hartlepool',
    date: '2026-11-10T10:00:00',
    endDate: '2026-11-10T12:00:00',
    venue: 'Health and Social Care Academy',
    city: 'Hartlepool',
    postcode: 'TS24 7NT',
    description: 'FSB Connect Hartlepool at the Health and Social Care Academy.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-hartlepool-3aJ8PzkPR'),
    imageUrl: IMG.meeting,
    sourceId: sid('yorkshire', 'hartlepool', '2026-11-10'),
  });
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Sunderland',
    date: '2026-11-19T09:00:00',
    endDate: '2026-11-19T11:00:00',
    venue: 'North East Business & Innovation Centre',
    city: 'Sunderland',
    postcode: 'SR5 2TA',
    description: 'FSB Connect Sunderland at the North East BIC.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-sunderland-3aJ8PzoWH'),
    imageUrl: IMG.cowork,
    sourceId: sid('yorkshire', 'sunderland', '2026-11-19'),
  });
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Online in Yorkshire and the North East - 24 November',
    date: '2026-11-24T10:00:00',
    endDate: '2026-11-24T11:00:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Yorkshire and the North East.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-yorkshire-and-the-north-east-24-nov-3aJ8Pzpdd'),
    imageUrl: IMG.online,
    sourceId: sid('yorkshire', 'online', '2026-11-24'),
  });
  add({
    organiserId: ORG.yorkshire,
    title: 'FSB Connect Sheffield with Mosborough Hall Hotel',
    date: '2026-11-26T10:00:00',
    endDate: '2026-11-26T12:00:00',
    venue: 'Mosborough Hall Hotel',
    city: 'Sheffield',
    postcode: 'S20 5EA',
    description: 'FSB Connect Sheffield at Mosborough Hall Hotel.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-sheffield-with-mosborough-hall-hotel-3aJ8PzhWP'),
    imageUrl: IMG.networking,
    sourceId: sid('yorkshire', 'sheffield', '2026-11-26'),
  });

  // —— Northern Ireland ——
  add({
    organiserId: ORG.northernIreland,
    title: 'FSB Connect Online in Northern Ireland - October',
    date: '2026-10-29T12:30:00',
    endDate: '2026-10-29T13:30:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Northern Ireland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-northern-ireland-october-3aJ8PzgGz'),
    imageUrl: IMG.online,
    sourceId: sid('northern-ireland', 'online', '2026-10-29'),
  });
  add({
    organiserId: ORG.northernIreland,
    title: 'FSB Connect Online in Northern Ireland - November',
    date: '2026-11-26T12:30:00',
    endDate: '2026-11-26T13:30:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Northern Ireland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-northern-ireland-november-3aJ8Pzm1R'),
    imageUrl: IMG.online,
    sourceId: sid('northern-ireland', 'online', '2026-11-26'),
  });
  add({
    organiserId: ORG.northernIreland,
    title: 'FSB Connect Northern Ireland - 8 December',
    date: '2026-12-08T10:30:00',
    endDate: '2026-12-08T12:30:00',
    venue: 'The Junction',
    city: 'Dungannon',
    postcode: 'BT71 6HW',
    description: 'In-person FSB Connect Northern Ireland at The Junction.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-northern-ireland-8-december-3aJ8Pzpgr'),
    imageUrl: IMG.meeting,
    sourceId: sid('northern-ireland', 'dungannon', '2026-12-08'),
  });
  add({
    organiserId: ORG.northernIreland,
    title: 'FSB Connect Online in Northern Ireland - December',
    date: '2026-12-15T12:30:00',
    endDate: '2026-12-15T13:30:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Northern Ireland.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-northern-ireland-december-3aJ8PzpDp'),
    imageUrl: IMG.online,
    sourceId: sid('northern-ireland', 'online', '2026-12-15'),
  });
  add({
    organiserId: ORG.northernIreland,
    title: 'FSB Connect Northern Ireland - 16 December',
    date: '2026-12-16T10:30:00',
    endDate: '2026-12-16T12:30:00',
    venue: 'FSB NI',
    city: 'Belfast',
    postcode: 'BT1 5HD',
    description: 'In-person FSB Connect Northern Ireland at FSB NI.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-northern-ireland-16-december-3aJ8PzpnJ'),
    imageUrl: IMG.networking,
    sourceId: sid('northern-ireland', 'belfast', '2026-12-16'),
  });

  // —— Wales extras ——
  add({
    organiserId: ORG.wales,
    title: 'FSB Connect Online in Wales - 12 November',
    date: '2026-11-12T13:00:00',
    endDate: '2026-11-12T14:00:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for Wales.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-in-wales-12-november-3aJ8PznTl'),
    imageUrl: IMG.online,
    sourceId: sid('wales', 'online', '2026-11-12'),
  });
  add({
    organiserId: ORG.wales,
    title: 'FSB Connect North Wales - November',
    date: '2026-11-17T09:30:00',
    endDate: '2026-11-17T11:00:00',
    venue: 'Busnes@LlandrilloMenai',
    city: 'Bangor',
    postcode: 'LL57 4HJ',
    description: 'FSB Connect North Wales at Busnes@LlandrilloMenai, Bangor.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-north-wales-november-3aJ8PzmO1'),
    imageUrl: IMG.cowork,
    sourceId: sid('wales', 'north-wales', '2026-11-17'),
  });
  add({
    organiserId: ORG.wales,
    title: 'FSB Connect West Wales - 26 November',
    date: '2026-11-26T09:00:00',
    endDate: '2026-11-26T11:00:00',
    venue: 'Queens Hall',
    city: 'Narberth',
    postcode: 'SA67 7AS',
    description: 'FSB Connect West Wales at Queens Hall, Narberth.',
    priceLabel: 'From £5',
    priceNote: 'From £5. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-west-wales-26-november-3aJ8PzniH'),
    imageUrl: IMG.meeting,
    sourceId: sid('wales', 'west-wales', '2026-11-26'),
  });

  // —— Brighton / Sussex coast (Brighton organiser page) ——
  add({
    organiserId: ORG.brighton,
    title: 'FSB Connect Eastbourne - November',
    date: '2026-11-10T10:00:00',
    endDate: '2026-11-10T12:00:00',
    venue: 'The Friday Street Farm',
    city: 'Eastbourne',
    postcode: 'BN26 6RU',
    description: 'FSB Connect Eastbourne at The Friday Street Farm.',
    priceLabel: 'From £8',
    priceNote: 'From £8. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-eastbourne-nov-3aJ8PzjjV'),
    imageUrl: IMG.coast,
    sourceId: sid('brighton', 'eastbourne', '2026-11-10'),
  });
  add({
    organiserId: ORG.brighton,
    title: 'FSB Connect Fontwell - November',
    date: '2026-11-13T10:00:00',
    endDate: '2026-11-13T12:00:00',
    venue: 'The Old Stables',
    city: 'Fontwell',
    postcode: 'BN18 0SU',
    description: 'FSB Connect Fontwell at The Old Stables.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-fontwell-nov-3aJ8Pzmr3'),
    imageUrl: IMG.coast,
    sourceId: sid('brighton', 'fontwell', '2026-11-13'),
  });
  add({
    organiserId: ORG.brighton,
    title: 'FSB Connect Fontwell - December',
    date: '2026-12-11T10:00:00',
    endDate: '2026-12-11T12:00:00',
    venue: 'The Old Stables',
    city: 'Fontwell',
    postcode: 'BN18 0SU',
    description: 'FSB Connect Fontwell at The Old Stables in December.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-fontwell-dec-3aJ8Pzn2L'),
    imageUrl: IMG.coast,
    sourceId: sid('brighton', 'fontwell', '2026-12-11'),
  });

  // —— East Midlands ——
  add({
    organiserId: ORG.eastMidlands,
    title: 'FSB Connect Online East Midlands - November',
    date: '2026-11-25T10:00:00',
    endDate: '2026-11-25T11:00:00',
    city: 'Online',
    online: true,
    description: 'Online FSB Connect for the East Midlands.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-online-east-midlands-nov-3aJ8PzFNF'),
    imageUrl: IMG.online,
    sourceId: sid('east-midlands', 'online', '2026-11-25'),
  });
  add({
    organiserId: ORG.eastMidlands,
    title: 'FSB Connect Networking Rugby - November',
    date: '2026-11-24T09:30:00',
    endDate: '2026-11-24T11:30:00',
    venue: 'Malt Kiln Farm Shop',
    city: 'Rugby',
    postcode: 'CV23 0SH',
    description: 'FSB Connect Networking Rugby at Malt Kiln Farm Shop.',
    priceLabel: 'Free',
    priceNote: 'Free. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-networking-rugby-nov-3aJ8Pzli5'),
    imageUrl: IMG.meeting,
    sourceId: sid('east-midlands', 'rugby', '2026-11-24'),
  });
  add({
    organiserId: ORG.eastMidlands,
    title: 'FSB Connect Heart of England - November',
    date: '2026-11-20T07:15:00',
    endDate: '2026-11-20T09:00:00',
    venue: 'The Jubilee Centre',
    city: 'Coventry',
    postcode: 'CV1 2HG',
    description: 'Early-morning FSB Connect Heart of England at The Jubilee Centre.',
    priceLabel: 'From £3',
    priceNote: 'From £3. Book via FSB events.',
    bookingUrl: fsb('fsb-connect-heart-of-england-nov-3aJ8Pzi5t'),
    imageUrl: IMG.networking,
    sourceId: sid('east-midlands', 'heart-of-england', '2026-11-20'),
  });

  return E;
}

async function enrichGeo(spec) {
  const derived = deriveLocationFields({
    venue: spec.venue || '',
    addressLine1: spec.addressLine1 || '',
    city: spec.city || '',
    postcode: spec.postcode || '',
  });
  const outcode = parseOutcode(spec.postcode) || null;
  let lat = null;
  let lng = null;
  let city = spec.city || derived.city || '';
  if (spec.postcode) {
    const geo = await geocodeUkPostcode(spec.postcode);
    if (geo) {
      if (geo.latitude != null) lat = geo.latitude;
      if (geo.longitude != null) lng = geo.longitude;
      if (!city && geo.city) city = geo.city;
    }
  }
  const location = derived.location || city || spec.venue || '';
  const regionSlug =
    resolveRegionSlug({
      outcode,
      postcode: spec.postcode,
      city,
      location,
    }) || null;
  return { ...derived, city, outcode, lat, lng, location, regionSlug };
}

async function eventExists(sb, sourceId) {
  const { data } = await sb
    .from('events')
    .select('id, title, checkout_mode, external_booking_url')
    .eq('airtable_id', sourceId)
    .maybeSingle();
  return data || null;
}

async function applyLinkOut(sb, eventId, spec) {
  const url =
    normalizeExternalBookingUrl(preferEventbriteCheckoutUrl(spec.bookingUrl)) || '';
  const priceLabel = normalizeExternalPriceLabel(spec.priceLabel || 'Free');
  if (!url || !priceLabel) return;
  if (!APPLY) {
    console.log(`  · would Link Out ${priceLabel}`);
    return;
  }
  await sb
    .from('events')
    .update({
      checkout_mode: CHECKOUT_LINK_OUT,
      external_booking_url: url,
      external_price_label: priceLabel,
      ticket_sales_enabled: true,
      airtable_id: spec.sourceId,
    })
    .eq('id', eventId);
}

async function publish(sb, spec) {
  const existing = await eventExists(sb, spec.sourceId);
  if (existing) {
    console.log(`  · skip (exists): ${existing.title}`);
    await applyLinkOut(sb, existing.id, spec);
    if (APPLY && spec.imageUrl) {
      await sb
        .from('events')
        .update({ image_url: eventImageDbValue(spec.imageUrl), photo_url: null })
        .eq('id', existing.id);
    }
    return;
  }

  const geo = await enrichGeo(spec);
  const description = [spec.description, spec.priceNote].filter(Boolean).join('\n\n');
  const base = {
    title: spec.title,
    groupId: spec.organiserId,
    type: 'Meeting',
    eventFormat: spec.online ? 'Online' : 'In person',
    listingStatus: 'published',
    description,
    venue: geo.venue || spec.venue || '',
    addressLine1: spec.addressLine1 || '',
    city: geo.city || '',
    postcode: spec.postcode || '',
    attendanceMode: 'tickets',
    date: spec.date,
    endDate: spec.endDate || spec.date,
    seriesGroupId: resolveSeriesGroupId(null, 1),
  };
  if (spec.imageUrl) base.photoUrl = spec.imageUrl;

  if (!APPLY) {
    console.log(
      `  · would publish: ${spec.title} | ${spec.date.slice(0, 16)} | ${spec.priceLabel} | ${spec.sourceId}`
    );
    return;
  }

  const ev = await createEvent(base);
  const patch = {
    city: geo.city || null,
    postcode: spec.postcode || null,
    outcode: geo.outcode,
    venue: spec.venue || null,
    address: spec.addressLine1 || null,
    location_label: geo.location || geo.city,
    region_slug: geo.regionSlug,
    status: 'published',
    approval_status: 'Approved',
    airtable_id: spec.sourceId,
  };
  if (geo.lat != null) patch.latitude = geo.lat;
  if (geo.lng != null) patch.longitude = geo.lng;
  if (spec.imageUrl) patch.image_url = eventImageDbValue(spec.imageUrl);
  await sb.from('events').update(patch).eq('id', ev.id);
  await applyLinkOut(sb, ev.id, spec);
  console.log(`  · published: ${spec.title}`);
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  const specs = buildSpecs();
  console.log(APPLY ? 'APPLY mode' : 'DRY-RUN — pass --apply to write');
  console.log(`Batch 2: ${specs.length} FSB Connect events`);

  const orgIds = [...new Set(specs.map((s) => s.organiserId))];
  for (const id of orgIds) {
    const { data } = await sb.from('organisers').select('id,name,listing_status').eq('id', id).maybeSingle();
    if (!data) {
      console.log('MISSING organiser', id);
      continue;
    }
    if (APPLY && String(data.listing_status || '').toLowerCase() !== 'published') {
      await sb.from('organisers').update({ listing_status: 'published' }).eq('id', id);
    }
    console.log('·', data.name);
  }

  let n = 0;
  for (const spec of specs) {
    await publish(sb, spec);
    n += 1;
  }
  console.log(`\nDone (${n} specs).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
