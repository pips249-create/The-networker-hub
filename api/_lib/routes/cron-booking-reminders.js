const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { sendDueBookingReminders } = require('../booking-reminder-emails');
const { sendDueOrganiserPostEventChecklistEmails } = require('../organiser-post-event-checklist-emails');
const { authorizeCron } = require('../cron-auth');

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
    const reminders = await sendDueBookingReminders(sb);
    const postEventChecklist = await sendDueOrganiserPostEventChecklistEmails(sb);
    return json(res, 200, { ok: true, ...reminders, postEventChecklist });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'booking_reminders_failed',
      message: e.message || String(e),
    });
  }
};
