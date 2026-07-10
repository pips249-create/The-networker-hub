const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId, resolveAttendeeId } = require('./supabase-favourites');

function mapSearchRow(row) {
  return {
    id: row.id,
    label: String(row.label || '').trim(),
    criteria: row.criteria || {},
    createdAt: row.created_at,
    notifyEmail: row.notify_email !== false,
    lastNotifiedAt: row.last_notified_at || null,
  };
}

async function listOpportunitySavedSearches(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const res = await sb
    .from('opportunity_saved_searches')
    .select('id, label, criteria, created_at, notify_email, last_notified_at')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return (res.data || []).map(mapSearchRow);
}

async function createOpportunitySavedSearch(session, input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await ensureAttendeeId(sb, session);
  const criteria = input.criteria && typeof input.criteria === 'object' ? input.criteria : {};
  const label = String(input.label || '').trim() || null;

  const ins = await sb
    .from('opportunity_saved_searches')
    .insert({
      attendee_id: attendeeId,
      label,
      criteria,
      notify_email: input.notifyEmail !== false,
    })
    .select('id, label, criteria, created_at, notify_email, last_notified_at')
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return mapSearchRow(ins.data);
}

async function deleteOpportunitySavedSearch(session, searchId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return { action: 'removed' };

  const sid = String(searchId || '').trim();
  const del = await sb
    .from('opportunity_saved_searches')
    .delete()
    .eq('id', sid)
    .eq('attendee_id', attendeeId);
  if (del.error) throw new Error(del.error.message);
  return { action: 'removed', id: sid };
}

module.exports = {
  listOpportunitySavedSearches,
  createOpportunitySavedSearch,
  deleteOpportunitySavedSearch,
};
