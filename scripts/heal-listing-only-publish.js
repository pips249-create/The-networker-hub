#!/usr/bin/env node
/**
 * One-off: approve published listing-only events stuck in Pending Review and assign slugs.
 *
 *   node scripts/heal-listing-only-publish.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const { ensureEventSlug } = require('../api/_lib/event-slug');

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local.env');
    process.exit(1);
  }

  const sb = getSupabaseAdmin();
  const { data: events, error } = await sb
    .from('events')
    .select('id, title, slug, status, approval_status, starts_at, published_at')
    .eq('status', 'published')
    .eq('approval_status', 'Pending Review')
    .not('starts_at', 'is', null);

  if (error) throw new Error(error.message);

  let healed = 0;
  for (const ev of events || []) {
    const { count, error: ticketErr } = await sb
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', ev.id);
    if (ticketErr) throw new Error(ticketErr.message);
    if (count) continue;

    const slug = await ensureEventSlug(sb, {
      title: ev.title,
      eventId: ev.id,
      currentSlug: ev.slug,
    });

    const patch = {
      approval_status: 'Approved',
      published_at: ev.published_at || new Date().toISOString(),
    };
    if (slug && slug !== ev.slug) patch.slug = slug;

    const { error: updateErr } = await sb.from('events').update(patch).eq('id', ev.id);
    if (updateErr) throw new Error(updateErr.message);

    healed += 1;
    console.log('Approved listing-only event:', ev.title || ev.id, slug ? `→ /events/${slug}` : '');
  }

  console.log(`Done. Healed ${healed} event(s).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
