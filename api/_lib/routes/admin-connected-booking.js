/**
 * Command Centre — allocate free Connected booking or Link Out.
 * GET  /api/admin/connected-booking?q=
 * POST /api/admin/connected-booking  { action, email|accountId, plan?, note? }
 */
const { json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { haystackMatchesQuery } = require('../search-match');
const { normalizeConnectedBookingEmail } = require('../connected-booking-util');
const {
  mapGrantAccount,
  resolveAccountEmail,
  findOrganiserAccountByEmail,
  findAllOrganiserAccountsByEmail,
  findOrganiserAccountById,
  listOrganisersForAccount,
  listGrantedAccounts,
  activateConnectedBookingGrant,
  revokeConnectedBookingGrant,
  activateLinkOutGrant,
  revokeLinkOutGrant,
  normalizePlan,
} = require('../connected-booking-grants');

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

async function hydrateAccount(sb, account) {
  if (!account) return null;
  const email = await resolveAccountEmail(sb, account);
  const organisers = await listOrganisersForAccount(sb, account.id);
  return mapGrantAccount({ ...account, email: account.email || email }, { email, organisers });
}

async function resolveTargetAccount(sb, body) {
  const accountId = String(body.accountId || body.id || '').trim();
  if (accountId) {
    const byId = await findOrganiserAccountById(sb, accountId);
    if (byId) return byId;
  }
  const email = normalizeConnectedBookingEmail(body.email);
  if (email) {
    return findOrganiserAccountByEmail(sb, email);
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();
  const session = sessionFromRequest(req);
  const adminEmail = normalizeConnectedBookingEmail(session?.email || '');

  if (req.method === 'GET') {
    try {
      const q = String(req.query?.q || '').trim();
      let accounts = await listGrantedAccounts(sb);
      if (q) {
        accounts = accounts.filter((a) => {
          const orgBits = (a.organisers || []).map((o) => [o.name, o.email, o.slug].join(' ')).join(' ');
          return haystackMatchesQuery([a.email, a.id, a.connectedGrantedBy, a.linkOutGrantedBy, orgBits].join(' '), q);
        });
      }
      const stats = {
        connectedGrants: accounts.filter((a) => a.hasConnectedGrant).length,
        linkOutGrants: accounts.filter((a) => a.hasLinkOutGrant).length,
        total: accounts.length,
      };
      return json(res, 200, { ok: true, accounts, stats });
    } catch (e) {
      console.error('admin-connected-booking GET', e);
      return json(res, 500, { error: 'server_error', message: e.message || String(e) });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  try {
    const body = parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    const grantedBy =
      normalizeConnectedBookingEmail(body.grantedBy) ||
      adminEmail ||
      'command-centre';

    if (action === 'lookup') {
      const email = normalizeConnectedBookingEmail(body.email);
      if (email) {
        const all = await findAllOrganiserAccountsByEmail(sb, email);
        if (!all.length) {
          return json(res, 404, {
            ok: false,
            error: 'not_found',
            message: 'No organiser account found for that email. They need a hub account first.',
          });
        }
        const accounts = [];
        for (const row of all) accounts.push(await hydrateAccount(sb, row));
        return json(res, 200, { ok: true, account: accounts[0], accounts, matchCount: accounts.length });
      }
      const account = await resolveTargetAccount(sb, body);
      if (!account) {
        return json(res, 404, {
          ok: false,
          error: 'not_found',
          message: 'No organiser account found for that email. They need a hub account first.',
        });
      }
      return json(res, 200, { ok: true, account: await hydrateAccount(sb, account) });
    }

    // Email grants apply to every matching account (login + directory-linked),
    // so Link Out shows when they open the organiser workspace.
    const email = normalizeConnectedBookingEmail(body.email);
    const explicitId = String(body.accountId || body.id || '').trim();
    let targets = [];
    if (explicitId && !email) {
      const one = await findOrganiserAccountById(sb, explicitId);
      if (one) targets = [one];
    } else if (email) {
      targets = await findAllOrganiserAccountsByEmail(sb, email);
    } else {
      const one = await resolveTargetAccount(sb, body);
      if (one) targets = [one];
    }

    if (!targets.length) {
      return json(res, 404, {
        ok: false,
        error: 'not_found',
        message: 'No organiser account found for that email. They need a hub account first.',
      });
    }

    const updatedRows = [];
    for (const account of targets) {
      let updated = account;
      if (action === 'grant_connected') {
        updated = await activateConnectedBookingGrant(sb, account, {
          plan: normalizePlan(body.plan),
          grantedBy,
          note: body.note,
        });
      } else if (action === 'revoke_connected') {
        updated = await revokeConnectedBookingGrant(sb, account);
      } else if (action === 'grant_link_out') {
        updated = await activateLinkOutGrant(sb, account, { grantedBy, note: body.note });
      } else if (action === 'revoke_link_out') {
        updated = await revokeLinkOutGrant(sb, account);
      } else {
        return json(res, 400, { error: 'unknown_action', message: 'Unknown action: ' + action });
      }
      updatedRows.push(updated);
    }

    const accounts = [];
    for (const row of updatedRows) accounts.push(await hydrateAccount(sb, row));

    return json(res, 200, {
      ok: true,
      action,
      account: accounts[0],
      accounts,
      matchCount: accounts.length,
      message:
        accounts.length > 1
          ? 'Updated ' + accounts.length + ' matching organiser accounts for this email.'
          : undefined,
    });
  } catch (e) {
    console.error('admin-connected-booking POST', e);
    const status = e.status || 500;
    return json(res, status, {
      ok: false,
      error: e.code || 'server_error',
      message: e.message || String(e),
    });
  }
};
