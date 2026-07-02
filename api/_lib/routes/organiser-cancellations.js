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
  const {
    json,
    setCors,
    requireOrganiserSession,
    cancelLockedEvent,
    confirmRefundsIssued,
    getCancellationContext,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!cancelLockedEvent) {
    return json(res, 501, { error: 'cancellations_not_supported', message: 'Requires Supabase.' });
  }

  if (req.method === 'GET') {
    const eventId = String(req.query?.eventId || req.query?.id || '').trim();
    if (!eventId) return json(res, 400, { error: 'missing_event_id' });
    if (!getCancellationContext) {
      return json(res, 501, { error: 'cancellations_not_supported', message: 'Requires Supabase.' });
    }
    try {
      const context = await getCancellationContext(auth.session, eventId);
      return json(res, 200, { ok: true, ...context });
    } catch (e) {
      return json(res, e.status || 500, { error: 'cancellation_context_failed', message: e.message });
    }
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const eventId = String(body.eventId || body.id || '').trim();
  if (!eventId) return json(res, 400, { error: 'missing_event_id' });

  const action = String(body.action || 'cancel').toLowerCase();

  try {
    if (action === 'confirm_refunds') {
      const result = await confirmRefundsIssued(auth.session, eventId);
      if (result.alreadyConfirmed) {
        return json(res, 200, {
          ok: true,
          cancellation: result.cancellation,
          message: 'Refunds were already confirmed for this event.',
        });
      }
      const paidCount = result.verification?.totalPaid || 0;
      const emailSent = result.emailResult?.sent || 0;
      let message = 'Refunds verified in Stripe. Payout hold cleared.';
      if (paidCount > 0) {
        message +=
          emailSent > 0
            ? ` ${emailSent} refund confirmation email${emailSent === 1 ? '' : 's'} sent.`
            : ' Refund confirmation emails will be sent as Stripe processes each refund.';
      }
      return json(res, 200, {
        ok: true,
        cancellation: result.cancellation,
        verification: result.verification,
        emailResult: result.emailResult,
        message,
      });
    }

    const result = await cancelLockedEvent(auth.session, eventId, {
      reason: body.reason,
      details: body.details,
      refundTermsConfirmed: body.refundTermsConfirmed,
    });

    let message = 'Event cancelled.';
    const paid = Number(result.paidBookings) || 0;
    if (paid > 0) {
      if (result.refundsConfirmed) {
        message =
          paid === 1
            ? 'Event cancelled. The paying attendee will receive an automatic refund.'
            : `Event cancelled. All ${paid} paying attendees will receive an automatic refund.`;
      } else if (result.refundResult?.failed?.length) {
        const failed = result.refundResult.failed.length;
        message =
          failed === 1
            ? 'Event cancelled, but 1 refund could not be issued automatically. Open Revenue and click “Confirm refunds issued”, or contact support.'
            : `Event cancelled, but ${failed} refunds could not be issued automatically. Open Revenue and click “Confirm refunds issued”, or contact support.`;
      } else {
        message =
          'Event cancelled. Refunds are being processed in Stripe — your payout hold will clear once each refund is confirmed.';
      }
    }

    return json(res, 200, {
      ok: true,
      event: result.event,
      cancellation: result.cancellation,
      refundResult: result.refundResult,
      refundsConfirmed: result.refundsConfirmed,
      message,
    });
  } catch (e) {
    return json(res, e.status || 500, { error: 'cancellation_failed', message: e.message });
  }
};
