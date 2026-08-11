#!/usr/bin/env node
/**
 * Enrich public networking groups with geography (organisers.outcode).
 *
 * Priority:
 *   1. Most common outcode from their Hub events
 *   2. Full UK postcode found in name / description
 *   3. Place / region name → networking region → centre outcode
 *
 * Only fills empty outcodes unless --force.
 *
 * Usage:
 *   node scripts/enrich-organiser-geography.js
 *   node scripts/enrich-organiser-geography.js --execute
 *   node scripts/enrich-organiser-geography.js --execute --force
 *
 * Also writes data/organiser-geography-enrichment.csv (proposed / applied rows).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
for (const name of ['local.env', '.env.local', '.env']) {
  const p = path.join(root, name);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { isPublicOrganiser } = require('../api/_lib/supabase-organisers-browse');
const {
  parseOutcode,
  parseFullUkPostcode,
  cityRegionFromInput,
  resolveRegionSlug,
  REGION_SECTORS,
} = require('../api/_lib/uk-outcode');
const { getNetworkingRegion } = require('../api/_lib/networking-regions');

const OUT_CSV = path.join(root, 'data/organiser-geography-enrichment.csv');
const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');

/**
 * Extra place names → region slug (word-boundary match, longest first).
 * Prefer cities/counties already in REGION_SECTORS; map nearby towns into those.
 */
const PLACE_TO_REGION = [
  ['central london', 'central-london'],
  ['north london', 'north-london'],
  ['south london', 'south-london'],
  ['east london', 'east-london'],
  ['west london', 'west-london'],
  ['greater manchester', 'manchester'],
  ['west midlands', 'birmingham'],
  ['east midlands', 'nottingham'],
  ['south yorkshire', 'sheffield'],
  ['west yorkshire', 'leeds'],
  ['tyne and wear', 'newcastle'],
  ['tyne & wear', 'newcastle'],
  ['milton keynes', 'buckinghamshire'],
  ['kingston upon hull', 'leeds'],
  ['newcastle upon tyne', 'newcastle'],
  ['stockton on tees', 'newcastle'],
  ['kingston upon thames', 'surrey'],
  ['tunbridge wells', 'kent'],
  ['royal tunbridge wells', 'kent'],
  ['basingstoke', 'hampshire'],
  ['southampton', 'hampshire'],
  ['portsmouth', 'hampshire'],
  ['winchester', 'hampshire'],
  ['bournemouth', 'bournemouth'],
  ['poole', 'bournemouth'],
  ['christchurch', 'bournemouth'],
  ['brighton', 'brighton'],
  ['hove', 'brighton'],
  ['worthing', 'sussex'],
  ['crawley', 'sussex'],
  ['gatwick', 'sussex'],
  ['horsham', 'sussex'],
  ['eastbourne', 'sussex'],
  ['hastings', 'sussex'],
  ['guildford', 'surrey'],
  ['woking', 'surrey'],
  ['reigate', 'surrey'],
  ['redhill', 'surrey'],
  ['epsom', 'surrey'],
  ['maidstone', 'kent'],
  ['canterbury', 'kent'],
  ['ashford', 'kent'],
  ['tonbridge', 'kent'],
  ['sevenoaks', 'kent'],
  ['dartford', 'kent'],
  ['medway', 'kent'],
  ['chatham', 'kent'],
  ['gillingham', 'kent'],
  ['rochester', 'kent'],
  ['bromley', 'south-london'],
  ['croydon', 'south-london'],
  ['richmond', 'west-london'],
  ['islington', 'north-london'],
  ['hackney', 'east-london'],
  ['shoreditch', 'east-london'],
  ['canary wharf', 'east-london'],
  ['city of london', 'central-london'],
  ['westminster', 'central-london'],
  ['chelmsford', 'essex'],
  ['colchester', 'essex'],
  ['basildon', 'essex'],
  ['southend', 'essex'],
  ['brentwood', 'essex'],
  ['harlow', 'essex'],
  ['romford', 'east-london'],
  ['watford', 'hertfordshire'],
  ['st albans', 'hertfordshire'],
  ['hemel hempstead', 'hertfordshire'],
  ['stevenage', 'hertfordshire'],
  ['hertford', 'hertfordshire'],
  ['reading', 'reading'],
  ['slough', 'berkshire'],
  ['maidenhead', 'berkshire'],
  ['windsor', 'berkshire'],
  ['newbury', 'berkshire'],
  ['bracknell', 'berkshire'],
  ['wokingham', 'berkshire'],
  ['oxford', 'oxford'],
  ['banbury', 'oxfordshire'],
  ['cambridge', 'cambridge'],
  ['peterborough', 'cambridgeshire'],
  ['ely', 'cambridgeshire'],
  ['aylesbury', 'buckinghamshire'],
  ['high wycombe', 'buckinghamshire'],
  ['marlow', 'buckinghamshire'],
  ['chester', 'chester'],
  ['warrington', 'cheshire'],
  ['macclesfield', 'cheshire'],
  ['crewe', 'cheshire'],
  ['wilmslow', 'cheshire'],
  ['altrincham', 'manchester'],
  ['stockport', 'manchester'],
  ['bolton', 'manchester'],
  ['bury', 'manchester'],
  ['oldham', 'manchester'],
  ['rochdale', 'manchester'],
  ['salford', 'manchester'],
  ['wigan', 'lancashire'],
  ['preston', 'lancashire'],
  ['blackpool', 'lancashire'],
  ['lancaster', 'lancashire'],
  ['burnley', 'lancashire'],
  ['blackburn', 'lancashire'],
  ['liverpool', 'liverpool'],
  ['birkenhead', 'liverpool'],
  ['wirral', 'liverpool'],
  ['st helens', 'liverpool'],
  ['manchester', 'manchester'],
  ['leeds', 'leeds'],
  ['bradford', 'leeds'],
  ['huddersfield', 'leeds'],
  ['wakefield', 'leeds'],
  ['halifax', 'leeds'],
  ['harrogate', 'leeds'],
  ['york', 'leeds'],
  ['hull', 'leeds'],
  ['sheffield', 'sheffield'],
  ['doncaster', 'sheffield'],
  ['rotherham', 'sheffield'],
  ['barnsley', 'sheffield'],
  ['nottingham', 'nottingham'],
  ['derby', 'nottingham'],
  ['leicester', 'leicester'],
  ['coventry', 'birmingham'],
  ['wolverhampton', 'birmingham'],
  ['walsall', 'birmingham'],
  ['dudley', 'birmingham'],
  ['solihull', 'birmingham'],
  ['birmingham', 'birmingham'],
  ['midlands', 'birmingham'],
  ['bristol', 'bristol'],
  ['bath', 'bristol'],
  ['gloucester', 'bristol'],
  ['cheltenham', 'bristol'],
  ['swindon', 'bristol'],
  ['exeter', 'bristol'],
  ['plymouth', 'bristol'],
  ['torquay', 'bristol'],
  ['devon', 'bristol'],
  ['cornwall', 'bristol'],
  ['somerset', 'bristol'],
  ['dorset', 'bournemouth'],
  ['cardiff', 'cardiff'],
  ['swansea', 'cardiff'],
  ['newport', 'cardiff'],
  ['wales', 'cardiff'],
  ['edinburgh', 'edinburgh'],
  ['glasgow', 'glasgow'],
  ['aberdeen', 'edinburgh'],
  ['dundee', 'edinburgh'],
  ['inverness', 'edinburgh'],
  ['scotland', 'edinburgh'],
  ['fife', 'edinburgh'],
  ['ayrshire', 'glasgow'],
  ['lanarkshire', 'glasgow'],
  ['belfast', 'belfast'],
  ['newcastle', 'newcastle'],
  ['gateshead', 'newcastle'],
  ['sunderland', 'newcastle'],
  ['durham', 'newcastle'],
  ['middlesbrough', 'newcastle'],
  ['teeside', 'newcastle'],
  ['teesside', 'newcastle'],
  ['cumbria', 'lancashire'],
  ['carlisle', 'lancashire'],
  ['hereford', 'bristol'],
  ['herefordshire', 'bristol'],
  ['worcester', 'birmingham'],
  ['worcestershire', 'birmingham'],
  ['shropshire', 'birmingham'],
  ['shrewsbury', 'birmingham'],
  ['stafford', 'birmingham'],
  ['staffordshire', 'birmingham'],
  ['stoke', 'birmingham'],
  ['stoke-on-trent', 'birmingham'],
  ['norwich', 'cambridge'],
  ['norfolk', 'cambridge'],
  ['ipswich', 'essex'],
  ['suffolk', 'essex'],
  ['lincoln', 'nottingham'],
  ['lincolnshire', 'nottingham'],
  ['northampton', 'buckinghamshire'],
  ['northamptonshire', 'buckinghamshire'],
  ['bedford', 'cambridgeshire'],
  ['bedfordshire', 'cambridgeshire'],
  ['luton', 'hertfordshire'],
  ['ilminster', 'bristol'],
  ['taunton', 'bristol'],
  ['yeovil', 'bristol'],
  ['truro', 'bristol'],
  ['falmouth', 'bristol'],
  ['london', 'london'],
];

function esc(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function centreOutcodeForRegion(region) {
  const list = REGION_SECTORS[region];
  if (!list || !list.length) return '';
  return list[0];
}

function regionLabel(region) {
  const meta = getNetworkingRegion(region);
  if (meta && meta.name) return meta.name;
  return String(region || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function regionFromPlaceText(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) return null;

  // Prefer explicit aliases / sectors already in Hub helpers
  const fromHelper = cityRegionFromInput(raw);
  if (fromHelper) return fromHelper;

  for (let i = 0; i < PLACE_TO_REGION.length; i++) {
    const [place, region] = PLACE_TO_REGION[i];
    const re = new RegExp('\\b' + place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(raw)) return region;
  }
  return null;
}

function modeValue(values) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function inferGeography(org, eventRows) {
  // 1) Events
  const eventOutcodes = (eventRows || [])
    .map((e) => parseOutcode(e.outcode) || parseOutcode(e.postcode) || parseOutcode(e.location_label))
    .filter(Boolean);
  const eventOc = modeValue(eventOutcodes);
  if (eventOc) {
    const region =
      resolveRegionSlug({ outcode: eventOc }) ||
      regionFromPlaceText(org.name) ||
      '';
    return {
      outcode: eventOc,
      region_slug: region,
      source: 'events',
      confidence: 'high',
    };
  }

  const blob = [org.name, org.description].filter(Boolean).join(' | ');

  // 2) Full UK postcode in text only (avoid acronym names like "M4 Business Network")
  const fullPc = parseFullUkPostcode(blob);
  const fromPc = parseOutcode(fullPc);
  if (fromPc) {
    const region = resolveRegionSlug({ outcode: fromPc, postcode: fullPc, location: blob }) || '';
    return {
      outcode: fromPc,
      region_slug: region,
      source: 'postcode_in_text',
      confidence: 'high',
    };
  }

  // 3) Place / region name — prefer group name over description (descriptions wander)
  const region = regionFromPlaceText(org.name) || regionFromPlaceText(org.description);
  if (region) {
    const outcode = centreOutcodeForRegion(region);
    if (!outcode) return null;
    return {
      outcode,
      region_slug: region,
      source: regionFromPlaceText(org.name) ? 'place_name' : 'place_in_description',
      confidence: regionFromPlaceText(org.name) ? 'medium' : 'low',
    };
  }

  return null;
}

(async () => {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  console.log(EXECUTE ? 'EXECUTE' : 'DRY RUN', FORCE ? '(force overwrite)' : '(empty outcodes only)');

  const orgs = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('organisers')
      .select('id, name, slug, description, outcode, listing_status, verification_status')
      .order('name')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    orgs.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const publicOrgs = orgs.filter(isPublicOrganiser);
  const events = [];
  from = 0;
  while (true) {
    const { data, error } = await sb
      .from('events')
      .select('organiser_id, outcode, postcode, city, location_label')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;
    events.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const eventsByOrg = new Map();
  for (const e of events) {
    if (!e.organiser_id) continue;
    if (!eventsByOrg.has(e.organiser_id)) eventsByOrg.set(e.organiser_id, []);
    eventsByOrg.get(e.organiser_id).push(e);
  }

  const proposals = [];
  let skipHasOutcode = 0;
  let noSignal = 0;

  for (const org of publicOrgs) {
    const existing = parseOutcode(org.outcode);
    if (existing && !FORCE) {
      skipHasOutcode += 1;
      continue;
    }
    const inferred = inferGeography(org, eventsByOrg.get(org.id) || []);
    if (!inferred) {
      noSignal += 1;
      continue;
    }
    if (existing && existing === inferred.outcode) {
      skipHasOutcode += 1;
      continue;
    }
    proposals.push({
      organiser_id: org.id,
      name: org.name,
      slug: org.slug || '',
      previous_outcode: existing || '',
      outcode: inferred.outcode,
      region_slug: inferred.region_slug || '',
      region_label: regionLabel(inferred.region_slug),
      source: inferred.source,
      confidence: inferred.confidence,
    });
  }

  const header = [
    'organiser_id',
    'name',
    'slug',
    'previous_outcode',
    'outcode',
    'region_slug',
    'region_label',
    'source',
    'confidence',
  ];
  const csv =
    header.join(',') +
    '\n' +
    proposals.map((r) => header.map((h) => esc(r[h])).join(',')).join('\n') +
    '\n';
  fs.writeFileSync(OUT_CSV, csv);

  const bySource = {};
  const byRegion = {};
  for (const p of proposals) {
    bySource[p.source] = (bySource[p.source] || 0) + 1;
    byRegion[p.region_slug || '(none)'] = (byRegion[p.region_slug || '(none)'] || 0) + 1;
  }

  console.log('Public groups:', publicOrgs.length);
  console.log('Already had outcode (skipped):', skipHasOutcode);
  console.log('No geography signal:', noSignal);
  console.log('Proposed updates:', proposals.length);
  console.log('By source:', bySource);
  console.log(
    'Top regions:',
    Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  );
  console.log('Report:', path.relative(root, OUT_CSV));

  if (!EXECUTE) {
    console.log('Re-run with --execute to write organisers.outcode');
    return;
  }

  let updated = 0;
  for (let i = 0; i < proposals.length; i += 40) {
    const chunk = proposals.slice(i, i + 40);
    await Promise.all(
      chunk.map(async (p) => {
        const { data: row, error } = await sb
          .from('organisers')
          .select('outcode')
          .eq('id', p.organiser_id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        const cur = String((row && row.outcode) || '').trim();
        if (cur && !FORCE) return;
        const { error: upErr } = await sb
          .from('organisers')
          .update({ outcode: p.outcode })
          .eq('id', p.organiser_id);
        if (upErr) throw new Error(upErr.message);
        updated += 1;
      })
    );
    console.log('Applied', Math.min(i + chunk.length, proposals.length), '/', proposals.length);
  }

  const { count, error: cErr } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .not('outcode', 'is', null)
    .neq('outcode', '');
  if (cErr) throw new Error(cErr.message);
  console.log('Updated this run:', updated);
  console.log('Organisers with outcode now (all statuses):', count);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
