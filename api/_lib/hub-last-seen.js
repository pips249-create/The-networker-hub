/**
 * Admin-only member activity: last seen while signed in (throttled server-side).
 */
const { getSupabaseAdmin, useSupabase } = require('./supabase');

const ONLINE_WINDOW_MINUTES = 15;

async function touchLastSeen(userId) {
  const uid = String(userId || '').trim();
  if (!uid || !useSupabase()) return;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('touch_hub_account_last_seen', { p_user_id: uid });
    if (error && !/touch_hub_account_last_seen|last_seen_at/i.test(String(error.message || ''))) {
      throw error;
    }
  } catch {
    /* non-fatal */
  }
}

function touchLastSeenFromSession(session) {
  if (!session || !session.sub || session.impersonator) return;
  void touchLastSeen(session.sub);
}

function isUserOnline(lastSeenAt, nowMs) {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  const now = nowMs != null ? nowMs : Date.now();
  return now - t < ONLINE_WINDOW_MINUTES * 60 * 1000;
}

async function countOnlineUsers(sb) {
  try {
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000).toISOString();
    const res = await sb
      .from('hub_accounts')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen_at', cutoff);
    if (res.error) {
      if (/last_seen_at/i.test(String(res.error.message || ''))) return 0;
      throw new Error(res.error.message);
    }
    return res.count || 0;
  } catch {
    return 0;
  }
}

module.exports = {
  ONLINE_WINDOW_MINUTES,
  touchLastSeen,
  touchLastSeenFromSession,
  isUserOnline,
  countOnlineUsers,
};
