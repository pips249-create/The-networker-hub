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
  const { json, setCors, requireOrganiserSession } = api;
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!api.listTeamMembers) {
    return json(res, 501, { error: 'team_not_supported', message: 'Team management requires Supabase.' });
  }

  try {
    if (req.method === 'GET') {
      const { access, members, teamMax, teamCount, teamSlotsRemaining } =
        await api.listTeamMembers(auth.session);
      return json(res, 200, {
        ok: true,
        members,
        role: access.role,
        canManageTeam: access.canManageTeam,
        canDeleteEvents: access.canDeleteEvents,
        canManagePayments: access.canManagePayments,
        canCreateGroups: access.canCreateGroups,
        useTeamWorkspace: access.useTeamWorkspace,
        teamMax,
        teamCount,
        teamSlotsRemaining,
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || 'invite').toLowerCase();

      if (action === 'resend') {
        const memberId = String(body.id || body.memberId || '').trim();
        if (!memberId) return json(res, 400, { error: 'missing_member_id' });
        const { member, emailSent } = await api.resendTeamInvite(auth.session, memberId);
        return json(res, 200, {
          ok: true,
          member,
          emailSent: emailSent !== false,
          message: emailSent
            ? 'Invite resent to ' + member.email
            : 'Could not resend the invite email. Try again shortly.',
        });
      }

      const email = String(body.email || '').trim();
      const allGroups = body.allGroups !== false && !(Array.isArray(body.groupIds) && body.groupIds.length);
      const { member, emailSent } = await api.inviteTeamMember(auth.session, {
        email,
        role: body.role || 'editor',
        allGroups,
        groupIds: allGroups ? [] : body.groupIds,
      });
      try {
        const { resolveOrganiserAccess } = require('../supabase-organiser-access');
        const { logFromSession } = require('../entity-activity-log');
        const access = await resolveOrganiserAccess(auth.session);
        await logFromSession(auth.session, access, {
          entity_type: 'team_member',
          entity_id: member.id,
          organiser_id: (access?.groupIds && access.groupIds[0]) || access?.accountId || null,
          action: 'team_invite_sent',
          summary: 'Invited team member ' + (member.email || email),
          metadata: {
            email: member.email || email,
            role: member.role || body.role || 'editor',
            accountId: access?.accountId || null,
          },
        });
      } catch {
        /* ignore */
      }
      return json(res, 201, {
        ok: true,
        member,
        emailSent: emailSent !== false,
        message: emailSent
          ? 'Invite sent to ' + member.email + ' — they will appear as Active once they sign in'
          : 'Invite saved for ' +
            member.email +
            ', but the email could not be sent. Try resend or check email settings.',
      });
    }

    if (req.method === 'PATCH') {
      if (!api.updateTeamMemberGroups) {
        return json(res, 501, { error: 'team_not_supported', message: 'Team management requires Supabase.' });
      }
      const body = parseBody(req);
      const memberId = String(body.id || body.memberId || '').trim();
      if (!memberId) return json(res, 400, { error: 'missing_member_id' });
      const allGroups =
        body.allGroups === true ||
        (body.allGroups !== false && !(Array.isArray(body.groupIds) && body.groupIds.length));
      const { member } = await api.updateTeamMemberGroups(auth.session, memberId, {
        allGroups,
        groupIds: allGroups ? [] : body.groupIds,
      });
      try {
        const { resolveOrganiserAccess } = require('../supabase-organiser-access');
        const { logFromSession } = require('../entity-activity-log');
        const access = await resolveOrganiserAccess(auth.session);
        await logFromSession(auth.session, access, {
          entity_type: 'team_member',
          entity_id: memberId,
          organiser_id: (access?.groupIds && access.groupIds[0]) || access?.accountId || null,
          action: 'team_access_updated',
          summary: 'Updated group access for ' + (member.email || 'team member'),
          metadata: {
            allGroups,
            groupIds: allGroups ? [] : body.groupIds || [],
            accountId: access?.accountId || null,
          },
        });
      } catch {
        /* ignore */
      }
      return json(res, 200, {
        ok: true,
        member,
        message: 'Group access updated for ' + member.email,
      });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const memberId = String(body.id || body.memberId || req.query?.id || '').trim();
      if (!memberId) return json(res, 400, { error: 'missing_member_id' });
      await api.removeTeamMember(auth.session, memberId);
      try {
        const { resolveOrganiserAccess } = require('../supabase-organiser-access');
        const { logFromSession } = require('../entity-activity-log');
        const access = await resolveOrganiserAccess(auth.session);
        await logFromSession(auth.session, access, {
          entity_type: 'team_member',
          entity_id: memberId,
          organiser_id: (access?.groupIds && access.groupIds[0]) || access?.accountId || null,
          action: 'team_member_removed',
          summary: 'Removed team member access',
          metadata: { accountId: access?.accountId || null },
        });
      } catch {
        /* ignore */
      }
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, { error: 'team_error', message: e.message });
  }
};
