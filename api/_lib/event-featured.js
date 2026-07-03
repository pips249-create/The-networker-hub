/**
 * Paid featured event listings — plans, activation, expiry, and reminder emails.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const {
  FEATURED_PLANS,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
} = require('./event-featured-plans');

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

async function activateEventFeatured(eventId, planId) {
  const id = String(eventId || '').trim();
  const resolvedPlanId = normalizePlanId(planId);
  const plan = FEATURED_PLANS[resolvedPlanId];
  if (!isUuid(id)) throw new Error('invalid_event_id');
  if (!plan) throw new Error('invalid_plan');

  const current = await getEventRow(id);
  if (!current) throw new Error('event_not_found');

  const featured_until = computeFeaturedUntil(current.featured_until, plan.days);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .update({
      featured: true,
      featured_until,
      featured_expiry_reminder_sent_at: null,
      featured_plan: resolvedPlanId,
      featured_paid_at: new Date().toISOString(),
      featured_amount_gbp: plan.amountPence / 100,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { event: data, featuredUntil: featured_until, plan: planId };
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

  const result = await activateEventFeatured(eventId, planId);
  return { ok: true, eventId, featuredUntil: result.featuredUntil, plan: planId };
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
    .select('id, title, slug, featured_until, organiser_id, featured_expiry_reminder_sent_at')
    .eq('featured', true)
    .is('featured_expiry_reminder_sent_at', null)
    .gte('featured_until', windowStart)
    .lte('featured_until', windowEnd);
  if (error) throw new Error(error.message);

  const result = { sent: 0, skipped: 0, errors: [] };
  const siteUrl = siteBaseUrl();

  for (const event of events || []) {
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
      '/organiser/event-published.html?ids=' +
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
  const expired = await expireFeaturedEvents(sb);
  const reminders = await sendFeaturedExpiryReminders(sb);
  return { expired, reminders };
}

module.exports = {
  FEATURED_PLANS,
  normalizePlanId,
  isEventCurrentlyFeatured,
  computeFeaturedUntil,
  activateEventFeatured,
  handleEventFeaturedCheckout,
  expireFeaturedEvents,
  sendFeaturedExpiryReminders,
  runFeaturedListingMaintenance,
};
