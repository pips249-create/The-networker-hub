/**
 * Industry Sponsor Stripe subscriptions — reserve cms_blocks slots and release on cancel.
 */
const {
  normalizeIndustrySlugs,
  industrySponsorSlotKey,
  parseIndustrySponsorSlot,
  normalizeIndustrySponsorTerm,
  addMonthsUtc,
  isPrepaidIndustrySponsorHoldId,
  listIndustrySponsorCategories,
} = require('./opportunity-industry-sponsors');

function adminSb() {
  return require('./supabase').getSupabaseAdmin();
}

function sendWelcome(opts) {
  return require('./industry-sponsor-emails').sendIndustrySponsorPaymentWelcome(opts);
}

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isIndustrySponsorMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  const placement = String(meta.placement || '').trim().toLowerCase();
  if (placement === 'industry_sponsor' || placement === 'opportunity_industry_sponsor') {
    return true;
  }
  return Boolean(String(meta.opportunity_industries || meta.opportunityIndustries || '').trim());
}

function industriesFromMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  return normalizeIndustrySlugs(meta.opportunity_industries || meta.opportunityIndustries || '');
}

async function industriesForSubscription(sb, subscription) {
  const fromMeta = industriesFromMetadata(subscription.metadata);
  if (fromMeta.length) return fromMeta;

  const subId = String(subscription.id || '').trim();
  if (!subId) return [];

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  return (rows || [])
    .map((row) => parseIndustrySponsorSlot(row.slot))
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

function parseAvailableFrom(row) {
  const raw = row?.sponsor_available_from;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function ensureIndustrySponsorSlotRows(sb, industries) {
  const slugs = normalizeIndustrySlugs(industries);
  const ensured = [];

  for (const slug of slugs) {
    const slot = industrySponsorSlotKey(slug);
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

async function reserveIndustrySponsorSlots(sb, industries, fields) {
  const now = new Date().toISOString();
  const results = [];
  await ensureIndustrySponsorSlotRows(sb, industries);

  for (const slug of industries) {
    const slot = industrySponsorSlotKey(slug);
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
      throw new Error('industry_sponsor_slot_missing:' + slot);
    }
    results.push({ slug, slot });
  }

  return results;
}

async function releaseIndustrySponsorSlotsBySubscription(sb, subscriptionId) {
  const subId = String(subscriptionId || '').trim();
  if (!subId) return { released: [] };

  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot')
    .eq('sponsor_subscription_id', subId);
  if (error) throw new Error(error.message);

  const slugs = [];
  const now = new Date().toISOString();
  for (const row of rows || []) {
    const parsed = parseIndustrySponsorSlot(row.slot);
    if (!parsed) continue;
    slugs.push(parsed.slug);
    const { error: updateError } = await sb
      .from('cms_blocks')
      .update({
        sponsor_subscription_id: null,
        sponsor_email: null,
        sponsor_available_from: null,
        active: false,
        updated_at: now,
      })
      .eq('slot', parsed.slot);
    if (updateError) throw new Error(updateError.message);
  }

  if (!slugs.length) return { released: [], skipped: true, reason: 'no_slots' };
  return { released: slugs };
}

async function handleIndustrySponsorCheckoutCompleted(session) {
  const metadata = normalizeMeta(session.metadata);
  if (!isIndustrySponsorMetadata(metadata)) {
    return { skipped: true, reason: 'not_industry_sponsor' };
  }

  const industries = industriesFromMetadata(metadata);
  if (!industries.length) {
    return { skipped: true, reason: 'no_industries' };
  }

  const term = normalizeIndustrySponsorTerm(metadata.term_months || metadata.billing_mode);
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
  if (prepaid || isPrepaidIndustrySponsorHoldId(subscriptionId)) {
    const months = term.termMonths || parseInt(String(metadata.term_months || '1'), 10) || 1;
    availableFrom = addMonthsUtc(new Date(), months).toISOString();
  }

  const sb = adminSb();
  const slots = industries.map((slug) => industrySponsorSlotKey(slug));
  const { data: existingRows, error: existingError } = await sb
    .from('cms_blocks')
    .select('slot, sponsor_subscription_id')
    .in('slot', slots);
  if (existingError) throw new Error(existingError.message);

  const bySlot = new Map((existingRows || []).map((row) => [row.slot, row]));
  const alreadyFinalized =
    industries.length > 0 &&
    industries.every((slug) => {
      const row = bySlot.get(industrySponsorSlotKey(slug));
      return row && String(row.sponsor_subscription_id || '').trim() === subscriptionId;
    });

  const reserved = await reserveIndustrySponsorSlots(sb, industries, {
    subscriptionId,
    email: email || null,
    availableFrom,
  });

  let welcomeEmail = { skipped: true, reason: 'missing_email' };
  if (alreadyFinalized) {
    welcomeEmail = { skipped: true, reason: 'already_finalized' };
  } else if (email) {
    try {
      welcomeEmail = await sendWelcome({ email, industries });
    } catch (e) {
      welcomeEmail = { ok: false, error: e.message || String(e) };
    }
  }

  return {
    ok: true,
    reserved,
    subscriptionId,
    industries,
    welcomeEmail,
    alreadyFinalized,
    billingMode: prepaid ? 'prepaid' : 'monthly',
    availableFrom,
  };
}

async function expirePrepaidIndustrySponsorSlots(sb, now = new Date()) {
  const slots = listIndustrySponsorCategories().map((r) => r.slot);
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
    if (!isPrepaidIndustrySponsorHoldId(holdId)) continue;
    const availableFrom = parseAvailableFrom(row);
    if (!availableFrom || availableFrom.getTime() > nowMs) continue;

    const parsed = parseIndustrySponsorSlot(row.slot);
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
      .eq('slot', parsed.slot);
    if (updateError) throw new Error(updateError.message);
    expired.push({ slug: parsed.slug, slot: parsed.slot });
  }

  return { expired, count: expired.length };
}

async function handleIndustrySponsorSubscriptionUpdated(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription' };

  const metadata = normalizeMeta(subscription.metadata);
  const sb = adminSb();
  let industries = industriesFromMetadata(metadata);
  if (!industries.length) {
    industries = await industriesForSubscription(sb, subscription);
  }
  if (!industries.length && !isIndustrySponsorMetadata(metadata)) {
    return { skipped: true, reason: 'not_industry_sponsor' };
  }

  const periodEnd = periodEndIso(subscription);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const status = String(subscription.status || '').trim().toLowerCase();
  const email = String(subscription.metadata?.sponsor_email || '').trim().toLowerCase() || null;

  if (cancelAtPeriodEnd && periodEnd) {
    await reserveIndustrySponsorSlots(sb, industries, {
      subscriptionId,
      email,
      availableFrom: periodEnd,
    });
    return { ok: true, action: 'cancel_at_period_end', availableFrom: periodEnd, industries };
  }

  if (status === 'active' || status === 'trialing') {
    await reserveIndustrySponsorSlots(sb, industries, {
      subscriptionId,
      email,
      availableFrom: null,
    });
    return { ok: true, action: 'active', industries };
  }

  return { skipped: true, reason: 'status_' + status };
}

async function handleIndustrySponsorSubscriptionDeleted(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription' };
  const metadata = normalizeMeta(subscription.metadata);
  if (!isIndustrySponsorMetadata(metadata)) {
    const sb = adminSb();
    const industries = await industriesForSubscription(sb, subscription);
    if (!industries.length) return { skipped: true, reason: 'not_industry_sponsor' };
  }
  const sb = adminSb();
  return releaseIndustrySponsorSlotsBySubscription(sb, subscriptionId);
}

module.exports = {
  isIndustrySponsorMetadata,
  industriesFromMetadata,
  ensureIndustrySponsorSlotRows,
  reserveIndustrySponsorSlots,
  releaseIndustrySponsorSlotsBySubscription,
  handleIndustrySponsorCheckoutCompleted,
  handleIndustrySponsorSubscriptionUpdated,
  handleIndustrySponsorSubscriptionDeleted,
  expirePrepaidIndustrySponsorSlots,
};
