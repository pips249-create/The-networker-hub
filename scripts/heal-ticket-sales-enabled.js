#!/usr/bin/env node
/**
 * One-off: enable ticket sales for published events that already have ticket types.
 * Run after migration 073 if browse still shows "Tickets soon" on live listings.
 *
 *   node scripts/heal-ticket-sales-enabled.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const { data: events, error } = await sb
    .from('events')
    .select('id, title, ticket_sales_enabled, status, approval_status')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .eq('ticket_sales_enabled', false);

  if (error) throw new Error(error.message);

  let healed = 0;
  for (const ev of events || []) {
    const { count, error: ticketErr } = await sb
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', ev.id);
    if (ticketErr) throw new Error(ticketErr.message);
    if (!count) continue;

    const { error: updateErr } = await sb
      .from('events')
      .update({ ticket_sales_enabled: true })
      .eq('id', ev.id);
    if (updateErr) throw new Error(updateErr.message);
    healed += 1;
    console.log('Enabled sales:', ev.title || ev.id);
  }

  console.log(`Done. Updated ${healed} event(s).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
