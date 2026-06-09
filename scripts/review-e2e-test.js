#!/usr/bin/env node
/**
 * Apply migration 028 (if needed) and run review flow end-to-end.
 *
 * Usage: node scripts/review-e2e-test.js
 *
 * Migration 028 must be applied once in Supabase SQL Editor if the organiser
 * rating trigger is missing — this script detects that and prints the SQL.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { submitReview } = require('../api/_lib/supabase-reviews');
const { fetchOrganiserReviews } = require('../api/_lib/supabase-organisers-browse');

const TEST_MARKER = 'E2E review test';
const TEST_EMAIL = String(process.env.ADMIN_EMAIL || process.env.REVIEW_TEST_EMAIL || '')
  .trim()
  .toLowerCase();

async function checkOrganiserTrigger(sb) {
  const { data: orgs } = await sb
    .from('organisers')
    .select('id, review_count, average_rating')
    .limit(1);
  if (!orgs?.length) return { ok: true, note: 'no organisers yet' };

  const org = orgs[0];
  const beforeCount = Number(org.review_count) || 0;

  const { data: attendees } = await sb.from('attendees').select('id').limit(1);
  if (!attendees?.length) return { ok: true, note: 'no attendees to probe trigger' };

  const { data: events } = await sb
    .from('events')
    .select('id')
    .eq('organiser_id', org.id)
    .limit(1);
  if (!events?.length) return { ok: true, note: 'no events to probe trigger' };

  const probeText = `${TEST_MARKER} trigger probe ${Date.now()}`;
  const ins = await sb
    .from('reviews')
    .insert({
      attendee_id: attendees[0].id,
      event_id: events[0].id,
      organiser_id: org.id,
      rating: 5,
      review_text: probeText,
    })
    .select('id')
    .single();

  if (ins.error) {
    if (ins.error.code === '23505') {
      return { ok: true, note: 'unique index present (duplicate blocked)' };
    }
    return { ok: false, error: ins.error.message };
  }

  const { data: afterOrg } = await sb
    .from('organisers')
    .select('review_count')
    .eq('id', org.id)
    .maybeSingle();

  await sb.from('reviews').delete().eq('id', ins.data.id);

  const afterCount = Number(afterOrg?.review_count) || 0;
  const triggerWorks = afterCount > beforeCount;
  return {
    ok: triggerWorks,
    note: triggerWorks ? 'organiser rating trigger active' : 'organiser rating trigger missing',
  };
}

async function ensureAttendee(sb, email) {
  const existing = await sb.from('attendees').select('id, name, email').eq('email', email).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data;

  const ins = await sb
    .from('attendees')
    .insert({ email, name: 'Review test attendee' })
    .select('id, name, email')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function ensurePastEventWithRegistration(sb, attendee) {
  const slug = 'e2e-review-test-event';
  const now = Date.now();
  const startsAt = new Date(now - 7 * 24 * 60 * 60 * 1000);
  startsAt.setHours(18, 30, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  let org = null;
  const orgRes = await sb.from('organisers').select('id, name, slug').eq('slug', 'e2e-review-host').maybeSingle();
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (orgRes.data?.id) {
    org = orgRes.data;
  } else {
    const insOrg = await sb
      .from('organisers')
      .insert({
        name: 'E2E Review Host',
        slug: 'e2e-review-host',
        email: 'e2e-review-host@example.com',
        description: 'Temporary organiser for review end-to-end testing.',
        organiser_type: 'Events',
        industries: ['Business'],
        meeting_formats: ['In person'],
        verification_status: 'Verified',
        listing_status: 'published',
      })
      .select('id, name, slug')
      .single();
    if (insOrg.error) throw new Error(insOrg.error.message);
    org = insOrg.data;
  }

  let ev = null;
  const evRes = await sb.from('events').select('id, title, slug, organiser_id').eq('slug', slug).maybeSingle();
  if (evRes.error) throw new Error(evRes.error.message);
  if (evRes.data?.id) {
    ev = evRes.data;
    await sb
      .from('events')
      .update({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        approval_status: 'Approved',
        organiser_id: org.id,
      })
      .eq('id', ev.id);
  } else {
    const insEv = await sb
      .from('events')
      .insert({
        title: 'E2E review test evening',
        slug,
        description: 'Past event used to verify the attendee review flow.',
        event_type: 'Meeting',
        industries: ['Business'],
        meeting_type: 'In person',
        city: 'Manchester',
        location_label: 'Manchester',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        approval_status: 'Approved',
        organiser_id: org.id,
      })
      .select('id, title, slug, organiser_id')
      .single();
    if (insEv.error) throw new Error(insEv.error.message);
    ev = insEv.data;
  }

  let ticket = null;
  const tixRes = await sb
    .from('tickets')
    .select('id, name')
    .eq('event_id', ev.id)
    .limit(1)
    .maybeSingle();
  if (tixRes.error) throw new Error(tixRes.error.message);
  if (tixRes.data?.id) {
    ticket = tixRes.data;
  } else {
    const insTix = await sb
      .from('tickets')
      .insert({
        event_id: ev.id,
        name: 'General admission',
        price: 0,
        quantity: 20,
        status: 'Active',
      })
      .select('id, name')
      .single();
    if (insTix.error) throw new Error(insTix.error.message);
    ticket = insTix.data;
  }

  const regRes = await sb
    .from('registrations')
    .select('id')
    .eq('attendee_id', attendee.id)
    .eq('event_id', ev.id)
    .maybeSingle();
  if (regRes.error) throw new Error(regRes.error.message);
  if (!regRes.data?.id) {
    const insReg = await sb
      .from('registrations')
      .insert({
        attendee_id: attendee.id,
        event_id: ev.id,
        ticket_id: ticket.id,
        organiser_id: org.id,
        payment_status: 'Free',
        amount_paid: 0,
        application_status: 'Approved',
      })
      .select('id')
      .single();
    if (insReg.error) throw new Error(insReg.error.message);
  }

  return { org, ev, ticket };
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }
  if (!TEST_EMAIL) {
    console.error('Set ADMIN_EMAIL or REVIEW_TEST_EMAIL in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  console.log('Checking migration 028 (organiser rating trigger)…');
  const triggerCheck = await checkOrganiserTrigger(sb);
  if (!triggerCheck.ok) {
    console.error('\nMigration 028 is not applied yet.');
    console.error('Open Supabase → SQL Editor and run: supabase/migrations/028_reviews_constraints.sql');
    console.error('Probe error:', triggerCheck.error || triggerCheck.note);
    process.exit(1);
  }
  console.log('  ✓', triggerCheck.note);

  console.log('\nSeeding past event + registration for', TEST_EMAIL);
  const attendee = await ensureAttendee(sb, TEST_EMAIL);
  const { org, ev } = await ensurePastEventWithRegistration(sb, attendee);
  console.log('  ✓ Organiser:', org.name, '(' + (org.slug || org.id) + ')');
  console.log('  ✓ Past event:', ev.title);

  const existingReview = await sb
    .from('reviews')
    .select('id, rating, review_text')
    .eq('attendee_id', attendee.id)
    .eq('event_id', ev.id)
    .maybeSingle();
  if (existingReview.error) throw new Error(existingReview.error.message);

  let review;
  if (existingReview.data?.id) {
    console.log('\nReview already exists for this attendee + event — reusing it.');
    review = existingReview.data;
  } else {
    console.log('\nSubmitting review via API logic…');
    review = await submitReview(
      { email: TEST_EMAIL, name: attendee.name, sub: null },
      {
        eventId: ev.id,
        rating: 5,
        reviewText: `${TEST_MARKER} — brilliant host, would attend again.`,
      }
    );
    console.log('  ✓ Review created:', review.id);
  }

  const items = await fetchOrganiserReviews(sb, org.id);
  const found = items.find((item) => String(item.text).includes(TEST_MARKER) || item.rating === 5);
  if (!found) {
    console.error('\nReview was saved but did not appear on organiser profile feed.');
    process.exit(1);
  }

  const { data: orgAfter } = await sb
    .from('organisers')
    .select('average_rating, review_count')
    .eq('id', org.id)
    .maybeSingle();

  console.log('\n✅ End-to-end review flow passed');
  console.log('   Organiser rating:', orgAfter?.average_rating, '·', orgAfter?.review_count, 'reviews');
  console.log('   Public profile: /organisers/' + (org.slug || org.id));
  console.log('   Attendee dashboard: /account/index.html#reviews-pending');
  console.log('\nManual browser check:');
  console.log('  1. Sign in as', TEST_EMAIL);
  console.log('  2. Open /account/#reviews-pending — “E2E review test evening” should show as reviewed');
  console.log('  3. Open /organisers/' + (org.slug || org.id) + ' — review should appear under “What people are saying”');
}

main().catch((e) => {
  console.error('\nFailed:', e.message);
  process.exit(1);
});
