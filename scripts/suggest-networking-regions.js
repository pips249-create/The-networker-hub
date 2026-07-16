#!/usr/bin/env node
/**
 * Suggest new /networking/:city pages from live event outcodes and organiser cities.
 *
 * Usage:
 *   node scripts/suggest-networking-regions.js
 *   node scripts/suggest-networking-regions.js --min-events=5
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { NETWORKING_REGIONS } = require('../api/_lib/networking-regions');
const { cityRegionFromInput, REGION_SECTORS } = require('../api/_lib/uk-outcode');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

const MIN_EVENTS = Math.max(parseInt(String(process.argv.find((a) => a.startsWith('--min-events=')) || '').split('=')[1], 10) || 5, 1);

/** City slug candidates inferred from organiser names in the import CSV. */
function slugFromOrganiserName(name) {
  const text = String(name || '').toLowerCase();
  const keys = Object.keys(REGION_SECTORS).sort((a, b) => b.length - a.length);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const label = key.replace(/-/g, ' ');
    if (text.includes(label) || text.includes(key)) return key;
  }
  const hints = [
    ['belfast', 'belfast'],
    ['reading', 'reading'],
    ['leicester', 'leicester'],
    ['bournemouth', 'bournemouth'],
    ['southampton', 'southampton'],
    ['portsmouth', 'portsmouth'],
    ['norwich', 'norwich'],
    ['plymouth', 'plymouth'],
    ['swansea', 'swansea'],
    ['derby', 'derby'],
    ['bath', 'bath'],
    ['york', 'york'],
    ['hull', 'hull'],
    ['aberdeen', 'aberdeen'],
    ['dundee', 'dundee'],
    ['maidstone', 'maidstone'],
    ['cheltenham', 'cheltenham'],
    ['colchester', 'colchester'],
    ['ipswich', 'ipswich'],
    ['exeter', 'exeter'],
    ['durham', 'durham'],
    ['huddersfield', 'huddersfield'],
    ['bradford', 'bradford'],
  ];
  for (let i = 0; i < hints.length; i++) {
    if (text.includes(hints[i][0])) return hints[i][1];
  }
  return null;
}

async function main() {
  const existing = new Set(Object.keys(NETWORKING_REGIONS));
  const counts = new Map();

  function bump(slug, source) {
    if (!slug || existing.has(slug)) return;
    const row = counts.get(slug) || { events: 0, organisers: 0, sources: new Set() };
    if (source === 'event') row.events += 1;
    if (source === 'organiser') row.organisers += 1;
    row.sources.add(source);
    counts.set(slug, row);
  }

  if (isSupabaseConfigured()) {
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: events, error: evErr } = await sb
      .from('published_events')
      .select('outcode, city, location_label, postcode')
      .gt('starts_at', now);
    if (evErr) throw new Error(evErr.message);
    (events || []).forEach((row) => {
      const slug =
        cityRegionFromInput(row.city) ||
        cityRegionFromInput(row.location_label) ||
        cityRegionFromInput(row.postcode) ||
        cityRegionFromInput(row.outcode);
      bump(slug, 'event');
    });

    const { data: organisers, error: orgErr } = await sb.from('organisers').select('name');
    if (orgErr) throw new Error(orgErr.message);
    (organisers || []).forEach((row) => {
      const slug = slugFromOrganiserName(row.name);
      bump(slug, 'organiser');
    });
  }

  const csvPath = path.join(root, 'data/networking-groups-organisers.csv');
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).slice(1);
    lines.forEach((line) => {
      const cols = line.split(',');
      const name = (cols[1] || '').replace(/^"|"$/g, '').trim();
      const slug = slugFromOrganiserName(name);
      if (slug) bump(slug, 'organiser');
    });
  }

  const suggestions = [...counts.entries()]
    .map(([slug, row]) => ({
      slug,
      events: row.events,
      organisers: row.organisers,
      score: row.events + row.organisers,
    }))
    .filter((row) => row.events >= MIN_EVENTS || row.organisers >= 3)
    .sort((a, b) => b.score - a.score || b.events - a.events);

  console.log('Existing regions:', existing.size);
  console.log('Threshold: >=', MIN_EVENTS, 'events OR >= 3 organisers in import/DB\n');

  if (!suggestions.length) {
    console.log('No new city suggestions above threshold.');
    if (!isSupabaseConfigured()) {
      console.log('(Connect Supabase in local.env for live event counts.)');
    }
    return;
  }

  console.log('Suggested new /networking/:slug pages:\n');
  suggestions.forEach((row) => {
    console.log(
      ' -',
      row.slug,
      '—',
      row.events,
      'events,',
      row.organisers,
      'organiser signals'
    );
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
