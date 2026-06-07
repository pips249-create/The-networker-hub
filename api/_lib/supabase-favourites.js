const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

async function resolveAttendeeId(sb, session) {
  if (!session?.email) return null;
  const email = String(session.email).trim().toLowerCase();
  const userId = session.sub ? String(session.sub).trim() : '';

  if (userId) {
    const byUser = await sb
      .from('attendees')
      .select('id')
      .eq('supabase_user_id', userId)
      .maybeSingle();
    if (!byUser.error && byUser.data?.id) return byUser.data.id;
  }

  const byEmail = await sb.from('attendees').select('id').eq('email', email).maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data?.id || null;
}

async function ensureAttendeeId(sb, session) {
  let id = await resolveAttendeeId(sb, session);
  if (id) return id;

  const email = String(session.email).trim().toLowerCase();
  const insert = await sb
    .from('attendees')
    .insert({
      email,
      supabase_user_id: session.sub || null,
      name: session.name || null,
    })
    .select('id')
    .single();
  if (insert.error) throw new Error(insert.error.message);
  return insert.data.id;
}

function mapFavouriteRow(row) {
  const ev = row.events || {};
  return {
    id: row.id,
    eventId: row.event_id,
    createdAt: row.created_at,
    notifyEmail: row.notify_email !== false,
    title: ev.title || 'Event',
    slug: ev.slug || '',
    startsAt: ev.starts_at || null,
    city: ev.city || '',
    photoUrl: ev.photo_url || '',
  };
}

async function listFavourites(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const res = await sb
    .from('event_favourites')
    .select('id, created_at, event_id, notify_email, events(id, title, slug, starts_at, city, photo_url)')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).map(mapFavouriteRow);
}

async function addFavourite(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const eid = String(eventId || '').trim();
  if (!eid) throw new Error('missing_event_id');

  const existing = await sb
    .from('event_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    return { action: 'exists', eventId: eid };
  }

  const ins = await sb
    .from('event_favourites')
    .insert({ attendee_id: attendeeId, event_id: eid, notify_email: true })
    .select('id')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return { action: 'added', eventId: eid, id: ins.data.id };
}

async function removeFavourite(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return { action: 'removed', eventId: String(eventId) };

  const eid = String(eventId || '').trim();
  const del = await sb
    .from('event_favourites')
    .delete()
    .eq('attendee_id', attendeeId)
    .eq('event_id', eid);
  if (del.error) throw new Error(del.error.message);
  return { action: 'removed', eventId: eid };
}

async function toggleFavourite(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const eid = String(eventId || '').trim();
  if (!eid) throw new Error('missing_event_id');

  const existing = await sb
    .from('event_favourites')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    await removeFavourite(session, eid);
    return { action: 'removed', eventId: eid, saved: false };
  }
  await addFavourite(session, eid);
  return { action: 'added', eventId: eid, saved: true };
}

module.exports = {
  listFavourites,
  addFavourite,
  removeFavourite,
  toggleFavourite,
  resolveAttendeeId,
  ensureAttendeeId,
};
