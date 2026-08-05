#!/usr/bin/env node
/**
 * Category Exclusivity end-to-end (apply → approve → pay via linked registration).
 *
 * Pass criteria (PIPS-TODO Tab 5):
 *   Direct checkout blocked → pending application blocked from paid completion →
 *   approved application can complete payment via linked registrationId.
 *
 * Usage: node scripts/category-exclusivity-e2e-test.js
 * Cleanup: node scripts/category-exclusivity-e2e-test.js --cleanup
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createRegistrationFromPayment } = require('../api/_lib/supabase-registrations');
const { requiresApprovedApplication } = require('../api/_lib/category-exclusivity');

const ORG_SLUG = 'e2e-category-exclusivity-host';
const EVENT_SLUG = 'e2e-category-exclusivity-event';
const ATTENDEE_EMAIL = 'e2e-category-exclusivity-attendee@example.com';

function assert(label, condition, detail) {
  if (!condition) {
    const extra = detail != null ? ` (${detail})` : '';
    throw new Error(`FAIL: ${label}${extra}`);
  }
  console.log('  ✓', label);
}

async function expectError(label, fn, expectedCode) {
  try {
    await fn();
    throw new Error(`FAIL: ${label} — expected error ${expectedCode}, got success`);
  } catch (e) {
    const code = String(e.message || e);
    if (code === `FAIL: ${label} — expected error ${expectedCode}, got success`) throw e;
    if (code !== expectedCode && !code.includes(expectedCode)) {
      throw new Error(`FAIL: ${label} — expected ${expectedCode}, got ${code}`);
    }
    console.log('  ✓', label, `(blocked: ${expectedCode})`);
  }
}

async function upsertOrganiser(sb) {
  const existing = await sb.from('organisers').select('id, name, slug').eq('slug', ORG_SLUG).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const patch = {
    name: 'E2E Category Exclusivity Host',
    slug: ORG_SLUG,
    email: 'e2e-category-exclusivity-host@example.com',
    description: 'Temporary organiser for Category Exclusivity E2E.',
    organiser_type: 'Events',
    industries: ['Business'],
    meeting_formats: ['In person'],
    verification_status: 'Verified',
    listing_status: 'published',
  };

  if (existing.data?.id) {
    const upd = await sb.from('organisers').update(patch).eq('id', existing.data.id).select('id, name, slug').single();
    if (upd.error) throw new Error(upd.error.message);
    return upd.data;
  }

  const ins = await sb.from('organisers').insert(patch).select('id, name, slug').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function upsertEvent(sb, orgId) {
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  startsAt.setHours(8, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const patch = {
    title: 'E2E Category Exclusivity Breakfast',
    slug: EVENT_SLUG,
    description: 'Category Exclusivity E2E fixture event.',
    event_type: 'Meeting',
    industries: ['Business'],
    meeting_type: 'In person',
    city: 'Leeds',
    location_label: 'Leeds',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    approval_status: 'Approved',
    status: 'published',
    organiser_id: orgId,
    attendance_mode: 'category_exclusivity',
    ticket_sales_enabled: true,
  };

  const existing = await sb.from('events').select('id, title, slug').eq('slug', EVENT_SLUG).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data?.id) {
    const upd = await sb.from('events').update(patch).eq('id', existing.data.id).select('id, title, slug').single();
    if (upd.error) throw new Error(upd.error.message);
    return upd.data;
  }

  const ins = await sb.from('events').insert(patch).select('id, title, slug').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function upsertTicket(sb, eventId) {
  const existing = await sb
    .from('tickets')
    .select('id, name, price, ticket_type')
    .eq('event_id', eventId)
    .eq('ticket_type', 'Application-based')
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const patch = {
    event_id: eventId,
    name: 'Category Exclusivity seat',
    price: 25,
    quantity: 20,
    status: 'Active',
    ticket_type: 'Application-based',
  };

  if (existing.data?.id) {
    const upd = await sb
      .from('tickets')
      .update(patch)
      .eq('id', existing.data.id)
      .select('id, name, price, ticket_type')
      .single();
    if (upd.error) throw new Error(upd.error.message);
    return upd.data;
  }

  const ins = await sb.from('tickets').insert(patch).select('id, name, price, ticket_type').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function ensureAttendee(sb) {
  const existing = await sb
    .from('attendees')
    .select('id, email, name')
    .eq('email', ATTENDEE_EMAIL)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data;

  const ins = await sb
    .from('attendees')
    .insert({ email: ATTENDEE_EMAIL, name: 'E2E Category Exclusivity Attendee' })
    .select('id, email, name')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function clearAttendeeRegs(sb, attendeeId, eventId) {
  const del = await sb.from('registrations').delete().eq('attendee_id', attendeeId).eq('event_id', eventId);
  if (del.error) throw new Error(del.error.message);
}

async function cleanup(sb) {
  console.log('Cleaning E2E Category Exclusivity fixtures…');
  const org = await sb.from('organisers').select('id').eq('slug', ORG_SLUG).maybeSingle();
  if (org.error) throw new Error(org.error.message);
  if (!org.data?.id) {
    console.log('  Nothing to clean.');
    return;
  }

  const events = await sb.from('events').select('id').eq('organiser_id', org.data.id);
  if (events.error) throw new Error(events.error.message);
  const eventIds = (events.data || []).map((e) => e.id);

  if (eventIds.length) {
    await sb.from('registrations').delete().in('event_id', eventIds);
    await sb.from('tickets').delete().in('event_id', eventIds);
    await sb.from('events').delete().in('id', eventIds);
  }
  await sb.from('organisers').delete().eq('id', org.data.id);

  const att = await sb.from('attendees').select('id').eq('email', ATTENDEE_EMAIL).maybeSingle();
  if (att.data?.id) {
    await sb.from('registrations').delete().eq('attendee_id', att.data.id);
    await sb.from('attendees').delete().eq('id', att.data.id);
  }
  console.log('  ✓ Cleaned');
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  if (process.argv.includes('--cleanup')) {
    await cleanup(sb);
    return;
  }

  console.log('Category Exclusivity E2E\n');

  assert(
    'helper detects CE event + application ticket',
    requiresApprovedApplication(
      { attendance_mode: 'category_exclusivity' },
      { ticket_type: 'Application-based' }
    )
  );

  const org = await upsertOrganiser(sb);
  const event = await upsertEvent(sb, org.id);
  const ticket = await upsertTicket(sb, event.id);
  const attendee = await ensureAttendee(sb);
  await clearAttendeeRegs(sb, attendee.id, event.id);

  console.log('\n1. Direct paid registration must be blocked');
  await expectError(
    'createRegistrationFromPayment without approved application',
    () =>
      createRegistrationFromPayment({
        eventId: event.id,
        ticketId: ticket.id,
        email: ATTENDEE_EMAIL,
        name: attendee.name,
        amountPaid: 25,
        paymentStatus: 'Paid',
        stripePaymentIntentId: 'pi_e2e_ce_bypass_' + Date.now(),
      }),
    'application_required'
  );

  console.log('\n2. Pending application cannot complete payment');
  const pendingIns = await sb
    .from('registrations')
    .insert({
      event_id: event.id,
      organiser_id: org.id,
      attendee_id: attendee.id,
      ticket_id: ticket.id,
      quantity: 1,
      amount_paid: 0,
      payment_status: 'Pending',
      application_status: 'Pending',
      registration_kind: 'application',
      screening_answer_industry: 'Accountancy',
      screening_answer_job_title: 'Director',
    })
    .select('id')
    .single();
  if (pendingIns.error) throw new Error(pendingIns.error.message);

  await expectError(
    'pending application linked payment blocked',
    () =>
      createRegistrationFromPayment({
        eventId: event.id,
        ticketId: ticket.id,
        email: ATTENDEE_EMAIL,
        name: attendee.name,
        registrationId: pendingIns.data.id,
        amountPaid: 25,
        paymentStatus: 'Paid',
        stripePaymentIntentId: 'pi_e2e_ce_pending_' + Date.now(),
      }),
    'registration_not_approved'
  );

  console.log('\n3. Approved application can complete payment');
  const approve = await sb
    .from('registrations')
    .update({ application_status: 'Approved', application_decided_at: new Date().toISOString() })
    .eq('id', pendingIns.data.id)
    .select('id, application_status')
    .single();
  if (approve.error) throw new Error(approve.error.message);
  assert('application marked Approved', approve.data.application_status === 'Approved');

  const paid = await createRegistrationFromPayment({
    eventId: event.id,
    ticketId: ticket.id,
    email: ATTENDEE_EMAIL,
    name: attendee.name,
    registrationId: pendingIns.data.id,
    amountPaid: 25,
    paymentStatus: 'Paid',
    stripePaymentIntentId: 'pi_e2e_ce_approved_' + Date.now(),
  });
  assert('approved application payment completes', paid.action === 'updated' || paid.action === 'exists', paid.action);
  assert('registration id preserved', paid.id === pendingIns.data.id);

  const finalReg = await sb
    .from('registrations')
    .select('payment_status, application_status, amount_paid')
    .eq('id', pendingIns.data.id)
    .single();
  if (finalReg.error) throw new Error(finalReg.error.message);
  assert('payment_status Paid', String(finalReg.data.payment_status) === 'Paid');
  assert('application_status still Approved', String(finalReg.data.application_status) === 'Approved');

  console.log('\n✅ Category Exclusivity E2E passed.');
  console.log('Cleanup with: node scripts/category-exclusivity-e2e-test.js --cleanup');
}

main().catch((e) => {
  console.error('\n' + (e.message || e));
  process.exit(1);
});
