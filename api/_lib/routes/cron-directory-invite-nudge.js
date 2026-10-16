const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { authorizeCron } = require('../cron-auth');
const { sendDueDirectoryNudges, sendDueDirectoryDay7, sendDueDirectoryDay21, sendDueDirectoryDay35 } = require('../organiser-directory-nudge');
const { sendDueClaimedNoEventNotes } = require('../organiser-claimed-no-event');

/**
 * Daily (08:20 UTC). Day 3, day 7, day 21, and day 35 after a directory invitation,
 * for groups that still have not claimed. Also one note three days after a claim
 * when that page still has no event. This continues that outreach, so it
 * stays on while the broader nurture crons are paused.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }
  if (!authorizeCron(req, res)) return;
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }
  try {
    const sb = getSupabaseAdmin();
    const day3 = await sendDueDirectoryNudges(sb);
    const day7 = await sendDueDirectoryDay7(sb);
    const day21 = await sendDueDirectoryDay21(sb);
    const day35 = await sendDueDirectoryDay35(sb);
    const claimedNoEvent = await sendDueClaimedNoEventNotes(sb);
    return json(res, 200, { ok: true, day3, day7, day21, day35, claimedNoEvent });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'directory_invite_nudge_failed',
      message: e.message || String(e),
    });
  }
};
