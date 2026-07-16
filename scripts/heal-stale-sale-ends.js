#!/usr/bin/env node
/**
 * Align ticket sale_ends_at with event starts_at when ends were saved before a time correction.
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  const { data: events, error } = await sb
    .from('events')
    .select('id,title,starts_at')
    .eq('status', 'published')
    .not('starts_at', 'is', null);
  if (error) throw error;

  let fixed = 0;
  for (const ev of events || []) {
    const { data: tickets, error: ticketErr } = await sb
      .from('tickets')
      .select('id,sale_ends_at')
      .eq('event_id', ev.id);
    if (ticketErr) throw ticketErr;
    const startMs = new Date(ev.starts_at).getTime();
    if (!Number.isFinite(startMs)) continue;

    for (const ticket of tickets || []) {
      if (!ticket.sale_ends_at) continue;
      const endMs = new Date(ticket.sale_ends_at).getTime();
      if (!Number.isFinite(endMs) || endMs >= startMs) continue;
      const { error: updateErr } = await sb
        .from('tickets')
        .update({ sale_ends_at: ev.starts_at })
        .eq('id', ticket.id);
      if (updateErr) throw updateErr;
      console.log('fixed', ev.title, ticket.id, '->', ev.starts_at);
      fixed += 1;
    }
  }
  console.log('done, fixed', fixed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
