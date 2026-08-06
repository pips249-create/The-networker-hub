#!/usr/bin/env node
/**
 * Smoke: free tickets skip Stripe; paid tickets cannot claim as free.
 * Run: node scripts/smoke-test-free-ticket.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getSupabaseAdmin } = require('../api/_lib/supabase');
const { verifyEventCheckoutPayment } = require('../api/_lib/verify-checkout-payment');

function assert(label, cond, detail) {
  if (!cond) {
    console.error('FAIL', label, detail || '');
    process.exit(1);
  }
  console.log('  ✓', label);
}

async function main() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error('Supabase admin unavailable');
    process.exit(1);
  }

  console.log('1. Free ticket verify (no Stripe session)');
  const { data: freeTickets, error } = await sb
    .from('tickets')
    .select('id, event_id, price, name')
    .eq('price', 0)
    .limit(1);
  if (error) throw error;
  assert('at least one £0 ticket in DB', freeTickets && freeTickets.length > 0);

  const t = freeTickets[0];
  const session = { sub: 'smoke-free-ticket', email: 'pips249@gmail.com', name: 'Pip' };
  const free = await verifyEventCheckoutPayment(
    { eventId: t.event_id, ticketId: t.id, paymentStatus: 'free', amountPaid: 0 },
    session
  );
  assert('amountPaid is 0', free.amountPaid === 0);
  assert('paymentStatus Free', free.paymentStatus === 'Free');
  assert('no PaymentIntent', free.stripePaymentIntentId == null);
  assert('no Checkout session', free.stripeCheckoutSessionId == null);

  console.log('\n2. Paid ticket cannot claim as free');
  const { data: paidTickets, error: paidErr } = await sb
    .from('tickets')
    .select('id, event_id, price')
    .gt('price', 0)
    .limit(1);
  if (paidErr) throw paidErr;
  assert('at least one paid ticket in DB', paidTickets && paidTickets.length > 0);

  let blocked = false;
  try {
    await verifyEventCheckoutPayment(
      {
        eventId: paidTickets[0].event_id,
        ticketId: paidTickets[0].id,
        paymentStatus: 'free',
        amountPaid: 0,
      },
      session
    );
  } catch (e) {
    blocked = e.message === 'ticket_requires_payment';
    assert('throws ticket_requires_payment', blocked, e.message);
  }
  assert('paid free-claim blocked', blocked);

  console.log('\n✅ Free ticket smoke passed.');
  console.log('Optional UI: signed-in attendee → Get free ticket on a £0 event → registration + email.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
