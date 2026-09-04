/**
 * County Partner Stripe subscriptions — reserve cms_blocks slots and release on cancel.
 */
const {
  normalizeCountySlugs,
  countyPartnerSlotKey,
  parseCountyPartnerSlot,
} = require('./networking-county-partners');

function adminSb() {
  return require('./supabase').getSupabaseAdmin();
}

function sendWelcome(opts) {
  return require('./county-partner-emails').sendCountyPartnerPaymentWelcome(opts);
}

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isCountyPartnerMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  const placement = String(meta.placement || '').trim().toLowerCase();
  if (placement === 'county_partner') return true;
  if (placement === 'city_partner') return false;
  return Boolean(String(meta.networking_counties || meta.networkingCounties || '').trim());
}

function countiesFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return normalizeCountySlugs(meta.networking_counties || meta.networkingCounties || '');
}

async function countiesForSubscription(sb, subscription) {
  const fromMeta = countiesFromMetadata(subscription.metadata);
  if (fromMeta.length) return fromMeta;

  const subId = String(subscription.id || '').trim();
  if (!subId) return [];

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  return (rows || [])
    .map((row) => parseCountyPartnerSlot(row.slot))
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

async function ensureCountyPartnerSlotRows(sb, counties) {
  const slugs = normalizeCountySlugs(counties);
  const ensured = [];

  for (const slug of slugs) {
    const slot = countyPartnerSlotKey(slug);
    const { data: existing, error: selectError } = await sb
      .from('cms_blocks')
      .select('id')
      .eq('slot', slot)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);
    if (existing?.id) continue;

    const { error: insertError } = await sb.from('cms_blocks').insert({
      slot,
      title: '',
      body: '',
      cta_label: 'Find out more',
      cta_url: 'https://',
      active: false,
      include_in_emails: false,
    });
    if (insertError) {
      if (!/duplicate|unique/i.test(String(insertError.message || ''))) {
        throw new Error(insertError.message);
      }
    }
    ensured.push({ slug, slot });
  }

  return ensured;
}

async function reserveCountyPartnerSlots(sb, counties, fields) {
  const now = new Date().toISOString();
  const results = [];
  await ensureCountyPartnerSlotRows(sb, counties);

  for (const slug of counties) {
    const slot = countyPartnerSlotKey(slug);
    const patch = {
      sponsor_subscription_id: fields.subscriptionId || null,
      sponsor_email: fields.email || null,
      sponsor_available_from: fields.availableFrom || null,
      updated_at: now,
    };
    const { data: updated, error } = await sb
      .from('cms_blocks')
      .update(patch)
      .eq('slot', slot)
      .select('id');
    if (error) throw new Error(error.message);
    if (!updated || !updated.length) {
      throw new Error('county_partner_slot_missing:' + slot);
    }
    results.push({ slug, slot });
  }

  return results;
}

async function releaseCountyPartnerSlotsBySubscription(sb, subscriptionId, options) {
  const subId = String(subscriptionId || '').trim();
  if (!subId) return { released: [] };

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot, sponsor_available_from')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  const slugs = [];
  for (const row of rows || []) {
    const parsed = parseCountyPartnerSlot(row.slot);
    if (!parsed) continue;
    slugs.push(parsed.slug);
  }

  if (!slugs.length) return { released: [], skipped: true, reason: 'no_slots' };

  const now = new Date().toISOString();
  for (const row of rows || []) {
    const parsed = parseCountyPartnerSlot(row.slot);
    if (!parsed) continue;
    const slot = countyPartnerSlotKey(parsed.slug);
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
  }

  return { released: slugs, availableFrom: options?.availableFrom || null };
}

async function handleCountyPartnerCheckoutCompleted(session) {
  const metadata = normalizeMeta(session.metadata);
  if (!isCountyPartnerMetadata(metadata)) {
    return { skipped: true, reason: 'not_county_partner' };
  }

  const counties = countiesFromMetadata(metadata);
  if (!counties.length) {
    return { skipped: true, reason: 'no_counties' };
  }

  const {
    normalizeCountyPartnerTerm,
    addMonthsUtc,
    isPrepaidCountyPartnerHoldId,
  } = require('./networking-county-partners');

  const term = normalizeCountyPartnerTerm(metadata.term_months || metadata.billing_mode);
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
  if (prepaid || isPrepaidCountyPartnerHoldId(subscriptionId)) {
    const months = term.termMonths || parseInt(String(metadata.term_months || '1'), 10) || 1;
    availableFrom = addMonthsUtc(new Date(), months).toISOString();
  }

  const sb = adminSb();
  const slots = counties.map((slug) => countyPartnerSlotKey(slug));
  const { data: existingRows, error: existingError } = await sb
    .from('cms_blocks')
    .select('slot, sponsor_subscription_id')
    .in('slot', slots);
  if (existingError) throw new Error(existingError.message);

  const bySlot = new Map((existingRows || []).map((row) => [row.slot, row]));
  const alreadyFinalized =
    counties.length > 0 &&
    counties.every((slug) => {
      const row = bySlot.get(countyPartnerSlotKey(slug));
      return row && String(row.sponsor_subscription_id || '').trim() === subscriptionId;
    });

  const reserved = await reserveCountyPartnerSlots(sb, counties, {
    subscriptionId,
    email: email || null,
    availableFrom,
  });

  let welcomeEmail = { skipped: true, reason: 'missing_email' };
  if (alreadyFinalized) {
    welcomeEmail = { skipped: true, reason: 'already_finalized' };
  } else if (email) {
    try {
      welcomeEmail = await sendWelcome({ email, counties });
    } catch (e) {
      welcomeEmail = { ok: false, error: e.message || String(e) };
    }
  }

  return {
    ok: true,
    reserved,
    subscriptionId,
    counties,
    welcomeEmail,
    alreadyFinalized,
    billingMode: prepaid ? 'prepaid' : 'monthly',
    availableFrom,
  };
}

async function expirePrepaidCountyPartnerSlots(sb, now = new Date()) {
  const {
    listCountyPartnerRegions,
    countyPartnerSlotKey: slotKey,
    isPrepaidCountyPartnerHoldId,
    parseAvailableFrom,
  } = require('./networking-county-partners');
  const slots = listCountyPartnerRegions().map((r) => r.slot);
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
    if (!isPrepaidCountyPartnerHoldId(holdId)) continue;
    const availableFrom = parseAvailableFrom(row);
    if (!availableFrom || availableFrom.getTime() > nowMs) continue;

    const parsed = parseCountyPartnerSlot(row.slot);
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
      .eq('slot', slotKey(parsed.slug));
    if (updateError) throw new Error(updateError.message);

    expired.push(parsed.slug);
  }

  return { expired, count: expired.length };
}

async function handleCountyPartnerSubscriptionUpdated(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) {
    return { skipped: true, reason: 'missing_subscription' };
  }

  const sb = adminSb();
  const metadata = normalizeMeta(subscription.metadata);
  if (!isCountyPartnerMetadata(metadata)) {
    const linked = await countiesForSubscription(sb, subscription);
    if (!linked.length) {
      return { skipped: true, reason: 'not_county_partner' };
    }
  }

  const counties = await countiesForSubscription(sb, subscription);
  if (!counties.length) {
    return { skipped: true, reason: 'no_counties' };
  }

  const periodEnd = periodEndIso(subscription);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const status = String(subscription.status || '').trim().toLowerCase();

  if (cancelAtPeriodEnd && periodEnd) {
    await reserveCountyPartnerSlots(sb, counties, {
      subscriptionId,
      email: String(subscription.metadata?.sponsor_email || '').trim().toLowerCase() || null,
      availableFrom: periodEnd,
    });
    return { ok: true, action: 'cancel_at_period_end', counties, availableFrom: periodEnd };
  }

  if (status === 'active' || status === 'trialing') {
    await reserveCountyPartnerSlots(sb, counties, {
      subscriptionId,
      email: String(subscription.metadata?.sponsor_email || '').trim().toLowerCase() || null,
      availableFrom: null,
    });
    return { ok: true, action: 'active', counties };
  }

  return { skipped: true, reason: 'no_action', status };
}

async function handleCountyPartnerSubscriptionDeleted(subscription) {
  const metadata = normalizeMeta(subscription.metadata);
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) {
    return { skipped: true, reason: 'missing_subscription' };
  }
  if (!isCountyPartnerMetadata(metadata)) {
    const sb = adminSb();
    const counties = await countiesForSubscription(sb, subscription);
    if (!counties.length) {
      return { skipped: true, reason: 'not_county_partner' };
    }
  }

  const sb = adminSb();
  const availableFrom = periodEndIso(subscription) || new Date().toISOString();
  return releaseCountyPartnerSlotsBySubscription(sb, subscriptionId, {
    availableFrom,
  });
}

module.exports = {
  isCountyPartnerMetadata,
  countiesFromMetadata,
  ensureCountyPartnerSlotRows,
  reserveCountyPartnerSlots,
  releaseCountyPartnerSlotsBySubscription,
  handleCountyPartnerCheckoutCompleted,
  handleCountyPartnerSubscriptionUpdated,
  handleCountyPartnerSubscriptionDeleted,
  expirePrepaidCountyPartnerSlots,
};
