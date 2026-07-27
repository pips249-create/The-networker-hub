const { setCors, json, sessionFromRequest, setHubViewCookie, isClientRole } = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { getOrganiserAccessStatus } = require('../organiser-access-guard');
const { sendOrganiserEmailVerification } = require('../organiser-email-verification');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  if (!session?.sub) return json(res, 401, { error: 'not_authenticated' });

  if (!useSupabase()) {
    return json(res, 503, { error: 'not_configured', message: 'Supabase is not configured.' });
  }

  if (req.method === 'GET') {
    const status = await getOrganiserAccessStatus(session);
    return json(res, 200, { ok: true, ...status });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = parseBody(req);
  const action = String(body.action || 'enable').toLowerCase();

  if (action === 'resend-verification') {
    const status = await getOrganiserAccessStatus(session);
    if (!status.organiserAccess) {
      return json(res, 403, {
        error: 'organiser_access_required',
        message: 'Enable organiser access first.',
      });
    }
    if (status.organiserEmailVerified) {
      return json(res, 200, {
        ok: true,
        alreadyVerified: true,
        message: 'Your email is already confirmed for organiser access.',
      });
    }

    try {
      const result = await sendOrganiserEmailVerification({
        userId: session.sub,
        email: session.email,
        name: session.name,
      });
      return json(res, 200, {
        ok: true,
        emailSent: true,
        message: 'Check your inbox for a confirmation code.',
        ...result,
      });
    } catch (e) {
      if (e.code === 'email_not_configured' && (e.verifyUrl || e.verifyCode)) {
        return json(res, 200, {
          ok: true,
          emailSent: false,
          devVerifyUrl: e.verifyUrl || null,
          devVerifyCode: e.verifyCode || null,
          message: e.verifyCode
            ? 'Email is not configured on this server. Use the confirmation code below.'
            : 'Email is not configured on this server. Use the verification link below.',
        });
      }
      return json(res, 500, {
        error: 'verification_email_failed',
        message: e.message || 'Could not send verification email.',
      });
    }
  }

  if (action === 'hide-ui') {
    if (!isClientRole(session.role)) {
      return json(res, 403, { error: 'clients_only' });
    }
    if (!body.confirm) {
      return json(res, 400, {
        error: 'confirmation_required',
        message: 'Confirm that you only want attendee access.',
      });
    }
    try {
      await sbAuth.hideOrganiserWorkspace(session.sub, session.email);
      setHubViewCookie(res, 'attendee');
      const status = await getOrganiserAccessStatus(session);
      return json(res, 200, {
        ok: true,
        ...status,
        redirect: '/account/',
        message: 'Organiser workspace hidden. You can still buy tickets and manage bookings in My Hub.',
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.message || 'hide_organiser_failed',
        message: e.message || 'Could not update your workspace preference.',
      });
    }
  }

  if (action === 'show-ui') {
    if (!isClientRole(session.role)) {
      return json(res, 403, { error: 'clients_only' });
    }
    try {
      const before = await getOrganiserAccessStatus(session);
      if (!before.organiserAccessAt && before.organiserProfiles === 0 && before.pendingClaimCount === 0) {
        return json(res, 200, {
          ok: true,
          needsEnable: true,
          redirect: '/organiser/enable',
          message: 'Enable organiser access to list events and manage groups.',
        });
      }
      await sbAuth.showOrganiserWorkspace(session.sub);
      setHubViewCookie(res, 'organiser');
      const status = await getOrganiserAccessStatus(session);
      const redirect =
        status.organiserEmailVerified || status.pendingClaimCount > 0
          ? '/organiser/'
          : '/organiser/verify-email';
      return json(res, 200, {
        ok: true,
        ...status,
        redirect,
        message: 'Organiser workspace restored in your navigation.',
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'show_organiser_failed',
        message: e.message || 'Could not restore organiser workspace.',
      });
    }
  }

  if (action !== 'enable') {
    return json(res, 400, { error: 'invalid_action' });
  }

  if (!isClientRole(session.role)) {
    return json(res, 403, {
      error: 'clients_only',
      message: 'Only standard accounts can enable organiser access here.',
    });
  }

  if (!body.confirm) {
    return json(res, 400, {
      error: 'confirmation_required',
      message: 'Confirm that you want organiser access before continuing.',
    });
  }

  try {
    const before = await getOrganiserAccessStatus(session);
    await sbAuth.enableOrganiserAccess(session.sub);
    setHubViewCookie(res, 'organiser');

    let emailSent = false;
    let devVerifyUrl = null;
    let devVerifyCode = null;
    let verifyMessage = null;

    if (!before.organiserEmailVerified) {
      try {
        await sendOrganiserEmailVerification({
          userId: session.sub,
          email: session.email,
          name: session.name,
        });
        emailSent = true;
        verifyMessage = 'We sent a confirmation code to ' + session.email + '.';
      } catch (e) {
        if (e.code === 'email_not_configured' && (e.verifyUrl || e.verifyCode)) {
          devVerifyUrl = e.verifyUrl || null;
          devVerifyCode = e.verifyCode || null;
          verifyMessage = e.verifyCode
            ? 'Email is not configured on this server — enter the confirmation code on the next screen.'
            : 'Email is not configured on this server — use the verification link on the next screen.';
        } else {
          verifyMessage = 'Organiser access enabled, but we could not send a confirmation email yet.';
        }
      }
    }

    const status = await getOrganiserAccessStatus(session);
    const redirect = emailSent || devVerifyUrl || devVerifyCode ? '/organiser/verify-email' : '/organiser/';

    return json(res, 200, {
      ok: true,
      ...status,
      emailSent,
      devVerifyUrl,
      devVerifyCode,
      verifyMessage,
      redirect,
      message: before.organiserAccess
        ? 'Organiser access is already enabled.'
        : 'Organiser access enabled. You can set up your organiser page while we confirm your email.',
    });
  } catch (e) {
    return json(res, 500, {
      error: 'organiser_access_failed',
      message: e.message || 'Could not enable organiser access.',
    });
  }
};
