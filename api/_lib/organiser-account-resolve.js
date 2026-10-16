const { resolveOrganiserGroupScope } = require('./organiser-api-scope');

async function resolveOrganiserAccountId(sb, session, adminView) {
  const scope = await resolveOrganiserGroupScope(session, adminView);
  // Workspace access.accountId is the login / team account the organiser UI uses.
  const fromAccess = String(scope.access?.accountId || scope.organiserAccountId || '').trim();
  if (fromAccess) return fromAccess;

  const userId = String(session.sub || '').trim();
  if (userId) {
    const { data, error } = await sb
      .from('organiser_accounts')
      .select('id')
      .eq('supabase_user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) return data.id;
  }

  const email = String(session.email || '')
    .trim()
    .toLowerCase();
  if (email) {
    const { data: byEmail, error: emailErr } = await sb
      .from('organiser_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (emailErr) throw new Error(emailErr.message);
    if (byEmail?.id) return byEmail.id;
  }

  return null;
}

module.exports = { resolveOrganiserAccountId };
