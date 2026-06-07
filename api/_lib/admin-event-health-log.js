/**
 * Shared admin event health completion log (Supabase).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

async function logEventHealthCompletion(entry, adminEmail) {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  const row = {
    event_id: entry.eventId || null,
    event_title: String(entry.title || 'Untitled').trim() || 'Untitled',
    event_slug: entry.slug ? String(entry.slug).trim() : null,
    fixed_issues: Array.isArray(entry.fixedIssues) ? entry.fixedIssues : [],
    admin_email: adminEmail ? String(adminEmail).trim() : null,
  };
  const res = await sb.from('admin_event_health_log').insert(row).select('id, created_at').single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function fetchRecentHealthCompletions(limit = 15) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const res = await sb
    .from('admin_event_health_log')
    .select('id, created_at, event_id, event_title, event_slug, fixed_issues, admin_email')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (res.error) {
    if (/admin_event_health_log|does not exist|schema cache/i.test(res.error.message)) return [];
    throw new Error(res.error.message);
  }
  return (res.data || []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    title: r.event_title,
    slug: r.event_slug || '',
    fixedIssues: r.fixed_issues || [],
    completedAt: r.created_at,
    adminEmail: r.admin_email || '',
  }));
}

module.exports = { logEventHealthCompletion, fetchRecentHealthCompletions };
