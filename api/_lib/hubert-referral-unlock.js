/**
 * Hubert Matchmaker referral unlock.
 * Invite 2 colleagues who join → weekly search cap rises from 3 to 10.
 * Credit only on account create (joined_at), never on email sent.
 */
const REFERRAL_JOINS_FOR_UNLOCK = 2;
const SEARCHES_PER_WEEK_BASE = 3;
const SEARCHES_PER_WEEK_UNLOCKED = 10;

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isMissingInviteTableError(error) {
  const msg = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
  const code = String((error && error.code) || '');
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes("could not find the table 'public.hubert_hub_invites'") ||
    (msg.includes('hubert_hub_invites') && msg.includes('schema cache')) ||
    (msg.includes('joined_at') && (msg.includes('column') || msg.includes('schema'))) ||
    (msg.includes('relation') && msg.includes('hubert_hub_invites') && msg.includes('does not exist'))
  );
}

/**
 * When someone registers, mark matching Hub invites as joined (distinct emails).
 */
async function attributeHubInviteJoin(sb, { email, attendeeId }) {
  const em = normalizeEmail(email);
  if (!em || !attendeeId) {
    return { ok: true, attributed: 0, skipped: true };
  }
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('hubert_hub_invites')
    .update({
      joined_at: now,
      joined_attendee_id: attendeeId,
    })
    .eq('status', 'sent')
    .is('joined_at', null)
    .ilike('invitee_email', em)
    .select('id, inviter_attendee_id, inviter_user_id');

  if (error) {
    if (isMissingInviteTableError(error)) {
      return { ok: true, attributed: 0, skipped: true, reason: 'invite_table_or_column_missing' };
    }
    throw new Error(error.message);
  }

  return {
    ok: true,
    attributed: Array.isArray(data) ? data.length : 0,
    invites: data || [],
  };
}

async function countJoinedReferrals(sb, { inviterAttendeeId, inviterUserId }) {
  if (!inviterAttendeeId && !inviterUserId) {
    return { joined: 0, enforced: false };
  }

  let q = sb
    .from('hubert_hub_invites')
    .select('invitee_email, joined_at')
    .eq('status', 'sent')
    .not('joined_at', 'is', null);

  if (inviterAttendeeId) {
    q = q.eq('inviter_attendee_id', inviterAttendeeId);
  } else {
    q = q.eq('inviter_user_id', inviterUserId);
  }

  const { data, error } = await q.limit(200);
  if (error) {
    if (isMissingInviteTableError(error)) {
      return { joined: 0, enforced: false };
    }
    throw new Error(error.message);
  }

  const seen = new Set();
  (data || []).forEach((row) => {
    const em = normalizeEmail(row && row.invitee_email);
    if (em) seen.add(em);
  });
  return { joined: seen.size, enforced: true };
}

async function getReferralUnlockStatus(sb, { inviterAttendeeId, inviterUserId }) {
  const { joined, enforced } = await countJoinedReferrals(sb, {
    inviterAttendeeId,
    inviterUserId,
  });
  const unlocked = enforced && joined >= REFERRAL_JOINS_FOR_UNLOCK;
  return {
    joined,
    needed: REFERRAL_JOINS_FOR_UNLOCK,
    remainingToUnlock: Math.max(0, REFERRAL_JOINS_FOR_UNLOCK - joined),
    unlocked,
    enforced,
    baseSearchCap: SEARCHES_PER_WEEK_BASE,
    unlockedSearchCap: SEARCHES_PER_WEEK_UNLOCKED,
    searchCap: unlocked ? SEARCHES_PER_WEEK_UNLOCKED : SEARCHES_PER_WEEK_BASE,
  };
}

module.exports = {
  REFERRAL_JOINS_FOR_UNLOCK,
  SEARCHES_PER_WEEK_BASE,
  SEARCHES_PER_WEEK_UNLOCKED,
  attributeHubInviteJoin,
  countJoinedReferrals,
  getReferralUnlockStatus,
  isMissingInviteTableError,
};
