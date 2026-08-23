#!/usr/bin/env node
/**
 * Seed demo reviews for BMUK, Pip's Test, and The Networker UK,
 * then run a ranking snapshot so badges appear on browse cards and profiles.
 *
 * Usage: node scripts/seed-ranking-demo-reviews.js
 *        node scripts/seed-ranking-demo-reviews.js --emails  (send congratulation emails)
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { runMonthlyOrganiserRankingSnapshot } = require('../api/_lib/organiser-ranking-snapshot');

const GROUP_MATCHERS = [
  { label: 'BMUK', test: (name) => /bmuk|business matching uk/i.test(name) },
  { label: "Pip's Test", test: (name) => /pip'?s?\s*test/i.test(name) },
  { label: 'The Networker UK', test: (name) => /networker hub/i.test(name) },
];

const REVIEW_TEXTS = [
  'Brilliantly run — welcoming hosts and genuinely useful connections.',
  'Professional setup and a great mix of people. Would book again.',
  'Clear communication and well-paced session. Worth the time.',
  'Friendly group with real business value every visit.',
  'One of the best networking groups I have attended this year.',
];

const REVIEW_RATINGS = [5, 5, 4, 5, 4];

async function ensureAttendee(sb, email, name) {
  const existing = await sb.from('attendees').select('id, email, name').eq('email', email).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data;

  const ins = await sb
    .from('attendees')
    .insert({ email, name })
    .select('id, email, name')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function ensurePastEvent(sb, organiser) {
  const slug = `ranking-demo-${String(organiser.id).slice(0, 8)}`;
  const existing = await sb
    .from('events')
    .select('id, slug, title')
    .eq('slug', slug)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data;

  const startsAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  startsAt.setHours(18, 30, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const ins = await sb
    .from('events')
    .insert({
      title: `${organiser.name} — demo past event`,
      slug,
      description: 'Past event used for ranking demo reviews.',
      event_type: 'Meeting',
      industries: ['Business'],
      meeting_type: 'In person',
      city: 'Manchester',
      location_label: 'Manchester',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      approval_status: 'Approved',
      status: 'published',
      organiser_id: organiser.id,
      ticket_sales_enabled: true,
    })
    .select('id, slug, title')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function seedReviewsForOrganiser(sb, organiser) {
  await sb
    .from('organisers')
    .update({ listing_status: 'published' })
    .eq('id', organiser.id);

  const event = await ensurePastEvent(sb, organiser);
  let added = 0;

  for (let i = 0; i < REVIEW_TEXTS.length; i++) {
    const email = `ranking-demo-${String(organiser.id).slice(0, 8)}-${i + 1}@demo.hub.local`;
    const attendee = await ensureAttendee(sb, email, `Demo reviewer ${i + 1}`);

    const existing = await sb
      .from('reviews')
      .select('id')
      .eq('attendee_id', attendee.id)
      .eq('event_id', event.id)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.id) continue;

    const ins = await sb.from('reviews').insert({
      attendee_id: attendee.id,
      event_id: event.id,
      organiser_id: organiser.id,
      rating: REVIEW_RATINGS[i] || 5,
      review_text: `[Ranking demo] ${REVIEW_TEXTS[i]}`,
    });
    if (ins.error) throw new Error(ins.error.message);
    added++;
  }

  const { data: after } = await sb
    .from('organisers')
    .select('name, review_count, average_rating')
    .eq('id', organiser.id)
    .maybeSingle();

  return { added, after };
}

async function findTargetGroups(sb) {
  const { data, error } = await sb.from('organisers').select('id, name, email, contact_email, listing_status');
  if (error) throw new Error(error.message);

  const found = [];
  for (const matcher of GROUP_MATCHERS) {
    const row =
      (data || []).find((org) => matcher.test(String(org.name || '').trim())) || null;
    if (row) found.push({ matcher, organiser: row });
    else console.warn(`⚠ Could not find group matching: ${matcher.label}`);
  }
  return found;
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Add credentials to local.env and run npm run sync-env');
    process.exit(1);
  }

  const sendEmails = process.argv.includes('--emails');
  const sb = getSupabaseAdmin();
  const targets = await findTargetGroups(sb);

  if (!targets.length) {
    console.error('No target groups found. Check organiser names in Supabase.');
    process.exit(1);
  }

  console.log(`Seeding reviews for ${targets.length} group(s)…\n`);

  for (const { matcher, organiser } of targets) {
    console.log(`→ ${organiser.name} (${matcher.label})`);
    const result = await seedReviewsForOrganiser(sb, organiser);
    console.log(
      `  Added ${result.added} review(s). Totals: ${result.after?.review_count || 0} reviews, ★ ${Number(result.after?.average_rating || 0).toFixed(1)}`
    );
  }

  console.log('\nRunning ranking snapshot…');
  const snapshot = await runMonthlyOrganiserRankingSnapshot({
    triggeredBy: 'seed',
    sendEmails,
  });

  console.log(
    `Snapshot ${snapshot.periodLabel}: ${snapshot.badgeCount} badges, ${snapshot.emailsSent} emails sent`
  );

  if (snapshot.entries || snapshot.badgeCount) {
    console.log('\nBadges are now live on browse cards, event cards, and public profiles.');
    console.log('Command Centre → Rankings to review or re-run the snapshot.');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
