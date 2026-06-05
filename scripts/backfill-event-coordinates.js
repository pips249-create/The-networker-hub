#!/usr/bin/env node
/**
 * Fill events.latitude / events.longitude from UK postcodes (postcodes.io).
 * Fixes browse page on older deployments that block render on client geocoding.
 *
 * Usage: node scripts/backfill-event-coordinates.js
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { geocodeUkPostcode } = require('../api/_lib/postcode-geocode');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('events')
    .select('id, title, postcode, latitude, longitude')
    .eq('approval_status', 'Approved')
    .is('latitude', null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const needs = (rows || []).filter((r) => String(r.postcode || '').trim());
  if (!needs.length) {
    console.log('No approved events missing coordinates.');
    return;
  }

  let updated = 0;
  for (const row of needs) {
    const geo = await geocodeUkPostcode(row.postcode);
    if (!geo || geo.latitude == null || geo.longitude == null) {
      console.warn('Skip (no geocode):', row.title, row.postcode);
      continue;
    }
    const { error: upErr } = await sb
      .from('events')
      .update({ latitude: geo.latitude, longitude: geo.longitude })
      .eq('id', row.id);
    if (upErr) {
      console.error('Update failed:', row.title, upErr.message);
      continue;
    }
    updated++;
    console.log('Updated:', row.title, '→', geo.latitude, geo.longitude);
  }

  console.log(`Done. ${updated}/${needs.length} event(s) updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
