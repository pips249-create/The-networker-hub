const { resolveOrganiserGroupScope } = require('./organiser-api-scope');

async function resolveOrganiserAccountId(sb, session, adminView) {
  const scope = await resolveOrganiserGroupScope(session, adminView);
  const accountId = String(scope.organiserAccountId || '').trim();
  if (accountId) return accountId;
  const userId = String(session.sub || '').trim();
  if (!userId) return null;
  const { data, error } = await sb
    .from('organiser_accounts')
    .select('id')
    .eq('supabase_user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

module.exports = { resolveOrganiserAccountId };
