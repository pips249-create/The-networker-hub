/**
 * Hub-created events published by non-staff / non-admin users.
 * Used by Command Centre analytics and scripts/list-external-user-published-events.js.
 */
const { isStaffFoundingExcludedEmail } = require('./founding-organiser');

const STAFF_EMAILS = new Set(
  [
    'pips249@gmail.com',
    'rosie@the-networker.co.uk',
    'rosie@thenetworkerhub.com',
    'rosie@thenetworkeruk.com',
    'rosie.mcgilvray@yahoo.co.uk',
    'jamie@thenetworkerhub.com',
    'jamie@thenetworkeruk.com',
    'catherine@thenetworkerhub.com',
    'catherine@thenetworkeruk.com',
  ].map((e) => e.toLowerCase())
);

function isStaffEmail(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  return !e || STAFF_EMAILS.has(e) || isStaffFoundingExcludedEmail(e);
}

function isHubCreatedEvent(row) {
  const airtableId = String(row?.airtable_id || '').trim();
  if (!airtableId) return true;
  if (airtableId.startsWith('seed-browse-')) return false;
  return false;
}

function isStaffOrganiserRow(row) {
  if (!row) return true;
  if (row.is_internal || row.is_walkthrough_demo) return true;
  return [row.contact_email, row.email].some((e) => isStaffEmail(e));
}

function pickPublishActorRow(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const publishish = list.find((r) =>
    /publish|status_updated|tickets_published|created/i.test(
      String(r.action || '') + ' ' + String(r.summary || '')
    )
  );
  return publishish || list[0] || null;
}

async function loadAdminUserIds(sb) {
  const { data, error } = await sb.from('hub_accounts').select('user_id, role').eq('role', 'admin');
  if (error) throw new Error(error.message);
  return new Set((data || []).map((r) => r.user_id).filter(Boolean));
}

async function loadOrganisersById(sb, organiserIds) {
  const map = new Map();
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await sb
      .from('organisers')
      .select(
        'id, name, slug, email, contact_email, organiser_account_id, supabase_user_id, is_internal, is_walkthrough_demo, ownership_claim_status, ownership_claimed_at'
      )
      .in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => map.set(row.id, row));
  }
  return map;
}

async function loadOrganiserAccountEmails(sb, accountIds) {
  const map = new Map();
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await sb.from('organiser_accounts').select('id, email').in('id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (row.id) map.set(row.id, String(row.email || '').trim().toLowerCase());
    });
  }
  return map;
}

async function loadPublishActorsByEventId(sb, eventIds) {
  const map = new Map();
  const ids = [...new Set((eventIds || []).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const { data, error } = await sb
      .from('entity_activity_log')
      .select('entity_id, actor_email, actor_user_id, actor_role, created_at, action, summary')
      .eq('entity_type', 'event')
      .in('entity_id', chunk)
      .order('created_at', { ascending: true });
    if (error) {
      if (/entity_activity_log|does not exist/i.test(error.message || '')) return map;
      throw new Error(error.message);
    }
    (data || []).forEach((row) => {
      const id = row.entity_id;
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    });
  }
  const out = new Map();
  map.forEach((rows, eventId) => out.set(eventId, pickPublishActorRow(rows)));
  return out;
}

async function resolveOwnerEmail(org, accountEmails, sb) {
  const row = org || {};
  for (const raw of [row.contact_email, row.email]) {
    const e = String(raw || '')
      .trim()
      .toLowerCase();
    if (e) return e;
  }
  const accountId = row.organiser_account_id;
  if (accountId && accountEmails.has(accountId)) return accountEmails.get(accountId);
  if (row.supabase_user_id) {
    try {
      const { data } = await sb.auth.admin.getUserById(row.supabase_user_id);
      if (data?.user?.email) return String(data.user.email).trim().toLowerCase();
    } catch {
      /* ignore */
    }
  }
  return '';
}

function mapExternalRow(ev, org, actor, ownerEmail) {
  return {
    id: ev.id,
    title: String(ev.title || '').trim() || 'Untitled',
    slug: String(ev.slug || '').trim(),
    startsAt: ev.starts_at || null,
    publishedAt: ev.published_at || ev.created_at || null,
    seriesGroupId: ev.series_group_id || null,
    organiserId: ev.organiser_id || null,
    organiser: org ? String(org.name || '').trim() : '',
    organiserSlug: org ? String(org.slug || '').trim() : '',
    ownershipClaimStatus: org ? org.ownership_claim_status || null : null,
    publishActorEmail: actor?.actor_email ? String(actor.actor_email).trim().toLowerCase() : null,
    publishActorRole: actor?.actor_role || null,
    ownerEmail: ownerEmail || null,
    ticketSalesEnabled: ev.ticket_sales_enabled === true,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ upcomingOnly?: boolean, limit?: number, q?: string }} [options]
 */
async function listExternalUserPublishedEvents(sb, options = {}) {
  const upcomingOnly = options.upcomingOnly !== false;
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 2000);
  const q = String(options.q || '')
    .trim()
    .toLowerCase();

  const nowIso = new Date().toISOString();

  let query = sb
    .from('events')
    .select(
      'id, title, slug, starts_at, status, approval_status, organiser_id, airtable_id, published_at, created_at, series_group_id, ticket_sales_enabled'
    )
    .eq('approval_status', 'Approved')
    .eq('status', 'published')
    .is('airtable_id', null)
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(limit * 4);

  if (upcomingOnly) query = query.gt('starts_at', nowIso);

  const [{ data: hubEvents, error: eventsErr }, adminUserIds, importedUpcomingRes, hubUpcomingRes] =
    await Promise.all([
      query,
      loadAdminUserIds(sb),
      sb
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'Approved')
        .eq('status', 'published')
        .gt('starts_at', nowIso)
        .not('airtable_id', 'is', null),
      upcomingOnly
        ? sb
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('approval_status', 'Approved')
            .eq('status', 'published')
            .gt('starts_at', nowIso)
            .is('airtable_id', null)
        : Promise.resolve({ count: null }),
    ]);

  if (eventsErr) throw new Error(eventsErr.message);

  const events = (hubEvents || []).filter(isHubCreatedEvent);
  const organiserIds = events.map((e) => e.organiser_id).filter(Boolean);
  const [organisersById, publishActorsByEventId] = await Promise.all([
    loadOrganisersById(sb, organiserIds),
    loadPublishActorsByEventId(
      sb,
      events.map((e) => e.id)
    ),
  ]);

  const accountIds = [...organisersById.values()]
    .map((o) => o.organiser_account_id)
    .filter(Boolean);
  const accountEmails = await loadOrganiserAccountEmails(sb, accountIds);

  const external = [];
  const excluded = [];

  for (const ev of events) {
    const org = organisersById.get(ev.organiser_id) || null;
    if (isStaffOrganiserRow(org)) {
      excluded.push({ reason: 'staff_or_internal_organiser', eventId: ev.id, title: ev.title });
      continue;
    }

    const actor = publishActorsByEventId.get(ev.id) || null;
    const actorEmail = String(actor?.actor_email || '')
      .trim()
      .toLowerCase();
    const actorIsAdmin =
      actor?.actor_role === 'admin' ||
      (actor?.actor_user_id && adminUserIds.has(actor.actor_user_id));

    if (actorEmail && (isStaffEmail(actorEmail) || actorIsAdmin)) {
      excluded.push({ reason: 'staff_publish_actor', eventId: ev.id, title: ev.title, actorEmail });
      continue;
    }

    const ownerEmail = await resolveOwnerEmail(org, accountEmails, sb);
    if (!actorEmail && ownerEmail && isStaffEmail(ownerEmail)) {
      excluded.push({ reason: 'staff_owner_email', eventId: ev.id, title: ev.title, ownerEmail });
      continue;
    }

    const row = mapExternalRow(ev, org, actor, ownerEmail);
    if (q) {
      const hay = [row.title, row.organiser, row.slug, row.publishActorEmail, row.ownerEmail]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    external.push(row);
    if (external.length >= limit) break;
  }

  return {
    summary: {
      upcomingOnly,
      browseUpcomingTotal:
        upcomingOnly && importedUpcomingRes?.count != null && hubUpcomingRes?.count != null
          ? Number(importedUpcomingRes.count) + Number(hubUpcomingRes.count)
          : null,
      importedUpcoming: importedUpcomingRes?.count ?? null,
      hubCreatedUpcoming: hubUpcomingRes?.count ?? null,
      hubCreatedQueried: events.length,
      externalUserPublished: external.length,
      excludedStaffOrInternal: excluded.length,
      staffEmailsExcluded: [...STAFF_EMAILS],
    },
    events: external,
    excludedSample: excluded.slice(0, 20),
  };
}

module.exports = {
  STAFF_EMAILS,
  isStaffEmail,
  isHubCreatedEvent,
  isStaffOrganiserRow,
  listExternalUserPublishedEvents,
};
