/**
 * Opportunity Page Partner — reserve carousel ads on payment / release on cancel.
 */
const {
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAdsList,
  isCarouselAdHeld,
} = require('./event-page-carousel');
const {
  normalizeOpportunityPagePartnerTerm,
  addMonthsUtc,
  isPrepaidOpportunityPagePartnerHoldId,
} = require('./opportunity-page-partner');

function adminSb() {
  return require('./supabase').getSupabaseAdmin();
}

function sendWelcome(opts) {
  return require('./opportunity-page-partner-emails').sendOpportunityPagePartnerPaymentWelcome(opts);
}

function normalizeMeta(metadata) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

function isOpportunityPagePartnerMetadata(metadata) {
  const meta = normalizeMeta(metadata);
  const placement = String(meta.placement || '').trim().toLowerCase();
  if (placement === 'opportunity_page_partner' || placement === 'opportunities_mini_sponsor') {
    return true;
  }
  return String(meta.cms_slot || '').trim() === OPPORTUNITY_PAGE_CAROUSEL_SLOT;
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

async function loadOpportunityCarouselRow(sb) {
  const { data: row, error } = await sb
    .from('cms_blocks')
    .select('*')
    .eq('slot', OPPORTUNITY_PAGE_CAROUSEL_SLOT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row;
}

async function saveOpportunityCarouselAds(sb, ads, rowActive) {
  const now = new Date().toISOString();
  const body = serializeCarouselBody(ads);
  const existing = await loadOpportunityCarouselRow(sb);
  if (existing?.id) {
    const { error } = await sb
      .from('cms_blocks')
      .update({
        body,
        active: rowActive !== false,
        updated_at: now,
      })
      .eq('slot', OPPORTUNITY_PAGE_CAROUSEL_SLOT);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await sb.from('cms_blocks').insert({
    slot: OPPORTUNITY_PAGE_CAROUSEL_SLOT,
    title: 'Opportunity Page Partner',
    body,
    cta_label: 'Enquire now',
    cta_url: 'https://',
    active: rowActive !== false,
    include_in_emails: true,
  });
  if (error) throw new Error(error.message);
}

async function reserveOpportunityPagePartnerSlot(sb, fields) {
  const row = await loadOpportunityCarouselRow(sb);
  const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body), OPPORTUNITY_PAGE_CAROUSEL_SLOT);
  const now = new Date();

  // Idempotent: already reserved under this subscription.
  const existing = ads.find(
    (ad) => String(ad.sponsor_subscription_id || '').trim() === String(fields.subscriptionId || '').trim()
  );
  if (existing) {
    return { adId: existing.id, slotIndex: existing.slot_index, alreadyReserved: true };
  }

  const free = ads.find((ad) => !isCarouselAdHeld(ad, now));
  if (!free) {
    throw new Error('no_opportunity_page_partner_slots');
  }

  const nextAds = ads.map((ad) => {
    if (ad.id !== free.id) return ad;
    return {
      ...ad,
      // Keep creative inactive until admin uploads logo + link.
      active: false,
      sponsor_subscription_id: fields.subscriptionId || null,
      sponsor_email: fields.email || null,
      reserved_at: now.toISOString(),
      ends_at: fields.availableFrom || null,
    };
  });

  await saveOpportunityCarouselAds(sb, nextAds, true);
  return { adId: free.id, slotIndex: free.slot_index, alreadyReserved: false };
}

async function releaseOpportunityPagePartnerBySubscription(sb, subscriptionId) {
  const subId = String(subscriptionId || '').trim();
  if (!subId) return { released: [] };

  const row = await loadOpportunityCarouselRow(sb);
  if (!row) return { released: [], skipped: true, reason: 'missing_row' };

  const ads = normalizeCarouselAdsList(parseCarouselBody(row.body), OPPORTUNITY_PAGE_CAROUSEL_SLOT);
  const released = [];
  const nextAds = ads.map((ad) => {
    if (String(ad.sponsor_subscription_id || '').trim() !== subId) return ad;
    released.push(ad.id);
    return {
      ...ad,
      active: false,
      sponsor_subscription_id: null,
      sponsor_email: null,
      reserved_at: null,
      ends_at: null,
      logo_url: '',
      company_name: '',
      cta_url: '',
    };
  });

  if (!released.length) return { released: [], skipped: true, reason: 'no_slots' };
  await saveOpportunityCarouselAds(sb, nextAds, nextAds.some((ad) => isCarouselAdHeld(ad)));
  return { released };
}

async function handleOpportunityPagePartnerCheckoutCompleted(session) {
  const metadata = normalizeMeta(session.metadata);
  if (!isOpportunityPagePartnerMetadata(metadata)) {
    return { skipped: true, reason: 'not_opportunity_page_partner' };
  }

  const term = normalizeOpportunityPagePartnerTerm(metadata.term_months || metadata.billing_mode);
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
  if (prepaid || isPrepaidOpportunityPagePartnerHoldId(subscriptionId)) {
    const months = term.termMonths || parseInt(String(metadata.term_months || '1'), 10) || 1;
    availableFrom = addMonthsUtc(new Date(), months).toISOString();
  }

  const sb = adminSb();
  const reserved = await reserveOpportunityPagePartnerSlot(sb, {
    subscriptionId,
    email: email || null,
    availableFrom,
  });

  let welcomeEmail = { skipped: true, reason: 'missing_email' };
  if (reserved.alreadyReserved) {
    welcomeEmail = { skipped: true, reason: 'already_finalized' };
  } else if (email) {
    try {
      welcomeEmail = await sendWelcome({ email });
    } catch (e) {
      welcomeEmail = { ok: false, error: e.message || String(e) };
    }
  }

  return {
    ok: true,
    reserved,
    subscriptionId,
    alreadyFinalized: Boolean(reserved.alreadyReserved),
    welcomeEmail,
    billingMode: prepaid ? 'prepaid' : 'monthly',
    availableFrom,
  };
}

async function handleOpportunityPagePartnerSubscriptionUpdated(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription' };

  const metadata = normalizeMeta(subscription.metadata);
  if (!isOpportunityPagePartnerMetadata(metadata)) {
    // Still try release/update if a carousel ad is tagged with this subscription.
    const sb = adminSb();
    const row = await loadOpportunityCarouselRow(sb);
    const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body), OPPORTUNITY_PAGE_CAROUSEL_SLOT);
    const linked = ads.some((ad) => String(ad.sponsor_subscription_id || '').trim() === subscriptionId);
    if (!linked) return { skipped: true, reason: 'not_opportunity_page_partner' };
  }

  const sb = adminSb();
  const periodEnd = periodEndIso(subscription);
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  const status = String(subscription.status || '').trim().toLowerCase();
  const email = String(subscription.metadata?.sponsor_email || '').trim().toLowerCase() || null;

  const row = await loadOpportunityCarouselRow(sb);
  const ads = normalizeCarouselAdsList(parseCarouselBody(row?.body), OPPORTUNITY_PAGE_CAROUSEL_SLOT);
  let changed = false;
  const nextAds = ads.map((ad) => {
    if (String(ad.sponsor_subscription_id || '').trim() !== subscriptionId) return ad;
    changed = true;
    if (cancelAtPeriodEnd && periodEnd) {
      return { ...ad, ends_at: periodEnd, sponsor_email: email || ad.sponsor_email };
    }
    if (status === 'active' || status === 'trialing') {
      return { ...ad, ends_at: null, sponsor_email: email || ad.sponsor_email };
    }
    return ad;
  });
  if (!changed) return { skipped: true, reason: 'no_slots' };
  await saveOpportunityCarouselAds(sb, nextAds, true);
  return {
    ok: true,
    action: cancelAtPeriodEnd ? 'cancel_at_period_end' : 'active',
    availableFrom: cancelAtPeriodEnd ? periodEnd : null,
  };
}

async function handleOpportunityPagePartnerSubscriptionDeleted(subscription) {
  const subscriptionId = String(subscription.id || '').trim();
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription' };
  const sb = adminSb();
  return releaseOpportunityPagePartnerBySubscription(sb, subscriptionId);
}

module.exports = {
  isOpportunityPagePartnerMetadata,
  reserveOpportunityPagePartnerSlot,
  releaseOpportunityPagePartnerBySubscription,
  handleOpportunityPagePartnerCheckoutCompleted,
  handleOpportunityPagePartnerSubscriptionUpdated,
  handleOpportunityPagePartnerSubscriptionDeleted,
};
