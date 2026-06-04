#!/usr/bin/env node
/**
 * Add one sample organiser + approved event so the browse page is not empty.
 * Usage: node scripts/seed-sample-event.js
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(path.join(root, '.env')) });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 14);
  startsAt.setHours(18, 30, 0, 0);

  const { data: existing } = await sb
    .from('events')
    .select('id, title')
    .eq('approval_status', 'Approved')
    .limit(1);

  if (existing && existing.length) {
    console.log('Approved events already exist:', existing[0].title);
    console.log('Open /events/index.html to see them.');
    return;
  }

  const { data: org, error: orgErr } = await sb
    .from('organisers')
    .insert({
      name: 'The Networker Hub',
      email: process.env.ADMIN_EMAIL || 'hello@networkerhub.example',
      description: 'Sample organiser profile for testing the events listing.',
      organiser_type: 'Events',
      industries: ['Business'],
      meeting_formats: ['In person', 'Online'],
      verification_status: 'Verified',
      listing_status: 'published',
      featured: true,
    })
    .select('id')
    .single();

  if (orgErr) throw new Error(orgErr.message);

  const { data: ev, error: evErr } = await sb
    .from('events')
    .insert({
      title: 'Welcome networking evening',
      description:
        'Sample listing — replace with your own event details in the organiser dashboard.',
      event_type: 'Networking meeting',
      industries: ['Business'],
      meeting_type: 'In person',
      venue: 'Sample Venue',
      city: 'Manchester',
      location_label: 'Manchester',
      postcode: 'M1 1AA',
      starts_at: startsAt.toISOString(),
      approval_status: 'Approved',
      featured: true,
      organiser_id: org.id,
    })
    .select('id, title')
    .single();

  if (evErr) throw new Error(evErr.message);

  const { error: tixErr } = await sb.from('tickets').insert({
    event_id: ev.id,
    name: 'General admission',
    description: 'Free entry — sample ticket',
    price: 0,
    quantity: 50,
    status: 'Active',
  });

  if (tixErr) throw new Error(tixErr.message);

  console.log('Sample event created:', ev.title);
  console.log('Organiser:', 'The Networker Hub');
  console.log('View: https://the-networker-hub.vercel.app/events/index.html');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
