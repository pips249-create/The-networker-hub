const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId, resolveAttendeeId } = require('./supabase-favourites');

function mapFavouriteRow(row) {
  const opp = row.business_opportunities;
  if (!opp || !opp.id) {
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      createdAt: row.created_at,
      notifyEmail: row.notify_email !== false,
      title: 'Listing no longer available',
      slug: '',
      host: '',
      logoUrl: '',
      imageUrl: '',
      listingExpiresAt: null,
      type: '',
      listingStatus: 'unavailable',
    };
  }
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    createdAt: row.created_at,
    notifyEmail: row.notify_email !== false,
    title: String(opp.title || 'Opportunity').trim(),
    slug: String(opp.slug || '').trim(),
    host: String(opp.host || '').trim(),
    logoUrl: String(opp.logo_url || '').trim(),
    imageUrl: String(opp.image_url || '').trim(),
    listingExpiresAt: opp.listing_expires_at || null,
    type: opp.type || '',
    listingStatus: String(opp.status || '').trim().toLowerCase() || 'unknown',
  };
}

async function listOpportunityFavouriteIds(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const res = await sb
    .from('opportunity_favourites')
    .select('opportunity_id')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).map((row) => row.opportunity_id);
}

async function listOpportunityFavourites(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const res = await sb
    .from('opportunity_favourites')
    .select(
      'id, created_at, opportunity_id, notify_email, business_opportunities(id, title, slug, host, type, logo_url, image_url, listing_expires_at, status)'
    )
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);

  return (res.data || []).map(mapFavouriteRow);
}

async function addOpportunityFavourite(session, opportunityId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const oid = String(opportunityId || '').trim();
  if (!oid) throw new Error('missing_opportunity_id');

  const existing = await sb
    .from('opportunity_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('opportunity_id', oid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) return { action: 'exists', opportunityId: oid };

  const ins = await sb
    .from('opportunity_favourites')
    .insert({ attendee_id: attendeeId, opportunity_id: oid, notify_email: true })
    .select('id')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return { action: 'added', opportunityId: oid, id: ins.data.id };
}

async function removeOpportunityFavourite(session, opportunityId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return { action: 'removed', opportunityId: String(opportunityId) };

  const oid = String(opportunityId || '').trim();
  const del = await sb
    .from('opportunity_favourites')
    .delete()
    .eq('attendee_id', attendeeId)
    .eq('opportunity_id', oid);
  if (del.error) throw new Error(del.error.message);
  return { action: 'removed', opportunityId: oid };
}

async function toggleOpportunityFavourite(session, opportunityId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const oid = String(opportunityId || '').trim();
  if (!oid) throw new Error('missing_opportunity_id');

  const existing = await sb
    .from('opportunity_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('opportunity_id', oid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    await removeOpportunityFavourite(session, oid);
    return { action: 'removed', opportunityId: oid, saved: false };
  }
  await addOpportunityFavourite(session, oid);
  return { action: 'added', opportunityId: oid, saved: true };
}

async function countSavesForOpportunityIds(opportunityIds) {
  if (!isSupabaseConfigured()) return {};
  const ids = [...new Set((opportunityIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return {};

  const sb = getSupabaseAdmin();
  const res = await sb.from('opportunity_favourites').select('opportunity_id').in('opportunity_id', ids);
  if (res.error) throw new Error(res.error.message);

  const counts = Object.create(null);
  for (const row of res.data || []) {
    const id = String(row.opportunity_id);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

module.exports = {
  listOpportunityFavourites,
  listOpportunityFavouriteIds,
  addOpportunityFavourite,
  removeOpportunityFavourite,
  toggleOpportunityFavourite,
  countSavesForOpportunityIds,
};
