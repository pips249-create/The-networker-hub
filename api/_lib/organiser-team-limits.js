/** Max editors (pending + active) per organiser account — owner not counted. */
const ORGANISER_TEAM_MAX = 100;

async function countTeamInviteSlots(sb, accountId) {
  const id = String(accountId || '').trim();
  if (!id) return 0;
  const { count, error } = await sb
    .from('organiser_team_members')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_account_id', id)
    .in('status', ['pending', 'active']);
  if (error) throw new Error(error.message);
  return Number(count) || 0;
}

function teamSlotsRemaining(used) {
  return Math.max(0, ORGANISER_TEAM_MAX - (Number(used) || 0));
}

module.exports = {
  ORGANISER_TEAM_MAX,
  countTeamInviteSlots,
  teamSlotsRemaining,
};
