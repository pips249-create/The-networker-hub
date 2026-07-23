const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { publicEventSlug } = require('../event-slug');
const { publicOrganiserSlug } = require('../organiser-slug');
const { normalizeEventType } = require('../event-types');
const { eventImageUrl, eventImageDbValue } = require('../event-image');
const { eventHasTicketsOnSale } = require('../ticket-sales');
const { fetchEventRegistrationStats, fetchLatestCancellationsByEventId } = require('../admin-event-commerce');
const { evaluateReinstateEligibility } = require('../admin-event-reinstate');
const { plainEventDescription } = require('../event-description');
const { ukOutcode } = require('../supabase-events');
const { deriveLocationFields } = require('../uk-outcode');
const { geocodeUkPostcode } = require('../postcode-geocode');
const { profileEmail } = require('../supabase-organiser-profile-email');

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

function normalizeOccurrences(body) {
  if (Array.isArray(body.occurrences) && body.occurrences.length) {
    return body.occurrences
      .map((o) => ({
        date: o.date || o.start || o.dateTime || '',
        endDate: o.endDate || o.end || '',
      }))
      .filter((o) => o.date);
  }
  const dates = Array.isArray(body.dates) ? body.dates.filter(Boolean) : [];
  if (dates.length) {
    return dates.map((date) => ({ date, endDate: body.ends_at || body.endDate || '' }));
  }
  const single = body.starts_at || body.date || body.dateTime || '';
  return single ? [{ date: single, endDate: body.ends_at || body.endDate || '' }] : [];
}

function queryFromRequest(req) {
  const q = { ...(req.query || {}) };
  if (req.url) {
    try {
      const url = new URL(req.url, 'https://internal.local');
      url.searchParams.forEach((value, key) => {
        if (q[key] == null || q[key] === '') q[key] = value;
      });
    } catch {
      /* ignore */
    }
  }
  return q;
}

function mapOrganiserOptionRow(o) {
  return {
    id: o.id,
    name: String(o.name || '').trim(),
    email: String(o.contact_email || o.email || '').trim().toLowerCase(),
    listing_status: o.listing_status || '',
    slug: publicOrganiserSlug(o) || '',
    ownership_claim_status: o.ownership_claim_status || '',
  };
}

async function fetchOrganisersByIds(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const all = [];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await sb.from('organisers').select('id, name, listing_status, slug, email, contact_email, ownership_claim_status').in('id', chunk);
    if (res.error) throw new Error(res.error.message);
    all.push(...(res.data || []));
  }

  return all.map(mapOrganiserOptionRow);
}

async function fetchOrganiserOptions(sb) {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const res = await sb
      .from('organisers')
      .select('id, name, listing_status, slug, email, contact_email, ownership_claim_status')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const batch = res.data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all.map(mapOrganiserOptionRow);
}

function mapEventRow(row, orgById, commerceStats, cancellationRow) {
  const org = row.organiser_id ? orgById.get(row.organiser_id) : null;
  const stats = commerceStats && commerceStats[row.id] ? commerceStats[row.id] : null;
  const registrationCount = stats ? stats.registration_count : 0;
  const paidBookingCount = stats ? stats.paid_booking_count : 0;
  const reinstateEligibility = evaluateReinstateEligibility(row, cancellationRow || null, stats || null);
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    photo_url: eventImageUrl(row),
    organiser_id: row.organiser_id || '',
    organiser_name: org ? String(org.name || '').trim() : '',
    organiser_email: org ? profileEmail(org) : '',
    organiser_ownership_status: org ? String(org.ownership_claim_status || '').trim() : '',
    organiser_slug: org ? publicOrganiserSlug(org) || '' : '',
    starts_at: row.starts_at || '',
    ends_at: row.ends_at || '',
    event_type: row.event_type || '',
    meeting_type: row.meeting_type || '',
    status: row.status || '',
    approval_status: row.approval_status || '',
    vat_treatment: row.vat_treatment || '',
    slug: publicEventSlug({ slug: row.slug, title: row.title }),
    city: row.city || '',
    venue: row.venue || '',
    address: row.address || '',
    postcode: row.postcode || '',
    meeting_link: row.meeting_link || '',
    featured: Boolean(row.featured),
    featured_until: row.featured_until || null,
    featuredUntil: row.featured_until || null,
    locked: Boolean(row.locked),
    registration_count: registrationCount,
    paid_booking_count: paidBookingCount,
    cancellation_id: cancellationRow?.id || null,
    refunds_confirmed_at: cancellationRow?.refunds_confirmed_at || null,
    reinstated_at: cancellationRow?.reinstated_at || null,
    removed_by_admin: Boolean(cancellationRow?.removed_by_admin),
    can_reinstate: reinstateEligibility.canReinstate,
    reinstate_blocked_reason: reinstateEligibility.reason || null,
  };
}

async function listEventsForAdmin(query) {
  const sb = getSupabaseAdmin();
  const organiserId = String(query.organiser_id || '').trim();
  const unlinked = query.unlinked === '1' || query.unlinked === 'true';
  const noDate = query.no_date === '1' || query.no_date === 'true';
  const status = String(query.status || '').trim();
  const approvalStatus = String(query.approval_status || '').trim();
  const search = String(query.q || '').trim();
  const sort = String(query.sort || 'recent').trim().toLowerCase();
  const featuredOnly = query.featured === '1' || query.featured === 'true';
  const light =
    query.light === '1' ||
    query.light === 'true' ||
    String(query.view || '').trim().toLowerCase() === 'spotlight';
  const offset = Math.max(parseInt(String(query.offset || ''), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(query.limit || ''), 10) || 40, 1), 100);

  let dbQuery = sb.from('events').select(
    light
      ? 'id, title, organiser_id, starts_at, event_type, slug, city, featured, featured_until'
      : 'id, title, description, image_url, photo_url, organiser_id, starts_at, ends_at, event_type, meeting_type, status, approval_status, vat_treatment, slug, city, venue, address, postcode, meeting_link, featured, featured_until, created_at, locked',
    { count: 'exact' }
  );

  if (sort === 'title') {
    dbQuery = dbQuery.order('title', { ascending: true });
  } else if (sort === 'date') {
    dbQuery = dbQuery.order('starts_at', { ascending: false, nullsFirst: false });
  } else {
    dbQuery = dbQuery.order('created_at', { ascending: false });
  }

  if (unlinked) {
    dbQuery = dbQuery.is('organiser_id', null);
  } else if (organiserId) {
    dbQuery = dbQuery.eq('organiser_id', organiserId);
  }

  if (noDate) {
    dbQuery = dbQuery.is('starts_at', null);
  }

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  if (approvalStatus) {
    dbQuery = dbQuery.eq('approval_status', approvalStatus);
  }

  if (featuredOnly) {
    dbQuery = dbQuery.eq('featured', true);
  }

  if (search) {
    const term = `%${search}%`;
    dbQuery = dbQuery.or(`title.ilike.${term},city.ilike.${term}`);
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const includeOrganisers =
    query.include_organisers === '1' || query.include_organisers === 'true';

  const eventsRes = await dbQuery;
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const rows = eventsRes.data || [];
  const organisers = includeOrganisers
    ? await fetchOrganiserOptions(sb)
    : await fetchOrganisersByIds(
        sb,
        rows.map((row) => row.organiser_id)
      );

  const orgById = new Map(organisers.map((o) => [o.id, o]));
  let commerceStats = null;
  let cancellationsByEvent = null;
  if (!light) {
    commerceStats = await fetchEventRegistrationStats(
      sb,
      rows.map((row) => row.id)
    );
    cancellationsByEvent = await fetchLatestCancellationsByEventId(
      sb,
      rows.map((row) => row.id)
    );
  }
  const events = rows.map((row) =>
    mapEventRow(row, orgById, commerceStats, cancellationsByEvent ? cancellationsByEvent[row.id] || null : null)
  );
  const total = eventsRes.count != null ? eventsRes.count : rows.length;

  let unlinkedCount = 0;
  if (!light) {
    const unlinkedCountRes = await sb
      .from('events')
      .select('id', { count: 'exact', head: true })
      .is('organiser_id', null);
    if (unlinkedCountRes.error) throw new Error(unlinkedCountRes.error.message);
    unlinkedCount = unlinkedCountRes.count || 0;
  }

  return {
    events,
    organisers: light ? [] : organisers,
    count: events.length,
    total,
    offset,
    limit,
    hasMore: offset + events.length < total,
    unlinked_count: unlinkedCount,
  };
}

function eventDetailsFromAdminBody(body) {
  return {
    description: body.description != null ? String(body.description || '').trim() : undefined,
    venue: body.venue != null ? String(body.venue || '').trim() : undefined,
    addressLine1:
      body.address != null
        ? String(body.address || body.address_line1 || '').trim()
        : body.address_line1 != null
          ? String(body.address_line1 || '').trim()
          : undefined,
    city: body.city != null ? String(body.city || '').trim() : undefined,
    postcode: body.postcode != null ? String(body.postcode || '').trim() : undefined,
    photoUrl: body.photo_url != null ? String(body.photo_url || '').trim() : undefined,
    photoBase64: body.photo_base64 || null,
    photoMime: body.photo_mime || null,
    photoFilename: body.photo_filename || null,
  };
}

async function buildEventPatchFromBody(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    patch.title = String(body.title || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = plainEventDescription(body.description) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
    patch.image_url = eventImageDbValue(body.photo_url);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'starts_at')) {
    const raw = body.starts_at;
    patch.starts_at = raw ? new Date(raw).toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'ends_at')) {
    const raw = body.ends_at;
    patch.ends_at = raw ? new Date(raw).toISOString() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'organiser_id')) {
    patch.organiser_id = body.organiser_id ? String(body.organiser_id).trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'unlink_organiser') && body.unlink_organiser) {
    patch.organiser_id = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'event_type')) {
    patch.event_type = normalizeEventType(body.event_type || '');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'meeting_type')) {
    patch.meeting_type = String(body.meeting_type || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'venue')) {
    patch.venue = String(body.venue || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'address') || Object.prototype.hasOwnProperty.call(body, 'address_line1')) {
    patch.address = String(body.address || body.address_line1 || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'city')) {
    patch.city = String(body.city || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'postcode')) {
    const postcode = String(body.postcode || '').trim() || null;
    patch.postcode = postcode;
    patch.outcode = postcode ? ukOutcode(postcode) : null;
    if (postcode) {
      const geo = await geocodeUkPostcode(postcode);
      if (geo) {
        if (geo.latitude != null) patch.latitude = geo.latitude;
        if (geo.longitude != null) patch.longitude = geo.longitude;
        if (!patch.city && geo.city) patch.city = geo.city;
      }
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'venue') ||
    Object.prototype.hasOwnProperty.call(body, 'address') ||
    Object.prototype.hasOwnProperty.call(body, 'address_line1') ||
    Object.prototype.hasOwnProperty.call(body, 'city') ||
    Object.prototype.hasOwnProperty.call(body, 'postcode')
  ) {
    const derived = deriveLocationFields({
      venue: body.venue,
      addressLine1: body.address || body.address_line1,
      city: patch.city != null ? patch.city : body.city,
      postcode: body.postcode,
    });
    patch.location_label = derived.location || derived.city || body.venue || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = String(body.status || '').trim();
    if (status && !['draft', 'published', 'unpublished', 'archived', 'cancelled'].includes(status)) {
      const err = new Error('invalid_status');
      err.status = 400;
      throw err;
    }
    patch.status = status || null;
    if (status === 'published') {
      patch.approval_status = 'Approved';
    } else if (status === 'draft') patch.approval_status = 'Pending Review';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'approval_status')) {
    const approval = String(body.approval_status || '').trim();
    if (approval && !['Pending Review', 'Approved', 'Rejected'].includes(approval)) {
      const err = new Error('invalid_approval_status');
      err.status = 400;
      throw err;
    }
    patch.approval_status = approval || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'featured')) {
    patch.featured = Boolean(body.featured);
    // Admin grants stay until removed — clear paid expiry metadata so the
    // listing counts as live in the spotlight carousel again.
    patch.featured_until = null;
    patch.featured_expiry_reminder_sent_at = null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'vat_treatment')) {
    const vat = String(body.vat_treatment || '').trim();
    if (vat && !['included', 'added'].includes(vat)) {
      const err = new Error('invalid_vat_treatment');
      err.status = 400;
      throw err;
    }
    patch.vat_treatment = vat || null;
  }
  return patch;
}

async function assertCancelledStatusAllowed(sb, eventId) {
  const { data: row, error } = await sb.from('events').select('locked').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  const statsMap = await fetchEventRegistrationStats(sb, [eventId]);
  const stats = statsMap[eventId] || { registration_count: 0 };
  if ((stats.registration_count || 0) > 0 || row?.locked) {
    const err = new Error(
      'Cannot set status to cancelled while registrations exist. Use Cancel event & refund bookings instead.'
    );
    err.status = 400;
    err.code = 'cancelled_requires_refund_flow';
    throw err;
  }
}

async function applyEventPatch(sb, id, patch) {
  const { data: current, error: currentErr } = await sb
    .from('events')
    .select('starts_at, title, status, approval_status, published_at')
    .eq('id', id)
    .maybeSingle();
  if (currentErr) throw new Error(currentErr.message);
  if (!current) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const effectiveStartsAt =
    Object.prototype.hasOwnProperty.call(patch, 'starts_at') ? patch.starts_at : current.starts_at;

  if (!effectiveStartsAt) {
    if (patch.status === 'published' || patch.approval_status === 'Approved') {
      const err = new Error('missing_date');
      err.message = 'Events must have a date before they can be published or approved.';
      err.status = 400;
      throw err;
    }
    patch.status = 'draft';
    patch.approval_status = 'Pending Review';
    patch.ticket_sales_enabled = false;
  }

  const effectiveStatus = patch.status != null ? patch.status : current.status;
  if (String(effectiveStatus || '').trim() === 'published') {
    patch.approval_status = 'Approved';
    if (!Object.prototype.hasOwnProperty.call(patch, 'ticket_sales_enabled')) {
      const { data: ticketRows, error: ticketErr } = await sb
        .from('tickets')
        .select('id, event_id, status, sale_starts_at, sale_ends_at')
        .eq('event_id', id);
      if (ticketErr) throw new Error(ticketErr.message);
      patch.ticket_sales_enabled = (ticketRows || []).length
        ? eventHasTicketsOnSale(ticketRows)
        : false;
    }
  }

  if (patch.status === 'cancelled') {
    await assertCancelledStatusAllowed(sb, id);
  }

  const wasLive =
    String(current.status || '').trim() === 'published' &&
    String(current.approval_status || '').trim() === 'Approved';

  const { data, error } = await sb.from('events').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);

  const isLive =
    String(data.status || '').trim() === 'published' &&
    String(data.approval_status || '').trim() === 'Approved';
  const becameLive = isLive && !wasLive;

  if (becameLive) {
    if (!data.published_at) {
      const publishedAt = new Date().toISOString();
      await sb.from('events').update({ published_at: publishedAt }).eq('id', id);
      data.published_at = publishedAt;
    }
    try {
      const { notifyRosterMembersOfPublishedEvent } = require('../organiser-member-roster');
      notifyRosterMembersOfPublishedEvent(data).catch((err) => {
        console.error('[admin-events] member list new-event email failed', id, err?.message || err);
      });
    } catch (err) {
      console.error('[admin-events] member list notify wiring failed', err?.message || err);
    }
  }

  const organisers = await fetchOrganisersByIds(sb, [data.organiser_id]);
  const orgById = new Map(organisers.map((o) => [o.id, o]));
  const commerceStats = await fetchEventRegistrationStats(sb, [data.id]);
  const cancellationsByEvent = await fetchLatestCancellationsByEventId(sb, [data.id]);
  return mapEventRow(data, orgById, commerceStats, cancellationsByEvent[data.id] || null);
}

async function adminDeleteEvent(sb, eventId, opts) {
  const force = Boolean(opts && opts.force);
  const { data: row, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    return { id: eventId, skipped: true, reason: 'not_found', title: '' };
  }

  const title = String(row.title || '').trim() || 'Untitled';

  if (row.locked && !force) {
    return { id: eventId, skipped: true, reason: 'locked', title };
  }

  const { count, error: regErr } = await sb
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (regErr) throw new Error(regErr.message);
  if (count > 0 && !force) {
    return { id: eventId, skipped: true, reason: 'has_registrations', title, registrationCount: count };
  }

  if (force) {
    const { eventNeedsAdminRemovalFlow, adminRemoveEvent } = require('../admin-event-removal');
    if (eventNeedsAdminRemovalFlow(row, count || 0)) {
      const reason = String(opts?.reason || '').trim();
      if (!reason) {
        return { id: eventId, skipped: true, reason: 'reason_required', title, registrationCount: count || 0 };
      }
      return adminRemoveEvent(sb, eventId, {
        reason,
        details: opts?.details,
        adminUserId: opts?.adminUserId,
      });
    }
  }

  const { snapshotPayoutHistoryBeforeEventDelete } = require('../event-delete-audit');
  await snapshotPayoutHistoryBeforeEventDelete(sb, eventId, title);

  const { error: ticketErr } = await sb.from('tickets').delete().eq('event_id', eventId);
  if (ticketErr) throw new Error(ticketErr.message);

  const { error: delErr } = await sb.from('events').delete().eq('id', eventId);
  if (delErr) throw new Error(delErr.message);

  return { id: eventId, deleted: true, title };
}

async function bulkUpdateEvents(ids, body) {
  const patch = await buildEventPatchFromBody(body);
  if (!Object.keys(patch).length) {
    const err = new Error('no_fields');
    err.status = 400;
    throw err;
  }

  const { ensureOrganiserClaimedForAdminEvent } = require('../supabase-organiser-claims');
  if (patch.organiser_id) {
    await ensureOrganiserClaimedForAdminEvent(patch.organiser_id);
  }

  const sb = getSupabaseAdmin();
  const updated = [];
  const skipped = [];

  for (const id of ids) {
    try {
      const event = await applyEventPatch(sb, id, { ...patch });
      updated.push(event);
    } catch (e) {
      skipped.push({
        id,
        reason: e.message || String(e),
        code: e.message || 'update_failed',
      });
    }
  }

  return { updated: updated.length, skipped, events: updated };
}

async function bulkUnpublishEvents(ids, opts) {
  const sb = getSupabaseAdmin();
  const { ADMIN_REMOVAL_REASONS } = require('../admin-event-removal');
  const { sendOrganiserEventUnpublishedEmail } = require('../admin-event-unpublish-emails');
  const reason = String(opts?.reason || '').trim();
  const details = String(opts?.details || '').trim();
  const notifyOrganiser = opts?.notifyOrganiser !== false;
  if (!reason || !ADMIN_REMOVAL_REASONS.includes(reason)) {
    const e = new Error('Select an unpublish reason');
    e.status = 400;
    throw e;
  }

  const updated = [];
  const skipped = [];

  for (const id of ids) {
    try {
      const { data: row, error: fetchErr } = await sb
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!row) {
        skipped.push({ id, skipped: true, reason: 'not_found', title: '' });
        continue;
      }

      const { error: updateErr } = await sb
        .from('events')
        .update({
          status: 'unpublished',
          ticket_sales_enabled: false,
        })
        .eq('id', id);
      if (updateErr) throw new Error(updateErr.message);

      let organiserEmailResult = null;
      if (notifyOrganiser && reason) {
        try {
          organiserEmailResult = await sendOrganiserEventUnpublishedEmail(sb, {
            eventId: id,
            eventRow: row,
            reason,
            details,
          });
        } catch (e) {
          organiserEmailResult = { sent: false, error: e.message || String(e) };
        }
      }

      updated.push({
        id,
        title: String(row.title || '').trim() || 'Untitled',
        previous_status: row.status || '',
        organiserEmailResult,
      });
    } catch (e) {
      skipped.push({ id, skipped: true, reason: e.message || 'unpublish_failed', title: '' });
    }
  }

  return {
    unpublished: updated.length,
    skipped,
    events: updated,
    titles: updated.map((row) => row.title),
  };
}

async function bulkDeleteEvents(ids, opts) {
  const sb = getSupabaseAdmin();
  const deleted = [];
  const removed = [];
  const skipped = [];

  for (const id of ids) {
    try {
      const result = await adminDeleteEvent(sb, id, opts);
      if (result.deleted) deleted.push(result);
      else if (result.removed) removed.push(result);
      else skipped.push(result);
    } catch (e) {
      skipped.push({ id, skipped: true, reason: e.message || 'delete_failed', title: '' });
    }
  }

  return {
    deleted: deleted.length,
    removed: removed.length,
    skipped,
    titles: [...deleted, ...removed].map((d) => d.title),
    removedSummaries: removed.map((row) => ({
      id: row.id,
      title: row.title,
      paidBookings: row.paidBookings || 0,
      refundsConfirmed: Boolean(row.refundsConfirmed),
      hubSuspended: Boolean(row.moderationResult && row.moderationResult.hubSuspended),
    })),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const data = await listEventsForAdmin(queryFromRequest(req));
      return json(res, 200, { ok: true, ...data });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'list_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const body = parseBody(req);

    if (body.action === 'create') {
      const title = String(body.title || '').trim();
      const organiserId = String(body.organiser_id || '').trim();
      if (!title) return json(res, 400, { error: 'missing_title' });
      if (!organiserId) return json(res, 400, { error: 'missing_organiser_id' });

      try {
        const { createEvent, resolveSeriesGroupId } = require('../supabase-organiser-events');
        const { ensureOrganiserClaimedForAdminEvent } = require('../supabase-organiser-claims');
        await ensureOrganiserClaimedForAdminEvent(organiserId);
        const occ = normalizeOccurrences(body);
        const listingStatus = body.status || 'draft';
        const isDraft = String(listingStatus || '').toLowerCase() === 'draft';
        if (!occ.length && !isDraft) {
          return json(res, 400, { error: 'missing_dates', message: 'Add at least one date before publishing.' });
        }

        const details = eventDetailsFromAdminBody(body);
        const base = {
          title,
          groupId: organiserId,
          type: normalizeEventType(body.event_type || 'Meeting'),
          eventFormat: body.meeting_type || 'In person',
          listingStatus,
          description: details.description != null ? details.description : '',
          venue: details.venue != null ? details.venue : '',
          addressLine1: details.addressLine1 != null ? details.addressLine1 : '',
          city: details.city != null ? details.city : '',
          postcode: details.postcode != null ? details.postcode : '',
          photoUrl: details.photoUrl != null ? details.photoUrl : '',
          photoBase64: details.photoBase64,
          photoMime: details.photoMime,
          photoFilename: details.photoFilename,
        };

        const seriesGroupId = resolveSeriesGroupId(null, occ.length);
        let events;

        if (!occ.length && isDraft) {
          events = [await createEvent({ ...base, date: '', endDate: '' })];
        } else if (occ.length === 1) {
          events = [
            await createEvent({
              ...base,
              seriesGroupId,
              date: occ[0].date,
              endDate: occ[0].endDate,
            }),
          ];
        } else {
          events = [];
          let sharedPhotoUrl = null;
          for (let i = 0; i < occ.length; i += 1) {
            const o = occ[i];
            const slice = {
              ...base,
              seriesGroupId,
              date: o.date,
              endDate: o.endDate,
            };
            if (i > 0) {
              delete slice.photoBase64;
              delete slice.photoMime;
              delete slice.photoFilename;
              if (sharedPhotoUrl) slice.photoUrl = sharedPhotoUrl;
            }
            const ev = await createEvent(slice);
            if (!sharedPhotoUrl && ev.imageUrl) sharedPhotoUrl = ev.imageUrl;
            events.push(ev);
          }
        }

        return json(res, 201, {
          ok: true,
          event: events[0],
          events,
          eventIds: events.map((e) => e.id),
          seriesGroupId: seriesGroupId || events[0]?.seriesGroupId || null,
        });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'create_failed', message: e.message });
      }
    }

    if (body.action === 'bulk_unpublish') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await bulkUnpublishEvents(ids, {
          reason: body.reason,
          details: body.details,
          notifyOrganiser: body.notify_organiser !== false,
        });
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          ok: false,
          error: 'bulk_unpublish_failed',
          message: e.message,
        });
      }
    }

    if (body.action === 'reinstate_event') {
      const eventId = String(body.event_id || body.id || '').trim();
      if (!eventId) return json(res, 400, { error: 'missing_event_id' });
      try {
        const sb = getSupabaseAdmin();
        const { reinstateCancelledEvent } = require('../admin-event-reinstate');
        const result = await reinstateCancelledEvent(sb, eventId, {
          status: body.status,
          adminUserId: session.sub,
        });
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          ok: false,
          error: e.code || 'reinstate_failed',
          message: e.message,
        });
      }
    }

    if (body.action === 'retry_event_refunds') {
      const eventId = String(body.event_id || body.id || '').trim();
      if (!eventId) return json(res, 400, { error: 'missing_event_id' });
      try {
        const sb = getSupabaseAdmin();
        const { retryEventRefunds } = require('../admin-refunds-pending');
        const result = await retryEventRefunds(sb, eventId);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          ok: false,
          error: e.code || 'retry_refunds_failed',
          message: e.message,
        });
      }
    }

    if (body.action === 'bulk_update') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await bulkUpdateEvents(ids, body);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          ok: false,
          error: e.message || 'bulk_update_failed',
          message: e.message,
        });
      }
    }

    if (body.action === 'bulk_delete') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const result = await bulkDeleteEvents(ids, {
          force: Boolean(body.force),
          reason: body.reason,
          details: body.details,
          adminUserId: session.sub,
        });
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'bulk_delete_failed', message: e.message });
      }
    }

    if (body.action === 'ensure_organiser_owner') {
      const organiserId = String(body.organiser_id || '').trim();
      if (!organiserId) return json(res, 400, { error: 'missing_organiser_id' });
      try {
        const { ensureOrganiserClaimedForAdminEvent } = require('../supabase-organiser-claims');
        const result = await ensureOrganiserClaimedForAdminEvent(organiserId);
        return json(res, 200, { ok: true, ...result });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'ensure_owner_failed', message: e.message });
      }
    }

    if (body.action === 'bulk_ensure_organiser_owner') {
      const ids = [
        ...new Set(
          (Array.isArray(body.ids) ? body.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
        ),
      ];
      if (!ids.length) return json(res, 400, { error: 'missing_ids' });
      try {
        const sb = getSupabaseAdmin();
        const { ensureOrganiserClaimedForAdminEvent } = require('../supabase-organiser-claims');
        const { data: rows, error } = await sb.from('events').select('id, organiser_id').in('id', ids);
        if (error) throw new Error(error.message);
        const organiserIds = [
          ...new Set((rows || []).map((row) => row.organiser_id).filter(Boolean)),
        ];
        const results = [];
        for (const organiserId of organiserIds) {
          results.push({
            organiser_id: organiserId,
            ...(await ensureOrganiserClaimedForAdminEvent(organiserId)),
          });
        }
        return json(res, 200, { ok: true, results, organiser_count: organiserIds.length });
      } catch (e) {
        return json(res, 500, {
          ok: false,
          error: 'bulk_ensure_owner_failed',
          message: e.message,
        });
      }
    }

    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { error: 'missing_id' });

    let patch;
    try {
      patch = await buildEventPatchFromBody(body);
    } catch (e) {
      return json(res, e.status || 400, { error: e.message });
    }

    if (!Object.keys(patch).length && !body.photo_base64 && !String(body.organiser_contact_email || body.contact_email || '').trim()) {
      return json(res, 400, { error: 'no_fields' });
    }

    try {
      const sb = getSupabaseAdmin();
      const { ensureOrganiserClaimedForAdminEvent } = require('../supabase-organiser-claims');
      const { applyOrganiserContactEmail } = require('./admin-organisers');
      const organiserContactEmail = String(body.organiser_contact_email || body.contact_email || '').trim();
      let claimOrganiserId = String(body.organiser_id || patch.organiser_id || '').trim();
      if (organiserContactEmail) {
        if (!claimOrganiserId) {
          const { data: existingRow } = await sb
            .from('events')
            .select('organiser_id')
            .eq('id', id)
            .maybeSingle();
          claimOrganiserId = String(existingRow?.organiser_id || '').trim();
        }
        if (claimOrganiserId) {
          await applyOrganiserContactEmail(claimOrganiserId, organiserContactEmail);
        }
      }
      if (claimOrganiserId) {
        await ensureOrganiserClaimedForAdminEvent(claimOrganiserId);
      } else {
        const { data: existingRow } = await sb
          .from('events')
          .select('organiser_id')
          .eq('id', id)
          .maybeSingle();
        if (existingRow?.organiser_id) {
          await ensureOrganiserClaimedForAdminEvent(existingRow.organiser_id);
        }
      }
      if (Object.keys(patch).length) {
        await applyEventPatch(sb, id, patch);
      }
      if (body.photo_base64) {
        const { updateEvent } = require('../supabase-organiser-events');
        const photoPayload = {
          photoBase64: body.photo_base64,
          photoMime: body.photo_mime || '',
          photoFilename: body.photo_filename || '',
        };
        if (Object.prototype.hasOwnProperty.call(body, 'photo_url')) {
          photoPayload.photoUrl = String(body.photo_url || '').trim();
        }
        await updateEvent(id, photoPayload);
      }
      const { data: row, error } = await sb.from('events').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return json(res, 404, { error: 'not_found' });
      const orgById = new Map();
      if (row.organiser_id) {
        const orgs = await fetchOrganisersByIds(sb, [row.organiser_id]);
        orgs.forEach((o) => orgById.set(o.id, o));
      }
      const commerceStats = await fetchEventRegistrationStats(sb, [id]);
      const cancellationsByEvent = await fetchLatestCancellationsByEventId(sb, [id]);
      const event = mapEventRow(row, orgById, commerceStats, cancellationsByEvent[id] || null);
      return json(res, 200, { ok: true, event });
    } catch (e) {
      if (e.message === 'missing_date') {
        return json(res, 400, { error: 'missing_date', message: e.message });
      }
      if (e.message === 'not_found') return json(res, 404, { error: 'not_found' });
      return json(res, 500, { ok: false, error: 'update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
