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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (!api.listTeamMembers) {
    return json(res, 501, { error: 'team_not_supported', message: 'Team management requires Supabase.' });
  }

  try {
    if (req.method === 'GET') {
      const { access, members } = await api.listTeamMembers(auth.session);
      return json(res, 200, {
        ok: true,
        members,
        role: access.role,
        canManageTeam: access.canManageTeam,
        canDeleteEvents: access.canDeleteEvents,
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || 'invite').toLowerCase();

      if (action === 'resend') {
        const memberId = String(body.id || body.memberId || '').trim();
        if (!memberId) return json(res, 400, { error: 'missing_member_id' });
        const { member } = await api.resendTeamInvite(auth.session, memberId);
        return json(res, 200, { ok: true, member, message: 'Invite resent to ' + member.email });
      }

      const email = String(body.email || '').trim();
      const { member } = await api.inviteTeamMember(auth.session, {
        email,
        role: body.role || 'editor',
      });
      return json(res, 201, {
        ok: true,
        member,
        message: 'Invite sent to ' + member.email + ' — they will appear here once they accept',
      });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const memberId = String(body.id || body.memberId || req.query?.id || '').trim();
      if (!memberId) return json(res, 400, { error: 'missing_member_id' });
      await api.removeTeamMember(auth.session, memberId);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, { error: 'team_error', message: e.message });
  }
};
