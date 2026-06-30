/**
 * Resolve the best email address to notify an organiser (group profile).
 */
function isValidEmail(raw) {
  const em = String(raw || '')
    .trim()
    .toLowerCase();
  return em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? em : '';
}

async function resolveOrganiserNotificationEmail(sb, organiserId, options = {}) {
  const id = String(organiserId || '').trim();
  if (!id) return { name: '', email: '' };

  const orgRes = await sb
    .from('organisers')
    .select('id, name, email, contact_email, organiser_account_id, supabase_user_id')
    .eq('id', id)
    .maybeSingle();
  if (orgRes.error) throw new Error(orgRes.error.message);
  const org = orgRes.data;
  if (!org) return { name: '', email: '' };

  const name = String(org.name || '').trim();
  const seen = new Set();
  const candidates = [];

  function add(raw) {
    const em = isValidEmail(raw);
    if (em && !seen.has(em)) {
      seen.add(em);
      candidates.push(em);
    }
  }

  add(org.contact_email);
  add(org.email);

  if (org.organiser_account_id) {
    const accRes = await sb
      .from('organiser_accounts')
      .select('email')
      .eq('id', org.organiser_account_id)
      .maybeSingle();
    if (accRes.error) throw new Error(accRes.error.message);
    add(accRes.data?.email);
  }

  if (org.supabase_user_id) {
    const accByUserRes = await sb
      .from('organiser_accounts')
      .select('email')
      .eq('supabase_user_id', org.supabase_user_id)
      .maybeSingle();
    if (accByUserRes.error) throw new Error(accByUserRes.error.message);
    add(accByUserRes.data?.email);
  }

  if (org.organiser_account_id) {
    const teamRes = await sb
      .from('organiser_team_members')
      .select('email')
      .eq('organiser_account_id', org.organiser_account_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(5);
    if (teamRes.error) throw new Error(teamRes.error.message);
    for (const row of teamRes.data || []) {
      add(row.email);
    }
  }

  add(options.fallbackEmail);

  return { name, email: candidates[0] || '' };
}

module.exports = {
  resolveOrganiserNotificationEmail,
  isValidEmail,
};
