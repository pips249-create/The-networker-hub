/**
 * Auto-import Eventbrite organisation events onto a Connected organiser page.
 *
 * Criteria (existing product rules — do not invent new ones):
 * - Create/link via createEventFromEventbrite
 * - Complete listings (date + booking URL + price) auto-publish when kill switch allows
 * - Incomplete listings stay drafts
 *
 * Auto-import only pulls Eventbrite events with status live or started
 * (not Eventbrite drafts). Triggered after OAuth/token connect, by cron poll,
 * or by an event.published webhook.
 */
const {
  eventbritePrivateTokenFromConfig,
  listEventbriteOrganizationEvents,
} = require('./connected-booking-providers/adapters/eventbrite-api');
const {
  listProviderConnections,
  mergeProviderConnectionConfig,
} = require('./connected-booking-provider-store');
const { listAssignedSlotOrganiserIds } = require('./connected-booking-slots');
const { createEventFromEventbrite } = require('./eventbrite-listing-import');

const AUTO_IMPORT_STATUSES = 'live,started';

function defaultImportGroupIdFromConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  return String(
    c.defaultImportGroupId || c.default_import_group_id || c.autoImportGroupId || ''
  ).trim();
}

async function resolveAutoImportGroupId(sb, accountId, preferredGroupId, connectionConfig) {
  const preferred = String(preferredGroupId || '').trim();
  if (preferred) return preferred;
  const fromConfig = defaultImportGroupIdFromConfig(connectionConfig);
  if (fromConfig) return fromConfig;
  const assigned = await listAssignedSlotOrganiserIds(sb, accountId);
  if (assigned && assigned.length) return String(assigned[0]);
  const { data: rows } = await sb
    .from('organisers')
    .select('id')
    .eq('organiser_account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1);
  return rows && rows[0] && rows[0].id ? String(rows[0].id) : '';
}

function editorSessionForAccount(accountRow, fallbackEmail) {
  const email = String((accountRow && accountRow.email) || fallbackEmail || '')
    .trim()
    .toLowerCase();
  return {
    email: email || 'eventbrite-sync@thenetworkeruk.com',
    sub: email || 'eventbrite-org-sync',
  };
}

/**
 * Import one Eventbrite event if not already linked.
 */
async function importOneEventbriteOrgEvent(sb, session, accountId, groupId, externalEventId) {
  return createEventFromEventbrite(sb, session, accountId, {
    groupId: groupId,
    externalEventId: String(externalEventId || '').trim(),
  });
}

/**
 * Scan the connected Eventbrite org and create TNH listings for unmatched events.
 */
async function syncEventbriteOrgEventsForAccount(sb, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const accountId = String(options.accountId || '').trim();
  if (!accountId) {
    const e = new Error('missing_account_id');
    e.status = 400;
    e.code = 'missing_account_id';
    throw e;
  }

  const listed = await listProviderConnections(sb, accountId);
  const conn = (listed.connections || []).find(function (row) {
    return row.provider === 'eventbrite';
  });
  const token = eventbritePrivateTokenFromConfig(conn && conn.config);
  if (!token) {
    const e = new Error('Save or connect Eventbrite before syncing events.');
    e.status = 400;
    e.code = 'eventbrite_token_missing';
    throw e;
  }

  const groupId = await resolveAutoImportGroupId(
    sb,
    accountId,
    options.groupId,
    conn && conn.config
  );
  if (!groupId) {
    const e = new Error(
      'Choose an organiser page for Eventbrite imports (or assign a Connected booking slot).'
    );
    e.status = 400;
    e.code = 'missing_group_id';
    throw e;
  }

  if (options.persistDefaultGroup !== false) {
    const currentDefault = defaultImportGroupIdFromConfig(conn && conn.config);
    if (currentDefault !== groupId) {
      await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', {
        defaultImportGroupId: groupId,
      });
    }
  }

  const session =
    options.session ||
    editorSessionForAccount(options.account, options.editorEmail);

  const onlyExternalId = String(options.externalEventId || '').trim();
  const maxCreate = Math.min(50, Math.max(1, Number(options.maxCreate) || 25));

  if (onlyExternalId) {
    const one = await importOneEventbriteOrgEvent(
      sb,
      session,
      accountId,
      groupId,
      onlyExternalId
    );
    return {
      ok: true,
      groupId: groupId,
      scanned: 1,
      created: one.created ? 1 : 0,
      alreadyLinked: one.alreadyLinked ? 1 : 0,
      published: one.published ? 1 : 0,
      results: [one],
      source: options.source || 'single',
    };
  }

  const orgListed = await listEventbriteOrganizationEvents(token, {
    status: options.status || AUTO_IMPORT_STATUSES,
    pageSize: options.pageSize || 25,
    maxPages: options.maxPages || 4,
    organizationId: options.organizationId,
  });

  const results = [];
  let created = 0;
  let alreadyLinked = 0;
  let published = 0;
  const events = Array.isArray(orgListed.events) ? orgListed.events : [];

  for (let i = 0; i < events.length && created < maxCreate; i += 1) {
    const evt = events[i];
    const externalEventId = String(evt && evt.id ? evt.id : '').trim();
    if (!externalEventId) continue;
    try {
      const result = await importOneEventbriteOrgEvent(
        sb,
        session,
        accountId,
        groupId,
        externalEventId
      );
      results.push(result);
      if (result.alreadyLinked) alreadyLinked += 1;
      if (result.created) {
        created += 1;
        if (result.published) published += 1;
      }
    } catch (err) {
      results.push({
        created: false,
        externalEventId: externalEventId,
        error: err.code || err.message || 'import_failed',
        message: err.message,
      });
    }
  }

  await mergeProviderConnectionConfig(sb, accountId, 'eventbrite', {
    lastOrgEventSyncAt: new Date().toISOString(),
    lastOrgEventSyncSource: String(options.source || 'manual').trim() || 'manual',
    lastOrgEventSyncCreated: created,
  });

  return {
    ok: true,
    groupId: groupId,
    organizationId: orgListed.organizationId,
    scanned: events.length,
    created: created,
    alreadyLinked: alreadyLinked,
    published: published,
    results: results,
    source: options.source || 'scan',
  };
}

/**
 * Cron / webhook helper: sync every Eventbrite connection that has a token.
 */
async function syncAllConnectedEventbriteOrgs(sb, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const { data: rows, error } = await sb
    .from('connected_booking_provider_connections')
    .select('id, organiser_account_id, provider, status, webhook_token, config')
    .eq('provider', 'eventbrite')
    .eq('status', 'active');
  if (error) throw new Error(error.message);

  const connections = (rows || []).filter(function (row) {
    return eventbritePrivateTokenFromConfig(row.config);
  });

  const maxAccounts = Math.min(40, Math.max(1, Number(options.maxAccounts) || 20));
  const summary = {
    ok: true,
    accounts: 0,
    created: 0,
    alreadyLinked: 0,
    published: 0,
    errors: [],
  };

  for (let i = 0; i < connections.length && summary.accounts < maxAccounts; i += 1) {
    const conn = connections[i];
    const accountId = String(conn.organiser_account_id || '').trim();
    if (!accountId) continue;
    summary.accounts += 1;
    try {
      const { data: account } = await sb
        .from('organiser_accounts')
        .select('id, email')
        .eq('id', accountId)
        .maybeSingle();
      const result = await syncEventbriteOrgEventsForAccount(sb, {
        accountId: accountId,
        account: account,
        maxCreate: options.maxCreate || 15,
        source: options.source || 'cron',
        persistDefaultGroup: false,
      });
      summary.created += Number(result.created) || 0;
      summary.alreadyLinked += Number(result.alreadyLinked) || 0;
      summary.published += Number(result.published) || 0;
    } catch (err) {
      summary.errors.push({
        accountId: accountId,
        error: err.code || err.message || 'sync_failed',
      });
    }
  }

  return summary;
}

module.exports = {
  AUTO_IMPORT_STATUSES,
  defaultImportGroupIdFromConfig,
  resolveAutoImportGroupId,
  editorSessionForAccount,
  importOneEventbriteOrgEvent,
  syncEventbriteOrgEventsForAccount,
  syncAllConnectedEventbriteOrgs,
};
