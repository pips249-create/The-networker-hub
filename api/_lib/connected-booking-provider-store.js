const { isConnectedBookingProviderId } = require('./connected-booking-providers');
const { newWebhookToken } = require('./provider-webhook-url');

function isMissingProviderTablesError(err) {
  const msg = [err?.message, err?.details, err?.code].filter(Boolean).join(' ');
  return /connected_booking_event_links|connected_booking_provider_connections|does not exist|PGRST204|schema cache/i.test(
    msg
  );
}

async function ensureProviderConnection(sb, accountId, provider, opts) {
  const rotateToken = opts && opts.rotateToken;
  if (!isConnectedBookingProviderId(provider) || provider === 'custom') {
    const e = new Error('invalid_provider');
    e.status = 400;
    throw e;
  }
  const { data: existing, error: readErr } = await sb
    .from('connected_booking_provider_connections')
    .select('id, organiser_account_id, provider, status, webhook_token, config, created_at, updated_at')
    .eq('organiser_account_id', accountId)
    .eq('provider', provider)
    .maybeSingle();
  if (readErr) {
    if (isMissingProviderTablesError(readErr)) {
      const e = new Error('Run Supabase migration 299_connected_booking_provider_links.sql.');
      e.status = 503;
      e.code = 'connected_booking_provider_schema_missing';
      throw e;
    }
    throw new Error(readErr.message);
  }
  if (existing?.id) {
    if (rotateToken && existing.webhook_token) {
      const token = newWebhookToken();
      const prevConfig =
        existing.config && typeof existing.config === 'object' ? existing.config : {};
      const nextConfig = Object.assign({}, prevConfig, {
        webhookTokenPrevious: String(existing.webhook_token || '').trim(),
        webhookTokenRotatedAt: new Date().toISOString(),
      });
      const { data: updated, error: upErr } = await sb
        .from('connected_booking_provider_connections')
        .update({
          webhook_token: token,
          config: nextConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id, organiser_account_id, provider, status, webhook_token, config, created_at, updated_at')
        .single();
      if (upErr) throw new Error(upErr.message);
      return updated;
    }
    return existing;
  }

  const token = newWebhookToken();
  const { data: inserted, error: insErr } = await sb
    .from('connected_booking_provider_connections')
    .insert({
      organiser_account_id: accountId,
      provider,
      status: 'active',
      webhook_token: token,
      config: {},
    })
    .select('id, organiser_account_id, provider, status, webhook_token, config, created_at, updated_at')
    .single();
  if (insErr) throw new Error(insErr.message);
  return inserted;
}

async function listProviderConnections(sb, accountId) {
  const { data, error } = await sb
    .from('connected_booking_provider_connections')
    .select('id, provider, status, webhook_token, config, created_at, updated_at')
    .eq('organiser_account_id', accountId);
  if (error) {
    if (isMissingProviderTablesError(error)) {
      return { connections: [], schemaMissing: true };
    }
    throw new Error(error.message);
  }
  return { connections: data || [], schemaMissing: false };
}

async function findEventLinkByExternal(sb, provider, externalEventId, organiserAccountId) {
  const ext = String(externalEventId || '').trim();
  if (!ext) return null;
  const accountId = String(organiserAccountId || '').trim();

  function baseQuery() {
    let q = sb
      .from('connected_booking_event_links')
      .select(
        'id, organiser_account_id, event_id, provider, external_event_id, external_event_url, metadata'
      )
      .eq('provider', provider);
    if (accountId) q = q.eq('organiser_account_id', accountId);
    return q;
  }

  const { data: linkRows, error } = await baseQuery()
    .eq('external_event_id', ext)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) {
    if (isMissingProviderTablesError(error)) return null;
    throw new Error(error.message);
  }
  const data = linkRows && linkRows[0] ? linkRows[0] : null;
  if (data?.event_id) return data;

  if (provider !== 'eventbrite' || !accountId) return null;

  const { parseEventbriteEventIdFromUrl } = require('./connected-booking-util');
  const { data: links, error: listErr } = await baseQuery();
  if (listErr) {
    if (isMissingProviderTablesError(listErr)) return null;
    throw new Error(listErr.message);
  }
  for (const row of links || []) {
    if (String(row.external_event_id || '').trim() === ext) return row;
    const fromUrl = parseEventbriteEventIdFromUrl(row.external_event_url);
    if (fromUrl && fromUrl === ext) return row;
  }
  return null;
}

async function upsertEventLink(sb, accountId, input) {
  const eventId = String(input.eventId || '').trim();
  const provider = String(input.provider || '').trim().toLowerCase();
  let externalEventId = String(input.externalEventId || input.external_event_id || '').trim();
  const externalEventUrl = String(input.externalEventUrl || input.external_event_url || '').trim() || null;

  if (provider === 'own_site' && eventId && !externalEventId) {
    externalEventId = eventId;
  }

  if (!eventId || !provider || !externalEventId) {
    const e = new Error('event_id, provider, and external_event_id are required.');
    e.status = 400;
    e.code = 'invalid_event_link';
    throw e;
  }
  if (!isConnectedBookingProviderId(provider) || provider === 'custom') {
    const e = new Error('invalid_provider');
    e.status = 400;
    throw e;
  }

  const ev = await sb.from('events').select('id, organiser_id').eq('id', eventId).maybeSingle();
  if (ev.error) throw new Error(ev.error.message);
  if (!ev.data?.id) {
    const e = new Error('event_not_found');
    e.status = 404;
    throw e;
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('connected_booking_event_links')
    .upsert(
      {
        organiser_account_id: accountId,
        event_id: eventId,
        provider,
        external_event_id: externalEventId,
        external_event_url: externalEventUrl,
        updated_at: now,
      },
      { onConflict: 'event_id' }
    )
    .select('id, event_id, provider, external_event_id, external_event_url, metadata, updated_at')
    .single();
  if (error) {
    if (isMissingProviderTablesError(error)) {
      const e = new Error('Run Supabase migration 299_connected_booking_provider_links.sql.');
      e.status = 503;
      e.code = 'connected_booking_provider_schema_missing';
      throw e;
    }
    throw new Error(error.message);
  }
  return data;
}

async function listEventLinksForAccount(sb, accountId) {
  const { data, error } = await sb
    .from('connected_booking_event_links')
    .select('id, event_id, provider, external_event_id, external_event_url, metadata, updated_at')
    .eq('organiser_account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingProviderTablesError(error)) return { links: [], schemaMissing: true };
    throw new Error(error.message);
  }
  return { links: data || [], schemaMissing: false };
}

async function mergeProviderConnectionConfig(sb, accountId, provider, configPatch) {
  const conn = await ensureProviderConnection(sb, accountId, provider);
  const prev = conn.config && typeof conn.config === 'object' ? conn.config : {};
  const next = Object.assign({}, prev, configPatch || {});
  const { data: updated, error } = await sb
    .from('connected_booking_provider_connections')
    .update({ config: next, updated_at: new Date().toISOString() })
    .eq('id', conn.id)
    .select('id, organiser_account_id, provider, status, webhook_token, config, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return updated;
}

async function deleteEventLink(sb, accountId, eventId) {
  const { error } = await sb
    .from('connected_booking_event_links')
    .delete()
    .eq('organiser_account_id', accountId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

function webhookTokenPreviousFromConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  return String(c.webhookTokenPrevious || c.webhook_token_previous || '').trim();
}

async function resolveConnectionByToken(sb, provider, token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const { data, error } = await sb
    .from('connected_booking_provider_connections')
    .select('id, organiser_account_id, provider, status, webhook_token, config')
    .eq('provider', provider)
    .eq('webhook_token', t)
    .eq('status', 'active')
    .maybeSingle();
  if (error) {
    if (isMissingProviderTablesError(error)) return null;
    throw new Error(error.message);
  }
  if (data?.organiser_account_id) return data;

  const { data: activeRows, error: listErr } = await sb
    .from('connected_booking_provider_connections')
    .select('id, organiser_account_id, provider, status, webhook_token, config')
    .eq('provider', provider)
    .eq('status', 'active');
  if (listErr) {
    if (isMissingProviderTablesError(listErr)) return null;
    throw new Error(listErr.message);
  }
  for (const row of activeRows || []) {
    if (webhookTokenPreviousFromConfig(row.config) === t) return row;
  }
  return null;
}

module.exports = {
  ensureProviderConnection,
  listProviderConnections,
  findEventLinkByExternal,
  upsertEventLink,
  listEventLinksForAccount,
  deleteEventLink,
  resolveConnectionByToken,
  mergeProviderConnectionConfig,
  webhookTokenPreviousFromConfig,
  isMissingProviderTablesError,
};
