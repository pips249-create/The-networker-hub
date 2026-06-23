const { sessionFromRequest, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { cancelRegistrationForAttendee } = require('../supabase-cancel-registration');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session?.email) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const body = parseBody(req);
  const registrationId = String(body.registrationId || body.registration_id || body.id || '').trim();
  if (!registrationId) return json(res, 400, { error: 'missing_registration_id' });

  try {
    const result = await cancelRegistrationForAttendee(session, registrationId);
    const isFree =
      String(result.paymentStatus || '').trim() === 'Free' ||
      !(Number(result.amountPaid) > 0);
    let message;
    if (isFree) {
      message = 'Your registration has been cancelled. Because this was a free ticket, no refund applies.';
    } else if (result.refundEligible) {
      message =
        'Your booking has been cancelled. If you are due a refund, the organiser will process it through their payment account — not The Networker Hub.';
    } else {
      message =
        'Your booking has been cancelled. Based on the organiser\'s refund policy, no refund is due.';
    }

    return json(res, 200, {
      ok: true,
      registrationId: result.registrationId,
      refundEligible: result.refundEligible,
      isFree,
      emailResult: result.emailResult,
      message,
    });
  } catch (e) {
    return json(res, e.status || 500, {
      error: 'cancel_failed',
      message: e.message || String(e),
    });
  }
};
