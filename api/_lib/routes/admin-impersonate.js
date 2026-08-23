const {
  sessionFromRequest,
  requireAdmin,
  json,
  setCors,
  setSessionCookie,
  setHubViewCookie,
  normalizeRole,
  appendSystemLog,
} = require('../auth');
const { useSupabase, getSupabaseAdmin } = require('../supabase');
const sbAuth = require('../supabase-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!process.env.SESSION_SECRET) {
    return json(res, 503, { error: 'not_configured', message: 'Set SESSION_SECRET in Vercel.' });
  }

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error, message: gate.message });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  let email = String(body.email || '')
    .trim()
    .toLowerCase();
  const organiserId = String(body.organiserId || body.organiser_id || '').trim();
  let organiserIdsToClaim = organiserId ? [organiserId] : [];

  if (organiserId && useSupabase()) {
    try {
      const sb = getSupabaseAdmin();
      const { data: organiser, error: orgErr } = await sb
        .from('organisers')
        .select('id, name, email, contact_email, supabase_user_id')
        .eq('id', organiserId)
        .maybeSingle();
      if (orgErr) throw new Error(orgErr.message);
      if (!organiser) {
        return json(res, 404, {
          error: 'organiser_not_found',
          message: 'Group profile not found.',
        });
      }

      if (body.provision !== false) {
        await sbAuth.provisionOrganiserLogin(organiserId);
      }

      email = String(organiser.contact_email || organiser.email || email || '')
        .trim()
        .toLowerCase();
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'organiser_lookup_failed',
        message: e.message || 'Could not prepare group login.',
      });
    }
  }

  if (!email) {
    return json(res, 400, {
      error: 'missing_email',
      message: organiserId
        ? 'This group has no email address. Add one in the profile first.'
        : 'Enter a user email address.',
    });
  }

  if (email === String(session.email || '').toLowerCase()) {
    return json(res, 400, {
      error: 'same_user',
      message: 'You are already signed in as this account.',
    });
  }

  try {
    let target = null;

    if (useSupabase()) {
      target = await sbAuth.findUserByEmail(email);
    } else {
      const { findUserByEmail } = require('../auth');
      target = await findUserByEmail(email);
    }

    if (!target && body.provision !== false) {
      const provisioned = await sbAuth.provisionOrganiserLoginByEmail(email);
      if (provisioned) {
        target = await sbAuth.findUserByEmail(email);
      }
    }

    if (!organiserIdsToClaim.length && email && useSupabase()) {
      organiserIdsToClaim = await sbAuth.findOrganiserIdsByEmail(email);
    }

    if (!target) {
      const organiserIds = await sbAuth.findOrganiserIdsByEmail(email);
      return json(res, 404, {
        error: 'user_not_found',
        message: organiserIds.length
          ? 'Could not create a login for this group profile. Check Supabase migration 033_hub_emails_enabled.sql has been run.'
          : 'No site login or group profile found for that email. Add the email on the group profile in Group profile cleanup, or create a login there first.',
      });
    }

    const targetRole = normalizeRole(target.role);
    const impersonatingGroup = Boolean(organiserId || organiserIdsToClaim.length);
    // Groups often use a team inbox that is also a Command Center login.
    // Block impersonating another admin's account, but still open that group's workspace.
    if (targetRole === 'admin' && !impersonatingGroup) {
      return json(res, 403, {
        error: 'cannot_impersonate_admin',
        message: 'Admin accounts cannot be impersonated.',
      });
    }

    // Do not auto-claim on Impersonate. Workspace scope already includes
    // impersonatedOrganiserIds, and claiming falsely marks pages as owned
    // (blocks Email 2 / "Email their claim link") when staff only previewed.
    if (body.provision !== false && organiserIdsToClaim.length && useSupabase()) {
      for (const oid of organiserIdsToClaim) {
        try {
          await sbAuth.provisionOrganiserLogin(oid);
        } catch {
          /* login may already exist; workspace still opens via impersonated ids */
        }
      }
    }

    const impersonator = {
      sub: session.sub,
      email: session.email,
      role: session.role,
      name: session.name || '',
    };

    const sessionUser = {
      sub: target.id,
      email: target.email,
      // Never carry platform-admin into the public site / organiser workspace.
      role: 'client',
      name: target.name || '',
      impersonator,
      impersonatedOrganiserIds: [
        ...new Set(
          (organiserIdsToClaim || [])
            .concat(organiserId || [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ],
    };

    await appendSystemLog(
      `Admin ${session.email} started impersonating ${target.email}`,
      'security'
    );

    try {
      const { logOutreachFromImpersonate } = require('../organiser-sales-outreach');
      const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
      if (isSupabaseConfigured()) {
        const sb = getSupabaseAdmin();
        let orgId = organiserIdsToClaim[0] || organiserId || '';
        let orgName = target.name || '';
        let orgEmail = email;
        if (orgId) {
          const { data: orgRow } = await sb
            .from('organisers')
            .select('id, name, email, contact_email, is_internal, is_walkthrough_demo')
            .eq('id', orgId)
            .maybeSingle();
          if (orgRow) {
            orgName = orgRow.name || orgName;
            orgEmail = String(orgRow.contact_email || orgRow.email || orgEmail || '')
              .trim()
              .toLowerCase();
          }
        } else {
          const { data: byEmail } = await sb
            .from('organisers')
            .select('id, name, email, contact_email, is_internal, is_walkthrough_demo')
            .or('email.eq.' + email + ',contact_email.eq.' + email)
            .limit(1)
            .maybeSingle();
          if (byEmail) {
            orgId = byEmail.id;
            orgName = byEmail.name || orgName;
            orgEmail = String(byEmail.contact_email || byEmail.email || orgEmail || '')
              .trim()
              .toLowerCase();
          }
        }
        if (orgId) {
          await logOutreachFromImpersonate({
            adminEmail: session.email,
            organiserId: orgId,
            organiserName: orgName,
            organiserEmail: orgEmail,
          });
        }
      }
    } catch (logErr) {
      console.warn('[impersonate] outreach log', logErr && logErr.message ? logErr.message : logErr);
    }

    const redirect =
      body.redirect ||
      (body.view === 'organiser'
        ? '/organiser/'
        : body.view === 'events'
          ? '/events/'
          : '/account/');

    if (!setSessionCookie(res, sessionUser)) {
      return json(res, 503, { error: 'session_failed' });
    }
    const openOrganiser =
      body.view === 'organiser' || String(redirect).indexOf('/organiser') !== -1;
    setHubViewCookie(res, openOrganiser ? 'organiser' : 'attendee');

    return json(res, 200, {
      ok: true,
      message: `Now viewing as ${target.email}.`,
      redirect,
      user: {
        sub: sessionUser.sub,
        email: sessionUser.email,
        role: sessionUser.role,
        name: sessionUser.name,
      },
      impersonating: true,
      impersonatorEmail: impersonator.email,
    });
  } catch (e) {
    return json(res, 500, {
      error: 'impersonate_failed',
      message: e.message || 'Could not impersonate that user.',
    });
  }
};
