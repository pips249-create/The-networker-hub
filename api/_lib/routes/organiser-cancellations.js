const { getOrganiserApi } = require('../organiser-provider');

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
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession, cancelLockedEvent, confirmRefundsIssued } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!cancelLockedEvent) {
    return json(res, 501, { error: 'cancellations_not_supported', message: 'Requires Supabase.' });
  }

  const body = parseBody(req);
  const eventId = String(body.eventId || body.id || '').trim();
  if (!eventId) return json(res, 400, { error: 'missing_event_id' });

  const action = String(body.action || 'cancel').toLowerCase();

  try {
    if (action === 'confirm_refunds') {
      const result = await confirmRefundsIssued(auth.session, eventId);
      return json(res, 200, {
        ok: true,
        cancellation: result.cancellation,
        message: 'Thank you — we have recorded that refunds have been issued.',
      });
    }

    const result = await cancelLockedEvent(auth.session, eventId, {
      reason: body.reason,
      details: body.details,
      refundTermsConfirmed: body.refundTermsConfirmed,
    });
    return json(res, 200, {
      ok: true,
      event: result.event,
      cancellation: result.cancellation,
      message: 'Event cancelled. Your payout is on hold until refunds are confirmed.',
    });
  } catch (e) {
    return json(res, e.status || 500, { error: 'cancellation_failed', message: e.message });
  }
};
