const { getOrganiserApi } = require('../organiser-provider');
const { assertOrganiserEmailVerified } = require('../organiser-access-guard');
const { getSupabaseAdmin } = require('../supabase');
const {
  blockAttendeeForOrganiser,
  unblockAttendeeForOrganiser,
  listBlocksForOrganiser,
  listBlocksForOrganiserIds,
  normalizeBlockEmail,
} = require('../organiser-attendee-blocks');

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

async function assertGroupAccess(api, session, organiserId) {
  const groups = await api.listGroupsForSession(session);
  if (!api.groupOwnedBySession(session, groups, organiserId)) {
    const err = new Error('group_not_owned');
    err.status = 403;
    throw err;
  }
}

function mapBlockResponse(block) {
  return {
    id: block.id,
    organiserId: block.organiser_id,
    email: block.email,
    reason: block.reason || '',
    status: block.status,
    createdAt: block.created_at,
  };
}

function buildBlockMessage(result) {
  const parts = ['Blocked from your future events.'];
  if (result.cancelledCount > 0) {
    parts.push(
      result.cancelledCount === 1
        ? '1 upcoming booking was cancelled (refunded if paid).'
        : result.cancelledCount + ' upcoming bookings were cancelled (refunded if paid).'
    );
  }
  if (result.deniedCount > 0) {
    parts.push(
      result.deniedCount === 1
        ? '1 pending application was declined.'
        : result.deniedCount + ' pending applications were declined.'
    );
  }
  return parts.join(' ');
}

function humanError(e) {
  const code = String(e.code || e.message || '');
  const map = {
    group_not_owned: 'You do not manage this organiser page.',
    registration_not_found: 'That registration could not be found.',
    registration_organiser_mismatch: 'That registration is not on this organiser page.',
    missing_organiser_id: 'Choose an organiser page first.',
    missing_email: 'An email address is required to block someone.',
    missing_block_target: 'Choose who to block.',
    block_not_found: 'That block was not found.',
    attendee_not_found: 'That person could not be found.',
  };
  return map[code] || e.message || 'Something went wrong.';
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, requireOrganiserSession } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const verified = await assertOrganiserEmailVerified(auth.session);
  if (!verified.ok) {
    return json(res, verified.status, {
      error: verified.error,
      message: verified.message,
    });
  }

  try {
    if (req.method === 'GET') {
      const organiserId = String(
        req.query?.organiserId || req.query?.organiser_id || req.query?.groupId || ''
      ).trim();
      const allGroups = String(req.query?.all || '').trim() === '1';

      if (allGroups) {
        const groups = await api.listGroupsForSession(auth.session);
        const groupIds = (groups || []).map((g) => g.id).filter(Boolean);
        const blocks = await listBlocksForOrganiserIds(groupIds, { status: 'active' });
        return json(res, 200, { ok: true, blocks });
      }

      if (!organiserId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
      await assertGroupAccess(api, auth.session, organiserId);
      const blocks = await listBlocksForOrganiser(organiserId, { status: 'active' });
      return json(res, 200, { ok: true, blocks });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const registrationId = String(body.registrationId || body.registration_id || '').trim();
      let organiserId = String(
        body.organiserId || body.organiser_id || body.groupId || req.query?.organiserId || ''
      ).trim();
      const email = normalizeBlockEmail(body.email);
      const attendeeId = String(body.attendeeId || body.attendee_id || '').trim();
      const reason = String(body.reason || '').trim();

      if (registrationId && !organiserId) {
        const sb = getSupabaseAdmin();
        const { data: reg, error } = await sb
          .from('registrations')
          .select('organiser_id')
          .eq('id', registrationId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!reg) {
          return json(res, 404, { ok: false, error: 'registration_not_found' });
        }
        organiserId = String(reg.organiser_id || '').trim();
      }

      if (!organiserId) {
        return json(res, 400, { ok: false, error: 'missing_organiser_id' });
      }
      await assertGroupAccess(api, auth.session, organiserId);

      const result = await blockAttendeeForOrganiser({
        organiserId,
        email,
        attendeeId,
        registrationId,
        reason,
        createdBy: auth.session?.sub || null,
        cancelUpcoming: body.cancelUpcoming !== false,
      });

      return json(res, 200, {
        ok: true,
        block: mapBlockResponse(result.block),
        cancelledCount: result.cancelledCount,
        deniedCount: result.deniedCount,
        message: buildBlockMessage(result),
      });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const organiserId = String(
        body.organiserId ||
          body.organiser_id ||
          req.query?.organiserId ||
          req.query?.organiser_id ||
          ''
      ).trim();
      const blockId = String(body.id || body.blockId || req.query?.id || '').trim();
      const email = normalizeBlockEmail(body.email || req.query?.email);

      if (!organiserId) return json(res, 400, { ok: false, error: 'missing_organiser_id' });
      await assertGroupAccess(api, auth.session, organiserId);

      const result = await unblockAttendeeForOrganiser({
        organiserId,
        blockId,
        email,
      });

      return json(res, 200, {
        ok: true,
        block: mapBlockResponse(result.block),
        message: 'They can book your events again.',
      });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: e.code || e.message || 'server_error',
      message: humanError(e),
    });
  }
};
