/**
 * Admin — Hubert Matchmaker seed list (Rosie / ops).
 */
const { json, setCors, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const {
  normalizeSeedInput,
  listSeedContacts,
  getSeedContact,
  createSeedContact,
  updateSeedContact,
  deleteSeedContact,
  isUuid,
} = require('../hubert-match-seed');
const { sendHubInvite } = require('../hubert-hub-invite');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function queryParam(req, key) {
  try {
    const url = new URL(req.url || '', 'https://internal.local');
    return String(url.searchParams.get(key) || '').trim();
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured', contacts: [] });
  }

  try {
    if (req.method === 'GET') {
      const data = await listSeedContacts({
        status: queryParam(req, 'status'),
        q: queryParam(req, 'q'),
        limit: queryParam(req, 'limit') || 200,
      });
      return json(res, 200, { ok: true, ...data });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const action = String(body.action || 'create').trim().toLowerCase();

      if (action === 'pause' || action === 'activate' || action === 'do_not_contact') {
        const id = String(body.id || '').trim();
        if (!isUuid(id)) return json(res, 400, { ok: false, error: 'invalid_id' });
        const status =
          action === 'activate' ? 'active' : action === 'pause' ? 'paused' : 'do_not_contact';
        const contact = await updateSeedContact(id, {
          status,
          paused_at: status === 'active' ? null : new Date().toISOString(),
          pause_reason:
            status === 'active'
              ? null
              : String(body.pauseReason || body.pause_reason || (action === 'pause' ? 'manual_pause' : 'do_not_contact')).slice(
                  0,
                  200
                ),
        });
        return json(res, 200, { ok: true, contact });
      }

      const session = sessionFromRequest(req);

      if (action === 'invite') {
        const id = String(body.id || '').trim();
        if (!isUuid(id)) return json(res, 400, { ok: false, error: 'invalid_id' });
        const contact = await getSeedContact(id);
        if (!contact.email) {
          return json(res, 400, {
            ok: false,
            error: 'email_required',
            message: 'Add an email on this seed contact before inviting them.',
          });
        }
        const sb = getSupabaseAdmin();
        const invite = await sendHubInvite({
          sb,
          session,
          inviteeName: contact.fullName,
          inviteeEmail: contact.email,
          note:
            String(body.note || '').trim() ||
            'Rosie thought you’d be a good fit for The Networker UK and Hubert introductions.',
          inviterAttendeeId: null,
        });
        if (!invite.ok) {
          const status =
            invite.error === 'quota_exceeded'
              ? 429
              : invite.error === 'email_invalid' || invite.error === 'name_required'
                ? 400
                : 502;
          return json(res, status, invite);
        }
        // Light ops trail on the seed row (not shown publicly).
        const stamp = new Date().toISOString().slice(0, 10);
        const noteLine = 'Hub invite sent ' + stamp;
        const nextNotes = [contact.notes, noteLine].filter(Boolean).join('\n').slice(0, 1000);
        await updateSeedContact(id, { notes: nextNotes }).catch(function () {
          /* non-fatal */
        });
        return json(res, 200, { ok: true, invite, contact });
      }

      const parsed = normalizeSeedInput(body);
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_seed', fields: parsed.errors });
      }
      if (!parsed.fields.status) parsed.fields.status = 'active';
      if (!parsed.fields.source) parsed.fields.source = 'linkedin';
      const contact = await createSeedContact(
        parsed.fields,
        (session && (session.sub || session.userId || session.id)) || null
      );

      let invite = null;
      const wantInvite =
        body.inviteNow === true ||
        body.invite_now === true ||
        String(body.inviteNow || body.invite_now || '').toLowerCase() === 'true' ||
        String(body.inviteNow || body.invite_now || '') === '1';
      if (wantInvite) {
        if (!contact.email) {
          return json(res, 200, {
            ok: true,
            contact,
            invite: {
              ok: false,
              error: 'email_required',
              message: 'Saved to seed list. Add an email to send a Hub invite.',
            },
          });
        }
        const sb = getSupabaseAdmin();
        invite = await sendHubInvite({
          sb,
          session,
          inviteeName: contact.fullName,
          inviteeEmail: contact.email,
          note:
            String(body.note || '').trim() ||
            'Rosie thought you’d be a good fit for The Networker UK and Hubert introductions.',
          inviterAttendeeId: null,
        });
        if (invite.ok) {
          const stamp = new Date().toISOString().slice(0, 10);
          const noteLine = 'Hub invite sent ' + stamp;
          const nextNotes = [contact.notes, noteLine].filter(Boolean).join('\n').slice(0, 1000);
          await updateSeedContact(contact.id, { notes: nextNotes }).catch(function () {});
        }
      }

      return json(res, 200, { ok: true, contact, invite });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const id = String(body.id || queryParam(req, 'id') || '').trim();
      if (!isUuid(id)) return json(res, 400, { ok: false, error: 'invalid_id' });
      const parsed = normalizeSeedInput(body, { partial: true });
      if (!parsed.ok) {
        return json(res, 400, { ok: false, error: 'invalid_seed', fields: parsed.errors });
      }
      if (!Object.keys(parsed.fields).length) {
        return json(res, 400, { ok: false, error: 'empty_patch' });
      }
      const contact = await updateSeedContact(id, parsed.fields);
      return json(res, 200, { ok: true, contact });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const id = String(body.id || queryParam(req, 'id') || '').trim();
      const removed = await deleteSeedContact(id);
      return json(res, 200, { ok: true, id: removed });
    }

    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  } catch (e) {
    if (e && e.code === 'seed_table_missing') {
      return json(res, 503, {
        ok: false,
        error: 'seed_table_missing',
        message: 'Run migration 332_hubert_match_seed.sql in Supabase.',
        contacts: [],
      });
    }
    const status = e && e.status ? e.status : 500;
    return json(res, status, {
      ok: false,
      error: e && e.message ? e.message : 'seed_failed',
      message: e && e.message ? e.message : 'Seed request failed.',
    });
  }
};
