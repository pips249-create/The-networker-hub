/**
 * Hubert Matchmaker — weekly search quota (members 3 / week; admins higher).
 * Soft-skips enforcement if migration 344 has not been applied yet.
 */
const { isAdminRole } = require('./auth');

const SEARCHES_PER_WEEK = 3;
const ADMIN_SEARCHES_PER_WEEK = 50;

function weekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function searchCapForSession(session) {
  return isAdminRole(session && session.role) ? ADMIN_SEARCHES_PER_WEEK : SEARCHES_PER_WEEK;
}

function isMissingSearchTableError(error) {
  const msg = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
  const code = String((error && error.code) || '');
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes("could not find the table 'public.hubert_matchmaker_searches'") ||
    (msg.includes('hubert_matchmaker_searches') && msg.includes('schema cache')) ||
    (msg.includes('relation') &&
      msg.includes('hubert_matchmaker_searches') &&
      msg.includes('does not exist'))
  );
}

async function countRecentSearches(sb, attendeeId) {
  if (!attendeeId) return { used: 0, enforced: false };
  const { count, error } = await sb
    .from('hubert_matchmaker_searches')
    .select('id', { count: 'exact', head: true })
    .eq('attendee_id', attendeeId)
    .gte('created_at', weekAgoIso());
  if (error) {
    if (isMissingSearchTableError(error)) {
      return { used: 0, enforced: false };
    }
    throw new Error(error.message);
  }
  return { used: Number(count || 0), enforced: true };
}

async function getSearchQuota(sb, session, attendeeId) {
  const cap = searchCapForSession(session);
  const { used, enforced } = await countRecentSearches(sb, attendeeId);
  return {
    used,
    remaining: Math.max(0, cap - used),
    cap,
    searchQuotaPerWeek: SEARCHES_PER_WEEK,
    enforced,
  };
}

async function recordSearch(sb, { attendeeId, userId, query, matchCount }) {
  if (!attendeeId) return { recorded: false };
  const { error } = await sb.from('hubert_matchmaker_searches').insert({
    attendee_id: attendeeId,
    user_id: userId || null,
    query: String(query || '').slice(0, 240),
    match_count: Math.max(0, Number(matchCount) || 0),
  });
  if (error) {
    if (isMissingSearchTableError(error)) {
      return { recorded: false, enforced: false };
    }
    throw new Error(error.message);
  }
  return { recorded: true, enforced: true };
}

/**
 * Enforce weekly search cap (when table exists), then record this run.
 * Returns updated quota snapshot for the API response.
 */
async function consumeSearchQuota(sb, session, attendeeId, { query, matchCount, userId }) {
  const before = await getSearchQuota(sb, session, attendeeId);
  if (before.enforced && before.used >= before.cap) {
    const err = new Error(
      'You’ve used this week’s searches (' + before.cap + '). Try again next week.'
    );
    err.code = 'search_quota_exceeded';
    err.status = 429;
    err.quota = before;
    throw err;
  }

  const recorded = await recordSearch(sb, {
    attendeeId,
    userId:
      userId ||
      String((session && (session.userId || session.sub || session.id)) || '').trim() ||
      null,
    query,
    matchCount,
  });

  if (!recorded.recorded) {
    return { ...before, recorded: false };
  }

  const used = before.used + 1;
  return {
    used,
    remaining: Math.max(0, before.cap - used),
    cap: before.cap,
    searchQuotaPerWeek: SEARCHES_PER_WEEK,
    enforced: true,
    recorded: true,
  };
}

module.exports = {
  SEARCHES_PER_WEEK,
  ADMIN_SEARCHES_PER_WEEK,
  searchCapForSession,
  isMissingSearchTableError,
  countRecentSearches,
  getSearchQuota,
  recordSearch,
  consumeSearchQuota,
  weekAgoIso,
};
