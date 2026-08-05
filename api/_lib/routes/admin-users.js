const crypto = require('crypto');
const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminUsers } = require('../admin-supabase-data');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const sbAuth = require('../supabase-auth');

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

function siteUrl() {
  return process.env.SITE_URL || 'https://the-networker-hub.vercel.app';
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method === 'GET') {
    try {
      let q = '';
      let role = '';
      let limit;
      let offset;
      if (req.url) {
        try {
          const params = new URL(req.url, 'https://internal.local').searchParams;
          q = params.get('q') || '';
          role = params.get('role') || '';
          if (params.has('limit')) limit = params.get('limit');
          if (params.has('offset')) offset = params.get('offset');
        } catch {
          /* keep defaults */
        }
      }
      const report = await getAdminUsers({ q, role, limit, offset });
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'users_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const organiserId = String(body.organiserId || body.organiser_id || '').trim();
    const userId = String(body.userId || body.user_id || body.id || '').trim();

    if (!Object.prototype.hasOwnProperty.call(body, 'featured')) {
      return json(res, 400, { error: 'no_fields' });
    }

    try {
      const sb = getSupabaseAdmin();
      let targetOrganiserId = organiserId;

      if (!targetOrganiserId && userId) {
        const lookup = await sb
          .from('organisers')
          .select('id')
          .eq('supabase_user_id', userId)
          .maybeSingle();
        if (lookup.error) throw new Error(lookup.error.message);
        targetOrganiserId = lookup.data?.id || '';
      }

      if (!targetOrganiserId) {
        return json(res, 400, { error: 'no_organiser_profile', message: 'This user has no organiser profile to feature.' });
      }

      const { parseAdminBool } = require('../admin-bool');
      const { data, error } = await sb
        .from('organisers')
        .update({ featured: parseAdminBool(body.featured) })
        .eq('id', targetOrganiserId)
        .select('id, name, featured')
        .single();
      if (error) throw new Error(error.message);

      return json(res, 200, { ok: true, organiser: data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const action = String(body.action || '').trim();
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const userId = String(body.userId || body.user_id || '').trim();

    if (action === 'send_password_reset') {
      if (!email) return json(res, 400, { ok: false, error: 'missing_email' });
      try {
        const user = await sbAuth.findUserByEmail(email);
        if (!user) {
          return json(res, 404, { ok: false, error: 'user_not_found', message: 'No account for this email.' });
        }
        const { createPasswordResetLink, sendPasswordResetEmail } = require('../password-reset-email');
        let resetUrl = null;
        let emailSent = false;
        const displayName = String(user.name || user.full_name || '').trim();

        if (sbAuth.authEmailsEnabled()) {
          try {
            const sent = await sendPasswordResetEmail({ email, userName: displayName });
            emailSent = Boolean(sent?.ok);
            resetUrl = sent?.reset_url || null;
          } catch (mailErr) {
            if (mailErr.code !== 'resend_not_configured') throw mailErr;
          }
        }

        if (!resetUrl) {
          resetUrl = await createPasswordResetLink(email);
        }

        return json(res, 200, {
          ok: true,
          email,
          resetUrl,
          emailSent,
          message: emailSent
            ? 'Branded reset email sent. The user can also use the link below if needed.'
            : resetUrl
              ? 'Recovery link generated — share with the user or open it yourself to set a new password.'
              : 'Recovery link requested.',
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'reset_failed', message: e.message });
      }
    }

    if (action === 'set_password') {
      const password = String(body.password || '').trim();
      if (!password || password.length < 8) {
        return json(res, 400, { ok: false, error: 'invalid_password', message: 'Password must be at least 8 characters.' });
      }
      try {
        let targetId = userId;
        if (!targetId && email) {
          const user = await sbAuth.findUserByEmail(email);
          if (!user) {
            return json(res, 404, { ok: false, error: 'user_not_found', message: 'No account for this email.' });
          }
          targetId = user.id;
        }
        if (!targetId) return json(res, 400, { ok: false, error: 'missing_user' });

        const sb = getSupabaseAdmin();
        const { error } = await sb.auth.admin.updateUserById(targetId, { password });
        if (error) throw new Error(error.message);
        return json(res, 200, {
          ok: true,
          message: 'Password updated. Tell the user to sign in with the new password.',
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'password_failed', message: e.message });
      }
    }

    if (action === 'set_emails_enabled') {
      const enabled = Boolean(body.emails_enabled ?? body.emailsEnabled);
      try {
        let targetId = userId;
        if (!targetId && email) {
          const user = await sbAuth.findUserByEmail(email);
          if (!user) {
            return json(res, 404, { ok: false, error: 'user_not_found', message: 'No account for this email.' });
          }
          targetId = user.id;
        }
        if (!targetId) return json(res, 400, { ok: false, error: 'missing_user' });

        const hub = await sbAuth.setEmailsEnabled(targetId, enabled);
        return json(res, 200, {
          ok: true,
          emails_enabled: hub.emails_enabled,
          message: enabled ? 'Emails enabled for this user.' : 'Emails blocked for this user.',
        });
      } catch (e) {
        return json(res, e.status || 500, { ok: false, error: 'update_failed', message: e.message });
      }
    }

    if (action === 'generate_temp_password') {
      try {
        let targetId = userId;
        let targetEmail = email;
        if (!targetId && email) {
          const user = await sbAuth.findUserByEmail(email);
          if (!user) {
            return json(res, 404, { ok: false, error: 'user_not_found', message: 'No account for this email.' });
          }
          targetId = user.id;
          targetEmail = user.email;
        }
        if (!targetId) return json(res, 400, { ok: false, error: 'missing_user' });

        const tempPassword = crypto.randomBytes(9).toString('base64url');
        const sb = getSupabaseAdmin();
        const { error } = await sb.auth.admin.updateUserById(targetId, { password: tempPassword });
        if (error) throw new Error(error.message);
        return json(res, 200, {
          ok: true,
          email: targetEmail,
          tempPassword,
          message: 'Temporary password set — share securely with the user and ask them to change it after sign-in.',
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'password_failed', message: e.message });
      }
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
