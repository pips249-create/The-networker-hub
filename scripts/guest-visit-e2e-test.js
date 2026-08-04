#!/usr/bin/env node
/**
 * Guest visit programme end-to-end (booking rules via createRegistrationFromPayment).
 *
 * Pass criteria (PIPS-TODO Tab 5):
 *   complimentary visits enabled → guest pass books → paid member blocked while
 *   visits remain → after exhausted, guest blocked and paid member unlocks.
 *
 * Usage: node scripts/guest-visit-e2e-test.js
 * Cleanup: node scripts/guest-visit-e2e-test.js --cleanup
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { createRegistrationFromPayment } = require('../api/_lib/supabase-registrations');
const {
  getGuestVisitEligibility,
  GUEST_VISIT_TICKET_TYPE,
} = require('../api/_lib/guest-visits');

const ORG_SLUG = 'e2e-guest-visit-host';
const EVENT_A_SLUG = 'e2e-guest-visit-event-a';
const EVENT_B_SLUG = 'e2e-guest-visit-event-b';
const ATTENDEE_EMAIL = 'e2e-guest-visit-attendee@example.com';
const ALLOWED_VISITS = 1;

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
    name: 'E2E Guest Visit Host',
    slug: ORG_SLUG,
    email: 'e2e-guest-visit-host@example.com',
    description: 'Temporary organiser for guest visit programme E2E.',
    organiser_type: 'Events',
    industries: ['Business'],
    meeting_formats: ['In person'],
    verification_status: 'Verified',
    listing_status: 'published',
    complimentary_visits_allowed: ALLOWED_VISITS,
    complimentary_visits_scope: 'per_group',
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

async function upsertEvent(sb, orgId, slug, title, daysAhead) {
  const startsAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  startsAt.setHours(8, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const patch = {
    title,
    slug,
    description: 'Guest visit programme E2E fixture event.',
    event_type: 'Meeting',
    industries: ['Business'],
    meeting_type: 'In person',
    city: 'Manchester',
    location_label: 'Manchester',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    approval_status: 'Approved',
    organiser_id: orgId,
    attendance_mode: 'guest_programme',
    guest_passes_disabled: false,
  };

  const existing = await sb.from('events').select('id, title, slug').eq('slug', slug).maybeSingle();
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

async function upsertTicket(sb, eventId, { name, price, ticketType }) {
  const existing = await sb
    .from('tickets')
    .select('id, name, price, ticket_type')
    .eq('event_id', eventId)
    .eq('ticket_type', ticketType)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const patch = {
    event_id: eventId,
    name,
    price,
    quantity: 50,
    status: 'Active',
    ticket_type: ticketType,
  };

  if (existing.data?.id) {
    const upd = await sb.from('tickets').update(patch).eq('id', existing.data.id).select('id, name, price, ticket_type').single();
    if (upd.error) throw new Error(upd.error.message);
    return upd.data;
  }

  const ins = await sb.from('tickets').insert(patch).select('id, name, price, ticket_type').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function ensureAttendee(sb) {
  const existing = await sb.from('attendees').select('id, email, name').eq('email', ATTENDEE_EMAIL).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return existing.data;

  const ins = await sb
    .from('attendees')
    .insert({ email: ATTENDEE_EMAIL, name: 'E2E Guest Visit Attendee' })
    .select('id, email, name')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

async function clearAttendeeRegs(sb, attendeeId, eventIds) {
  const del = await sb.from('registrations').delete().eq('attendee_id', attendeeId).in('event_id', eventIds);
  if (del.error) throw new Error(del.error.message);
}

async function cleanup(sb) {
  console.log('Cleaning E2E guest-visit fixtures…');
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
  const doCleanup = process.argv.includes('--cleanup');

  if (doCleanup) {
    await cleanup(sb);
    return;
  }

  console.log('Guest visit programme E2E\n');

  console.log('1. Seed organiser + events + tickets');
  const org = await upsertOrganiser(sb);
  const eventA = await upsertEvent(sb, org.id, EVENT_A_SLUG, 'E2E guest visit breakfast A', 14);
  const eventB = await upsertEvent(sb, org.id, EVENT_B_SLUG, 'E2E guest visit breakfast B', 21);
  const guestA = await upsertTicket(sb, eventA.id, {
    name: 'Guest visit',
    price: 0,
    ticketType: GUEST_VISIT_TICKET_TYPE,
  });
  const paidA = await upsertTicket(sb, eventA.id, {
    name: 'Member ticket',
    price: 15,
    ticketType: 'Standard',
  });
  const guestB = await upsertTicket(sb, eventB.id, {
    name: 'Guest visit',
    price: 0,
    ticketType: GUEST_VISIT_TICKET_TYPE,
  });
  const paidB = await upsertTicket(sb, eventB.id, {
    name: 'Member ticket',
    price: 15,
    ticketType: 'Standard',
  });
  const attendee = await ensureAttendee(sb);
  await clearAttendeeRegs(sb, attendee.id, [eventA.id, eventB.id]);
  console.log('  ✓', org.name, '· allowance', ALLOWED_VISITS);
  console.log('  ✓ Events:', eventA.slug, '+', eventB.slug);
  console.log('  ✓ Attendee reset:', ATTENDEE_EMAIL);

  console.log('\n2. Eligibility before any booking');
  let eligibility = await getGuestVisitEligibility(sb, {
    organiserId: org.id,
    attendeeId: attendee.id,
    email: ATTENDEE_EMAIL,
  });
  assert('eligible with remaining visits', eligibility.eligible && eligibility.remaining === ALLOWED_VISITS);

  console.log('\n3. Paid member blocked while complimentary visits remain');
  await expectError(
    'paid member ticket blocked',
    () =>
      createRegistrationFromPayment({
        email: ATTENDEE_EMAIL,
        name: attendee.name,
        eventId: eventA.id,
        ticketId: paidA.id,
        amountPaid: 15,
        paymentStatus: 'Paid',
        quantity: 1,
      }),
    'guest_visits_remaining'
  );

  console.log('\n4. Guest visit books successfully');
  const guestReg = await createRegistrationFromPayment({
    email: ATTENDEE_EMAIL,
    name: attendee.name,
    eventId: eventA.id,
    ticketId: guestA.id,
    amountPaid: 0,
    paymentStatus: 'Free',
    quantity: 1,
  });
  assert('guest registration created', Boolean(guestReg?.id || guestReg?.registration?.id), JSON.stringify(guestReg));
  assert(
    'registration_kind is guest_visit',
    (guestReg.registration?.registration_kind || guestReg.registrationKind) === 'guest_visit' ||
      guestReg.action === 'created' ||
      guestReg.action === 'exists',
    guestReg.action
  );

  const regRow = await sb
    .from('registrations')
    .select('id, registration_kind, payment_status, amount_paid')
    .eq('attendee_id', attendee.id)
    .eq('event_id', eventA.id)
    .maybeSingle();
  if (regRow.error) throw new Error(regRow.error.message);
  assert('DB row registration_kind=guest_visit', regRow.data?.registration_kind === 'guest_visit');
  assert('DB row is free', regRow.data?.payment_status === 'Free' && Number(regRow.data?.amount_paid) === 0);

  eligibility = await getGuestVisitEligibility(sb, {
    organiserId: org.id,
    attendeeId: attendee.id,
    email: ATTENDEE_EMAIL,
  });
  assert('visits exhausted after 1 guest booking', !eligibility.eligible && eligibility.remaining === 0);

  console.log('\n5. Further guest visits blocked');
  await expectError(
    'second guest visit blocked',
    () =>
      createRegistrationFromPayment({
        email: ATTENDEE_EMAIL,
        name: attendee.name,
        eventId: eventB.id,
        ticketId: guestB.id,
        amountPaid: 0,
        paymentStatus: 'Free',
        quantity: 1,
      }),
    'guest_visits_exhausted'
  );

  console.log('\n6. Paid member ticket unlocks after visits used');
  const paidReg = await createRegistrationFromPayment({
    email: ATTENDEE_EMAIL,
    name: attendee.name,
    eventId: eventB.id,
    ticketId: paidB.id,
    amountPaid: 15,
    paymentStatus: 'Paid',
    quantity: 1,
  });
  assert('paid member registration created', Boolean(paidReg?.id || paidReg?.registration?.id));

  const paidRow = await sb
    .from('registrations')
    .select('id, registration_kind, payment_status, amount_paid')
    .eq('attendee_id', attendee.id)
    .eq('event_id', eventB.id)
    .maybeSingle();
  if (paidRow.error) throw new Error(paidRow.error.message);
  assert('paid row is standard/paid', paidRow.data?.payment_status === 'Paid' && Number(paidRow.data?.amount_paid) === 15);

  console.log('\n✅ Guest visit programme E2E passed');
  console.log('   Organiser: /organisers/' + ORG_SLUG);
  console.log('   Fixtures left in DB for manual UI check (optional).');
  console.log('   Cleanup: node scripts/guest-visit-e2e-test.js --cleanup');
}

main().catch((e) => {
  console.error('\nFailed:', e.message);
  process.exit(1);
});
