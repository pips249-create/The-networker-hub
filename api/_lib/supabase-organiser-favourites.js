const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId, ensureAttendeeId } = require('./supabase-favourites');

function mapFavouriteRow(row) {
  const org = row.organisers || {};
  const industries = Array.isArray(org.industries) ? org.industries : [];
  return {
    id: row.id,
    organiserId: row.organiser_id,
    createdAt: row.created_at,
    name: org.name || 'Organiser',
    slug: org.slug || '',
    photoUrl: org.photo_url || '',
    industry: industries[0] || '',
    rating: org.average_rating != null ? Number(org.average_rating) : null,
  };
}

async function listOrganiserFavourites(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const res = await sb
    .from('organiser_favourites')
    .select(
      'id, created_at, organiser_id, organisers(id, name, slug, photo_url, industries, average_rating)'
    )
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).map(mapFavouriteRow);
}

async function addOrganiserFavourite(session, organiserId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const oid = String(organiserId || '').trim();
  if (!oid) throw new Error('missing_organiser_id');

  const existing = await sb
    .from('organiser_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('organiser_id', oid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    return { action: 'exists', organiserId: oid };
  }

  const ins = await sb
    .from('organiser_favourites')
    .insert({ attendee_id: attendeeId, organiser_id: oid })
    .select('id')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return { action: 'added', organiserId: oid, id: ins.data.id };
}

async function removeOrganiserFavourite(session, organiserId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return { action: 'removed', organiserId: String(organiserId) };

  const oid = String(organiserId || '').trim();
  const del = await sb
    .from('organiser_favourites')
    .delete()
    .eq('attendee_id', attendeeId)
    .eq('organiser_id', oid);
  if (del.error) throw new Error(del.error.message);
  return { action: 'removed', organiserId: oid };
}

async function toggleOrganiserFavourite(session, organiserId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const oid = String(organiserId || '').trim();
  if (!oid) throw new Error('missing_organiser_id');

  const existing = await sb
    .from('organiser_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('organiser_id', oid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    await removeOrganiserFavourite(session, oid);
    return { action: 'removed', organiserId: oid, saved: false };
  }
  await addOrganiserFavourite(session, oid);
  return { action: 'added', organiserId: oid, saved: true };
}

module.exports = {
  listOrganiserFavourites,
  addOrganiserFavourite,
  removeOrganiserFavourite,
  toggleOrganiserFavourite,
};
