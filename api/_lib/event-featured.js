/**
 * Paid featured event listings — plans, activation, expiry, and reminder emails.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { isEventStarted } = require('./event-timezone');
const {
  FEATURED_PLANS,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
  previewFeaturedPlacement,
  calculateFeaturedListingQuote,
} = require('./event-featured-plans');
const {
  fetchSeriesPeerRows,
  upcomingBrowseRows,
  seriesFeaturedStartCap,
  isSeriesLiveOnBrowse,
  seriesFeaturedUntil,
  seriesSpotlightBucketKey,
} = require('./event-series-peers');

const REMINDER_DAYS = 2;
const REMINDER_WINDOW_HOURS = 12;

function siteBaseUrl() {
  return String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

async function getEventRow(eventId) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function activateEventFeatured(eventId, planId, opts = {}) {
  const id = String(eventId || '').trim();
  const resolvedPlanId = normalizePlanId(planId);
  const plan = FEATURED_PLANS[resolvedPlanId];
  if (!isUuid(id)) throw new Error('invalid_event_id');
  if (!plan) throw new Error('invalid_plan');

  const sb = getSupabaseAdmin();
  const current = await getEventRow(id);
  if (!current) throw new Error('event_not_found');

  const peers = await fetchSeriesPeerRows(sb, current);
  const eventStartsAt = seriesFeaturedStartCap(peers) || current.starts_at;
  const currentUntil = seriesFeaturedUntil(peers) || current.featured_until;

  const quote = calculateFeaturedListingQuote({
    currentUntil,
    planId: resolvedPlanId,
    eventStartsAt,
  });
  const featured_until = quote.featuredUntil;
  const amountGbp =
    opts.amountGbp != null && Number.isFinite(Number(opts.amountGbp))
      ? Number(opts.amountGbp)
      : quote.amountPence / 100;
  const paidAt = new Date().toISOString();
  const patch = {
    featured: true,
    featured_until,
    featured_expiry_reminder_sent_at: null,
    featured_plan: resolvedPlanId,
    featured_paid_at: paidAt,
    featured_amount_gbp: amountGbp,
  };

  const targetIds = peers.filter((row) => isPublishedApprovedRow(row)).map((row) => row.id);
  if (!targetIds.length) targetIds.push(id);

  const { data, error } = await sb.from('events').update(patch).in('id', targetIds).select('*');
  if (error) throw new Error(error.message);
  const anchor = (data || []).find((row) => row.id === id) || (data || [])[0];
  if (!anchor) throw new Error('event_not_found');
  return {
    event: anchor,
    featuredUntil: featured_until,
    cappedByEvent: quote.cappedByEvent,
    amountGbp,
    pricingMode: quote.pricingMode,
    plan: planId,
    seriesEventIds: targetIds,
  };
}

function isPublishedApprovedRow(row) {
  if (!row) return false;
  if (row.approval_status !== 'Approved') return false;
  return String(row.status || 'published').toLowerCase() === 'published';
}

async function handleEventFeaturedCheckout(session) {
  const metadata = session?.metadata || {};
  if (metadata.checkout_type !== 'event_featured') {
    return { skipped: true, reason: 'not_event_featured' };
  }

  const eventId = String(metadata.event_id || '').trim();
  const planId = normalizePlanId(metadata.featured_plan);
  if (!eventId || !planId) return { skipped: true, reason: 'missing_metadata' };

  const paid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete';
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  const result = await activateEventFeatured(eventId, planId, {
    amountGbp: paidAmountGbpFromSession(session),
  });
  return {
    ok: true,
    eventId,
    featuredUntil: result.featuredUntil,
    cappedByEvent: result.cappedByEvent,
    amountGbp: result.amountGbp,
    pricingMode: result.pricingMode,
    plan: planId,
  };
}

function paidAmountGbpFromSession(session) {
  const metadata = session?.metadata || {};
  const fromMeta = parseInt(String(metadata.featured_amount_pence || ''), 10);
  if (Number.isFinite(fromMeta) && fromMeta >= 0) return fromMeta / 100;
  const total = Number(session?.amount_total);
  if (Number.isFinite(total) && total >= 0) return total / 100;
  return undefined;
}

async function deactivateFeaturedForStartedEvents(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('events')
    .select(
      'id, starts_at, series_group_id, organiser_id, title, status, approval_status, recurrence_pattern, recurrence_end_date'
    )
    .eq('featured', true)
    .not('starts_at', 'is', null)
    .lte('starts_at', now);
  if (error) throw new Error(error.message);

  const idsToClear = new Set();
  const processed = new Set();

  for (const row of data || []) {
    if (!isEventStarted(row)) continue;
    const bucket = seriesSpotlightBucketKey(row);
    if (processed.has(bucket)) continue;
    processed.add(bucket);

    const peers = await fetchSeriesPeerRows(client, row);
    if (isSeriesLiveOnBrowse(peers)) continue;

    peers.filter((peer) => peer.featured).forEach((peer) => idsToClear.add(peer.id));
  }

  const ids = [...idsToClear];
  if (!ids.length) return { cleared: 0, ids: [] };

  const { data: updated, error: updateError } = await client
    .from('events')
    .update({ featured: false })
    .in('id', ids)
    .select('id');
  if (updateError) throw new Error(updateError.message);
  return { cleared: (updated || []).length, ids: (updated || []).map((row) => row.id) };
}

async function syncSeriesFeaturedPeers(sb) {
  const client = sb || getSupabaseAdmin();
  const { data, error } = await client
    .from('events')
    .select(
      'id, series_group_id, organiser_id, title, status, approval_status, starts_at, recurrence_pattern, recurrence_end_date, featured, featured_until, featured_plan, featured_paid_at, featured_amount_gbp'
    )
    .eq('featured', true);
  if (error) throw new Error(error.message);

  const processed = new Set();
  let synced = 0;

  for (const row of data || []) {
    const bucket = seriesSpotlightBucketKey(row);
    if (processed.has(bucket)) continue;
    processed.add(bucket);

    const peers = await fetchSeriesPeerRows(client, row);
    const anchor =
      [...peers]
        .filter((peer) => peer.featured && peer.featured_until)
        .sort((a, b) => new Date(b.featured_until) - new Date(a.featured_until))[0] || row;

    if (!isEventCurrentlyFeatured(anchor)) continue;

    const patch = {
      featured: true,
      featured_until: anchor.featured_until,
      featured_plan: anchor.featured_plan,
      featured_paid_at: anchor.featured_paid_at,
      featured_amount_gbp: anchor.featured_amount_gbp,
    };

    const upcomingIds = upcomingBrowseRows(peers).map((peer) => peer.id);
    const needSync = upcomingIds.filter((peerId) => {
      const peer = peers.find((item) => item.id === peerId);
      return !peer?.featured || peer.featured_until !== anchor.featured_until;
    });

    if (!needSync.length) continue;

    const { error: updateError } = await client.from('events').update(patch).in('id', needSync);
    if (updateError) throw new Error(updateError.message);
    synced += needSync.length;
  }

  return { synced };
}

async function expireFeaturedEvents(sb) {
  const client = sb || getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('events')
    .update({ featured: false })
    .eq('featured', true)
    .not('featured_until', 'is', null)
    .lt('featured_until', now)
    .select('id');
  if (error) throw new Error(error.message);
  return { expired: (data || []).length, ids: (data || []).map((r) => r.id) };
}

function formatExpiryDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function sendFeaturedExpiryReminders(sb) {
  const client = sb || getSupabaseAdmin();
  const now = Date.now();
  const targetMs = now + REMINDER_DAYS * 24 * 60 * 60 * 1000;
  const windowMs = REMINDER_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(targetMs - windowMs / 2).toISOString();
  const windowEnd = new Date(targetMs + windowMs / 2).toISOString();

  const { data: events, error } = await client
    .from('events')
    .select('id, title, slug, featured_until, starts_at, organiser_id, featured_expiry_reminder_sent_at')
    .eq('featured', true)
    .is('featured_expiry_reminder_sent_at', null)
    .gte('featured_until', windowStart)
    .lte('featured_until', windowEnd);
  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };
  const siteUrl = siteBaseUrl();

  for (const event of events || []) {
    const peers = await fetchSeriesPeerRows(client, event);
    if (!isSeriesLiveOnBrowse(peers)) {
      result.skipped += 1;
      continue;
    }

    let organiserEmail = '';
    let organiserName = '';
    if (event.organiser_id) {
      const orgRes = await client
        .from('organisers')
        .select('id, name, email')
        .eq('id', event.organiser_id)
        .maybeSingle();
      if (orgRes.error) {
        result.errors.push({ eventId: event.id, error: orgRes.error.message });
        continue;
      }
      organiserEmail = String(orgRes.data?.email || '').trim().toLowerCase();
      organiserName = String(orgRes.data?.name || '').trim();
    }

    if (!organiserEmail) {
      result.skipped += 1;
      continue;
    }

    const extendUrl =
      siteUrl +
      '/organiser/event-published?ids=' +
      encodeURIComponent(event.id) +
      '&extend=featured';

    try {
      await sendTemplatedEmail({
        slug: 'organiser_featured_expiry_reminder',
        to: organiserEmail,
        variables: {
          organiser_name: organiserName || 'there',
          event_name: String(event.title || 'your event').trim(),
          expiry_date: formatExpiryDate(event.featured_until),
          extend_url: extendUrl,
        },
      });

      const { error: markError } = await client
        .from('events')
        .update({ featured_expiry_reminder_sent_at: new Date().toISOString() })
        .eq('id', event.id);
      if (markError) throw new Error(markError.message);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') {
        result.skipped += 1;
      } else {
        result.errors.push({ eventId: event.id, error: e.message || String(e) });
      }
    }
  }

  return result;
}

async function runFeaturedListingMaintenance(sb) {
  const synced = await syncSeriesFeaturedPeers(sb);
  const started = await deactivateFeaturedForStartedEvents(sb);
  const expired = await expireFeaturedEvents(sb);
  const reminders = await sendFeaturedExpiryReminders(sb);
  return { synced, started, expired, reminders };
}

module.exports = {
  FEATURED_PLANS,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
  previewFeaturedPlacement,
  calculateFeaturedListingQuote,
  activateEventFeatured,
  handleEventFeaturedCheckout,
  deactivateFeaturedForStartedEvents,
  syncSeriesFeaturedPeers,
  expireFeaturedEvents,
  sendFeaturedExpiryReminders,
  runFeaturedListingMaintenance,
};
