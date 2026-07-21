const {
  setSessionCookie,
  json,
  sessionFromRequest,
  setCors,
  normalizeRole,
  isAdminRole,
  hubViewFromRequest,
} = require('../auth');
const { useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');
const { enforceRateLimit } = require('../rate-limit');
const {
  isOrganiserAuthIntent,
  maybeAutoEnableOrganiserAccess,
  redirectAfterOrganiserAuth,
} = require('../organiser-auth-intent');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const session = sessionFromRequest(req);
    return json(res, 200, { ok: !!session, user: session || null });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SESSION_SECRET in Vercel (random 32+ character string).',
    });
  }

  if (!useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY. See SUPABASE-FRESH-START.md.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const password = String(body.password || '');
  const rememberMe = Boolean(body.rememberMe);

  if (!email || !password) {
    return json(res, 400, { error: 'missing_credentials' });
  }

  const limited = enforceRateLimit(req, res, 'auth_login', { max: 12, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const login = await sbAuth.verifyLogin(email, password);
    if (!login.ok) {
      return json(res, 401, {
        error: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      });
    }

    const user = await sbAuth.findUserByEmail(email);
    if (!user) {
      return json(res, 401, { error: 'no_account', message: 'No account for this email.' });
    }

    const role = normalizeRole(user.role);

    const sessionUser = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
    };

    if (!setSessionCookie(res, sessionUser, { rememberMe })) {
      return json(res, 503, { error: 'session_failed' });
    }

    await sbAuth.backfillAttendeeUserId(sessionUser.sub, sessionUser.email);

    try {
      const { getSupabaseAdmin } = require('../supabase');
      const { claimRosterEntriesForAttendee } = require('../organiser-member-roster');
      const sb = getSupabaseAdmin();
      const normalizedEmail = String(sessionUser.email || '').trim().toLowerCase();
      const attendeeUpsert = await sb.from('attendees').upsert(
        {
          email: normalizedEmail,
          name: sessionUser.name || null,
          supabase_user_id: sessionUser.sub,
        },
        { onConflict: 'email' }
      );
      if (attendeeUpsert.error) throw new Error(attendeeUpsert.error.message);
      const att = await sb
        .from('attendees')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      if (att.error) throw new Error(att.error.message);
      if (att.data?.id) {
        await claimRosterEntriesForAttendee(sb, {
          email: normalizedEmail,
          attendeeId: att.data.id,
        });
      }
    } catch {
      /* non-fatal */
    }

    try {
      const { bootstrapOrganiserFromPendingClaims } = require('../supabase-organiser-claims');
      await bootstrapOrganiserFromPendingClaims(sessionUser);
    } catch {
      /* login succeeds even if bootstrap fails */
    }

    let autoEnable = { enabled: false, redirect: null };
    if (isOrganiserAuthIntent({ next: body.next, intent: body.intent })) {
      try {
        autoEnable = await maybeAutoEnableOrganiserAccess(sessionUser, res);
      } catch {
        /* login succeeds even if auto-enable fails */
      }
    }

    let redirect = body.next || '/events/';
    if (isAdminRole(role) && !body.next) {
      redirect = '/admin/';
    } else if (hubViewFromRequest(req) === 'organiser') {
      redirect = body.next || '/organiser/';
    }

    redirect = redirectAfterOrganiserAuth({
      next: body.next,
      intent: body.intent,
      autoResult: autoEnable,
      defaultRedirect: redirect,
    });

    return json(res, 200, {
      ok: true,
      user: sessionUser,
      redirect,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'server_error',
      message: e.message,
    });
  }
};
