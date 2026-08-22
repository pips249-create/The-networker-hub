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
    reviewApplicationForOrganiser,
    reconsiderArchivedApplicationForOrganiser,
    resendApplicationOrganiserAlert,
    resendApprovalEmailForOrganiser,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!reviewApplicationForOrganiser) {
    return json(res, 501, {
      error: 'application_decisions_not_supported',
      message: 'Requires Supabase.',
    });
  }

  const body = parseBody(req);
  const registrationId = String(body.registrationId || body.registration_id || body.id || '').trim();
  const action = String(body.action || '').trim().toLowerCase();

  if (!registrationId) {
    return json(res, 400, { ok: false, error: 'missing_registration_id' });
  }
  if (
    action !== 'approve' &&
    action !== 'deny' &&
    action !== 'reconsider' &&
    action !== 'resend_alert' &&
    action !== 'resend_approval'
  ) {
    return json(res, 400, { ok: false, error: 'invalid_action' });
  }

  try {
    if (action === 'resend_alert') {
      if (!resendApplicationOrganiserAlert) {
        return json(res, 501, {
          error: 'resend_alert_not_supported',
          message: 'Requires Supabase.',
        });
      }
      const result = await resendApplicationOrganiserAlert(auth.session, registrationId);
      return json(res, 200, {
        ok: true,
        ...result,
        message: 'Application alert email sent to ' + (result.to || 'your inbox') + '.',
      });
    }

    if (action === 'resend_approval') {
      if (!resendApprovalEmailForOrganiser) {
        return json(res, 501, {
          error: 'resend_approval_not_supported',
          message: 'Requires Supabase.',
        });
      }
      const result = await resendApprovalEmailForOrganiser(auth.session, registrationId);
      const to = String(result.to || '').trim();
      return json(res, 200, {
        ok: true,
        ...result,
        message: to
          ? 'Approval email with payment link sent to ' + to + '.'
          : 'Approval email sent.',
      });
    }

    if (action === 'reconsider') {
      if (!reconsiderArchivedApplicationForOrganiser) {
        return json(res, 501, {
          error: 'reconsider_not_supported',
          message: 'Requires Supabase.',
        });
      }
      const reconsiderMode = String(body.reconsiderMode || body.reconsider_mode || 'approve')
        .trim()
        .toLowerCase();
      const result = await reconsiderArchivedApplicationForOrganiser(
        auth.session,
        registrationId,
        reconsiderMode
      );
      let message =
        reconsiderMode === 'approve'
          ? 'Application approved from archive. The attendee has been notified by email.'
          : 'Application moved back to pending review.';
      const emailErr = result.emailResult?.error || result.emailResult?.errors?.[0]?.message;
      if (emailErr && reconsiderMode === 'approve') {
        message +=
          ' However, the notification email could not be sent (' +
          String(emailErr) +
          '). Use “Resend payment email” on the Attendees table.';
      }
      return json(res, 200, { ok: true, ...result, message });
    }

    const denialReason =
      action === 'deny' ? String(body.denialReason || body.denial_reason || '').trim() : '';
    const result = await reviewApplicationForOrganiser(auth.session, registrationId, action, {
      denialReason,
    });
    let message =
      action === 'approve'
        ? 'Application approved. The attendee has been notified by email.'
        : 'Application declined and moved to archived applications. The attendee has been notified by email.';
    const emailErr = result.emailResult?.error || result.emailResult?.errors?.[0]?.message;
    if (emailErr) {
      message +=
        ' However, the notification email could not be sent (' +
        String(emailErr) +
        '). Use “Resend payment email” on the Attendees table.';
    }
    return json(res, 200, { ok: true, ...result, message });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'review_failed',
      message: e.message,
    });
  }
};
