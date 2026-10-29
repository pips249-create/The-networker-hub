/**
 * GET /api/integrations/eventbrite/oauth/callback?code=&state=
 * Completes Eventbrite OAuth, stores the access token, ensures webhooks,
 * and auto-imports matching organisation events.
 */
const { json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const {
  exchangeEventbriteOAuthCode,
  verifyEventbriteOAuthState,
  safeReturnPath,
  eventbriteOAuthConfigured,
} = require('../eventbrite-oauth');
const {
  ensureProviderConnection,
  mergeProviderConnectionConfig,
} = require('../connected-booking-provider-store');
const {
  ensureEventbriteAttendeeWebhook,
  eventbritePrivateTokenFromConfig,
} = require('../connected-booking-providers/adapters/eventbrite-api');
const {
  buildProviderWebhookPublicUrl,
  webhookPublicSite,
} = require('../provider-webhook-url');
const { syncEventbriteAttendeesForConnection } = require('../eventbrite-attendee-sync');
const { syncEventbriteOrgEventsForAccount } = require('../eventbrite-org-event-sync');
const {
  isConnectedPlanActive,
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
  newWebhookSecret,
} = require('../connected-booking-util');
const { maybeAutoAssignSingleStarterSlot } = require('../connected-booking-slots');

function siteBase() {
  return String(process.env.SITE_URL || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
}

function redirectWithQuery(res, path, query) {
  const url = new URL(path, siteBase());
  Object.keys(query || {}).forEach(function (key) {
    const value = query[key];
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
}

async function activateConnectedIfNeeded(sb, accountId) {
  let { data: account } = await sb
    .from('organiser_accounts')
    .select(
      'id, email, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
    )
    .eq('id', accountId)
    .maybeSingle();
  if (!account) return null;
  if (!isConnectedPlanActive(account) && connectedBookingFreeEnabled()) {
    const patch = {
      connected_booking_plan: connectedBookingFreeDefaultPlan(),
      connected_booking_status: 'active',
    };
    if (!String(account.connected_booking_webhook_secret || '').trim()) {
      patch.connected_booking_webhook_secret = newWebhookSecret();
    }
    const { data: activated } = await sb
      .from('organiser_accounts')
      .update(patch)
      .eq('id', accountId)
      .select(
        'id, email, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret'
      )
      .maybeSingle();
    account = activated || Object.assign({}, account, patch);
    try {
      await maybeAutoAssignSingleStarterSlot(sb, account);
    } catch (_slotErr) {
      /* optional */
    }
  }
  return account;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  let query = req.query || {};
  if ((!query.code && !query.state && !query.error) && req.url) {
    try {
      query = Object.fromEntries(new URL(req.url, 'https://internal.local').searchParams);
    } catch {
      query = {};
    }
  }

  const oauthError = String(query.error || '').trim();
  const stateRaw = String(query.state || '').trim();
  const state = verifyEventbriteOAuthState(stateRaw);
  const returnPath = safeReturnPath(
    state && state.returnPath,
    '/organiser/group-edit' + (state && state.groupId ? '?id=' + encodeURIComponent(state.groupId) : '')
  );

  if (oauthError) {
    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'denied',
      eb_error: oauthError,
    });
  }

  if (!state) {
    return redirectWithQuery(res, '/organiser/#connected-booking', {
      eb_oauth: 'invalid_state',
    });
  }

  if (!eventbriteOAuthConfigured()) {
    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'not_configured',
    });
  }

  if (!isSupabaseConfigured()) {
    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'error',
      eb_error: 'supabase_not_configured',
    });
  }

  const code = String(query.code || '').trim();
  if (!code) {
    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'missing_code',
    });
  }

  const accountId = String(state.accountId || '').trim();
  const groupId = String(state.groupId || '').trim();

  try {
    const tokenResult = await exchangeEventbriteOAuthCode(code);
    const sb = getSupabaseAdmin();
    const account = await activateConnectedIfNeeded(sb, accountId);
    await ensureProviderConnection(sb, accountId, 'eventbrite');

    const configPatch = {
      eventbriteAccessToken: tokenResult.accessToken,
      eventbriteAuthMethod: 'oauth',
      eventbriteOAuthConnectedAt: new Date().toISOString(),
    };
    if (groupId) configPatch.defaultImportGroupId = groupId;

    let conn = await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', configPatch);

    const webhookSite = webhookPublicSite(siteBase());
    const endpointUrl = buildProviderWebhookPublicUrl(
      webhookSite,
      'eventbrite',
      conn.webhook_token
    );

    let webhookEnsure = null;
    try {
      webhookEnsure = await ensureEventbriteAttendeeWebhook(
        eventbritePrivateTokenFromConfig(conn.config),
        endpointUrl
      );
    } catch (e) {
      webhookEnsure = { ok: false, reason: e.message || 'webhook_ensure_failed' };
    }

    let attendeeSync = null;
    try {
      attendeeSync = await syncEventbriteAttendeesForConnection({
        sb,
        connection: Object.assign({}, conn, { organiser_account_id: accountId }),
        endpointUrl,
        force: true,
      });
    } catch (e) {
      attendeeSync = { ok: false, reason: e.message || 'attendee_sync_failed' };
    }

    let orgSync = null;
    try {
      orgSync = await syncEventbriteOrgEventsForAccount(sb, {
        accountId: accountId,
        groupId: groupId,
        account: account,
        editorEmail: state.email || (account && account.email) || '',
        session: {
          email: String(state.email || (account && account.email) || '').trim().toLowerCase(),
          sub: String(state.sub || state.email || '').trim(),
        },
        source: 'oauth_connect',
        maxCreate: 25,
      });
    } catch (e) {
      orgSync = {
        ok: false,
        error: e.code || e.message || 'org_sync_failed',
        message: e.message,
      };
    }

    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'connected',
      eb_imported: orgSync && orgSync.created != null ? String(orgSync.created) : '0',
      eb_published: orgSync && orgSync.published != null ? String(orgSync.published) : '0',
      eb_webhook: webhookEnsure && webhookEnsure.ok ? '1' : '0',
      eb_attendees: attendeeSync && attendeeSync.ok ? '1' : '0',
    });
  } catch (e) {
    return redirectWithQuery(res, returnPath, {
      eb_oauth: 'error',
      eb_error: e.code || e.message || 'oauth_failed',
    });
  }
};
