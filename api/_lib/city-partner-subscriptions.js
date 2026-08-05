/**
 * City Partner Stripe subscriptions — reserve cms_blocks slots and release on cancel.
 */
const { getSupabaseAdmin } = require('./supabase');
const {
  normalizeCitySlugs,
  cityPartnerSlotKey,
  parseCityPartnerSlot,
} = require('./networking-city-partners');
const {
  notifyCityPartnerWaitlistForSlug,
  notifyCityPartnerWaitlistOpeningSoon,
} = require('./city-partner-waitlist');
const { sendCityPartnerPaymentWelcome } = require('./city-partner-emails');

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isCityPartnerMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  if (String(meta.placement || '').trim().toLowerCase() === 'city_partner') return true;
  return Boolean(String(meta.networking_cities || meta.networkingCities || '').trim());
}

function citiesFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return normalizeCitySlugs(meta.networking_cities || meta.networkingCities || '');
}

async function citiesForSubscription(sb, subscription) {
  const fromMeta = citiesFromMetadata(subscription.metadata);
  if (fromMeta.length) return fromMeta;

  const subId = String(subscription.id || '').trim();
  if (!subId) return [];

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  return (rows || [])
    .map((row) => parseCityPartnerSlot(row.slot))
    .filter(Boolean)
    .map((parsed) => parsed.slug);
}

function subscriptionIdFromSession(session) {
  const sub = session?.subscription;
  if (typeof sub === 'string') return sub.trim();
  return String(sub?.id || '').trim();
}

function periodEndIso(subscription) {
  const top = Number(subscription?.current_period_end);
  let ts = Number.isFinite(top) && top > 0 ? top : 0;
  if (!ts) {
    const items = subscription?.items?.data;
    if (Array.isArray(items)) {
      for (const item of items) {
        const itemTs = Number(item?.current_period_end);
        if (Number.isFinite(itemTs) && itemTs > ts) ts = itemTs;
      }
    }
  }
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function reserveCityPartnerSlots(sb, cities, fields) {
  const now = new Date().toISOString();
  const results = [];

  for (const slug of cities) {
    const slot = cityPartnerSlotKey(slug);
    const patch = {
      sponsor_subscription_id: fields.subscriptionId || null,
      sponsor_email: fields.email || null,
      sponsor_available_from: fields.availableFrom || null,
      updated_at: now,
    };
    const { error } = await sb.from('cms_blocks').update(patch).eq('slot', slot);
    if (error) throw new Error(error.message);
    results.push({ slug, slot });
  }

  return results;
}

async function releaseCityPartnerSlotsBySubscription(sb, subscriptionId, options) {
  const subId = String(subscriptionId || '').trim();
  if (!subId) return { released: [] };

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot, sponsor_available_from')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  const slugs = [];
  for (const row of rows || []) {
    const parsed = parseCityPartnerSlot(row.slot);
    if (!parsed) continue;
    slugs.push(parsed.slug);
  }

  if (!slugs.length) return { released: [], skipped: true, reason: 'no_slots' };

  const now = new Date().toISOString();
  for (const row of rows || []) {
    const parsed = parseCityPartnerSlot(row.slot);
    if (!parsed) continue;
    const slug = parsed.slug;
    const slot = cityPartnerSlotKey(slug);
    const { error: updateError } = await sb
      .from('cms_blocks')
      .update({
        sponsor_subscription_id: null,
        sponsor_email: null,
        sponsor_available_from: null,
        active: false,
        updated_at: now,
      })
      .eq('slot', slot);
    if (updateError) throw new Error(updateError.message);

    if (options?.notifyWaitlist !== false) {
      await notifyCityPartnerWaitlistForSlug(slug, {
        sb,
        availableFrom: options?.availableFrom || row.sponsor_available_from || now,
      });
    }
  }

  return { released: slugs };
}

async function handleCityPartnerCheckoutCompleted(session) {
  const metadata = normalizeMeta(session.metadata);
  if (!isCityPartnerMetadata(metadata)) {
    return { skipped: true, reason: 'not_city_partner' };
  }

  const cities = citiesFromMetadata(metadata);
  if (!cities.length) {
    return { skipped: true, reason: 'no_cities' };
  }

  const {
    normalizeCityPartnerTerm,
    addMonthsUtc,
    isPrepaidCityPartnerHoldId,
  } = require('./networking-city-partners');

  const term = normalizeCityPartnerTerm(metadata.term_months || metadata.billing_mode);
  const prepaid =
    term.billingMode === 'prepaid' ||
    String(metadata.billing_mode || '').toLowerCase() === 'prepaid';

  let subscriptionId = subscriptionIdFromSession(session);
  if (!subscriptionId && prepaid) {
    subscriptionId = 'prepaid:' + String(session.id || '').trim();
  }
  if (!subscriptionId) {
    return { skipped: true, reason: 'missing_subscription' };
  }

  const email = String(
    session.customer_details?.email || session.customer_email || metadata.sponsor_email || ''
  )
    .trim()
    .toLowerCase();

  let availableFrom = null;
  if (prepaid || isPrepaidCityPartnerHoldId(subscriptionId)) {
    const months = term.termMonths || parseInt(String(metadata.term_months || '1'), 10) || 1;
    availableFrom = addMonthsUtc(new Date(), months).toISOString();
  }

  const sb = getSupabaseAdmin();
  const reserved = await reserveCityPartnerSlots(sb, cities, {
    subscriptionId,
    email: email || null,
    availableFrom,
  });

  let welcomeEmail = { skipped: true, reason: 'missing_email' };
  if (email) {
    try {
      welcomeEmail = await sendCityPartnerPaymentWelcome({ email, cities });
    } catch (e) {
      /* Slot reservation succeeds even if welcome email fails */
      welcomeEmail = { ok: false, error: e.message || String(e) };
    }
  }

  return {
    ok: true,
    reserved,
    subscriptionId,
    cities,
    welcomeEmail,
    billingMode: prepaid ? 'prepaid' : 'monthly',
    availableFrom,
  };
}

/**
 * Clear prepaid City Partner holds whose term has ended (sponsor_available_from ≤ now).
 */
async function expirePrepaidCityPartnerSlots(sb, now = new Date()) {
  const { listCityPartnerRegions, cityPartnerSlotKey, isPrepaidCityPartnerHoldId, parseAvailableFrom } =
    require('./networking-city-partners');
  const slots = listCityPartnerRegions().map((r) => r.slot);
  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot, sponsor_subscription_id, sponsor_available_from, active')
    .in('slot', slots);
  if (error) throw new Error(error.message);

  const expired = [];
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  for (const row of rows || []) {
    const holdId = String(row.sponsor_subscription_id || '').trim();
    if (!isPrepaidCityPartnerHoldId(holdId)) continue;
    const availableFrom = parseAvailableFrom(row);
    if (!availableFrom || availableFrom.getTime() > nowMs) continue;

    const parsed = parseCityPartnerSlot(row.slot);
    if (!parsed) continue;

    const { error: updateError } = await sb
      .from('cms_blocks')
      .update({
        sponsor_subscription_id: null,
        sponsor_email: null,
        sponsor_available_from: null,
        active: false,
        updated_at: nowIso,
      })
      .eq('slot', cityPartnerSlotKey(parsed.slug));
    if (updateError) throw new Error(updateError.message);

    try {
      await notifyCityPartnerWaitlistForSlug(parsed.slug, {
        sb,
        availableFrom: nowIso,
      });
    } catch (_) {
      /* Waitlist notify is best-effort after expiry cleanup */
    }

    expired.push(parsed.slug);
  }

  return { expired, count: expired.length };
}

async function handleCityPartnerSubscriptionUpdated(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) {
    return { skipped: true, reason: 'missing_subscription' };
  }

  const sb = getSupabaseAdmin();
  const metadata = normalizeMeta(subscription.metadata);
  if (!isCityPartnerMetadata(metadata)) {
    const linked = await citiesForSubscription(sb, subscription);
    if (!linked.length) {
      return { skipped: true, reason: 'not_city_partner' };
    }
  }

  const cities = await citiesForSubscription(sb, subscription);
  if (!cities.length) {
    return { skipped: true, reason: 'no_cities' };
  }

  const periodEnd = periodEndIso(subscription);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const status = String(subscription.status || '').trim().toLowerCase();

  if (status === 'active' && cancelAtPeriodEnd && periodEnd) {
    await reserveCityPartnerSlots(sb, cities, {
      subscriptionId,
      availableFrom: periodEnd,
    });
    const openingSoon = [];
    for (const slug of cities) {
      try {
        openingSoon.push(await notifyCityPartnerWaitlistOpeningSoon(slug, { sb, availableFrom: periodEnd }));
      } catch (e) {
        openingSoon.push({ citySlug: slug, error: e.message });
      }
    }
    return { ok: true, action: 'scheduled_release', availableFrom: periodEnd, cities, openingSoon };
  }

  if (status === 'active' && !cancelAtPeriodEnd) {
    await reserveCityPartnerSlots(sb, cities, {
      subscriptionId,
      availableFrom: null,
    });
    return { ok: true, action: 'renewed', cities };
  }

  return { skipped: true, reason: 'no_action', status };
}

async function handleCityPartnerSubscriptionDeleted(subscription) {
  const metadata = normalizeMeta(subscription.metadata);
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) {
    return { skipped: true, reason: 'missing_subscription' };
  }
  if (!isCityPartnerMetadata(metadata)) {
    const sb = getSupabaseAdmin();
    const cities = await citiesForSubscription(sb, subscription);
    if (!cities.length) {
      return { skipped: true, reason: 'not_city_partner' };
    }
  }

  const sb = getSupabaseAdmin();
  const availableFrom = periodEndIso(subscription) || new Date().toISOString();
  return releaseCityPartnerSlotsBySubscription(sb, subscriptionId, {
    availableFrom,
    notifyWaitlist: true,
  });
}

module.exports = {
  isCityPartnerMetadata,
  handleCityPartnerCheckoutCompleted,
  handleCityPartnerSubscriptionUpdated,
  handleCityPartnerSubscriptionDeleted,
  expirePrepaidCityPartnerSlots,
};
