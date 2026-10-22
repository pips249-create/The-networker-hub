/**
 * Resolve / ensure attendee rows for a session.
 * Kept free of favourites/email/browse imports so claim and ranking modules
 * can require it without circular dependency through supabase-favourites.
 */

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
  const email = String(session.email).trim().toLowerCase();
  const name = session.name ? String(session.name).trim() : null;
  let id = await resolveAttendeeId(sb, session);

  if (id) {
    const patch = {};
    if (name) patch.name = name;
    if (session.sub) patch.supabase_user_id = session.sub;
    if (Object.keys(patch).length) {
      await sb.from('attendees').update(patch).eq('id', id);
    }
    return id;
  }

  const insert = await sb
    .from('attendees')
    .insert({
      email,
      supabase_user_id: session.sub || null,
      name: name || null,
    })
    .select('id')
    .single();
  if (insert.error) throw new Error(insert.error.message);
  return insert.data.id;
}

module.exports = {
  resolveAttendeeId,
  ensureAttendeeId,
};
