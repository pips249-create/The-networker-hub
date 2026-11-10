/**
 * Events directory advert carousel — self-serve £55/mo + VAT booking.
 * On paid checkout, activates the first empty slot with the uploaded creative.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const {
  EVENTS_BROWSE_CAROUSEL_SLOT,
  EVENTS_BROWSE_CAROUSEL_SIZE,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAdsList,
  normalizeCarouselAd,
  hasValidCarouselLogo,
  hasValidCarouselCta,
  isPublishableCarouselAd,
} = require('./event-page-carousel');

const DIRECTORY_CAROUSEL_NET_PENCE = 5500;
const DIRECTORY_CAROUSEL_VAT_RATE = 0.2;

function normalizeMeta(meta) {
  return meta && typeof meta === 'object' ? meta : {};
}

function isDirectoryCarouselCheckout(meta) {
  const m = normalizeMeta(meta);
  return (
    String(m.placement || '').trim() === 'events_directory_carousel' ||
    String(m.checkout_type || '').trim() === 'events_directory_carousel'
  );
}

function directoryCarouselQuote() {
  const net = DIRECTORY_CAROUSEL_NET_PENCE;
  const vat = Math.round(net * DIRECTORY_CAROUSEL_VAT_RATE);
  return {
    netPence: net,
    vatPence: vat,
    totalPence: net + vat,
    label: '£55 per month + VAT',
  };
}

async function countLiveDirectoryCarouselSlots() {
  if (!isSupabaseConfigured()) return { taken: 0, max: EVENTS_BROWSE_CAROUSEL_SIZE, available: EVENTS_BROWSE_CAROUSEL_SIZE };
  const sb = getSupabaseAdmin();
  const res = await sb
    .from('cms_blocks')
    .select('body, active')
    .eq('slot', EVENTS_BROWSE_CAROUSEL_SLOT)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data || res.data.active === false) {
    return { taken: 0, max: EVENTS_BROWSE_CAROUSEL_SIZE, available: EVENTS_BROWSE_CAROUSEL_SIZE };
  }
  const taken = normalizeCarouselAdsList(parseCarouselBody(res.data.body), EVENTS_BROWSE_CAROUSEL_SLOT).filter(
    isPublishableCarouselAd
  ).length;
  return {
    taken,
    max: EVENTS_BROWSE_CAROUSEL_SIZE,
    available: Math.max(0, EVENTS_BROWSE_CAROUSEL_SIZE - taken),
  };
}

function endsAtOneMonthFromNow() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

async function activateDirectoryCarouselSlotFromCheckout(session) {
  const metadata = normalizeMeta(session && session.metadata);
  if (!isDirectoryCarouselCheckout(metadata)) {
    return { skipped: true, reason: 'not_directory_carousel' };
  }

  const paid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete';
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  if (!isSupabaseConfigured()) {
    return { skipped: true, reason: 'supabase_not_configured' };
  }

  const company = String(metadata.company_name || metadata.companyName || '').trim();
  const ctaUrl = String(metadata.cta_url || metadata.ctaUrl || '').trim();
  const ctaLabel = String(metadata.cta_label || metadata.ctaLabel || 'Find out more')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
  const contactEmail = String(
    metadata.contact_email ||
      metadata.email ||
      session.customer_email ||
      session.customer_details?.email ||
      ''
  )
    .trim()
    .toLowerCase();
  const logoUrl = String(metadata.logo_url || metadata.logoUrl || '').trim();

  if (!company || !hasValidCarouselCta(ctaUrl)) {
    return { skipped: true, reason: 'missing_creative_fields' };
  }

  if (!hasValidCarouselLogo(logoUrl)) {
    return { skipped: true, reason: 'missing_logo' };
  }

  const sb = getSupabaseAdmin();
  const existing = await sb
    .from('cms_blocks')
    .select('*')
    .eq('slot', EVENTS_BROWSE_CAROUSEL_SLOT)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const ads = normalizeCarouselAdsList(parseCarouselBody(existing.data?.body), EVENTS_BROWSE_CAROUSEL_SLOT);
  const emptyIndex = ads.findIndex(function (ad) {
    return !isPublishableCarouselAd(ad);
  });
  if (emptyIndex < 0) {
    return { ok: false, error: 'carousel_full', message: 'All 24 directory carousel slots are taken.' };
  }

  const sessionId = String(session.id || '').trim();
  const already = ads.find(function (ad) {
    return sessionId && String(ad.stripe_checkout_session_id || '') === sessionId;
  });
  if (already) {
    return { ok: true, skipped: true, reason: 'already_activated', slot: already.slot_index + 1 };
  }

  const nextAd = normalizeCarouselAd(
    {
      id: ads[emptyIndex].id,
      slot_index: emptyIndex,
      company_name: company,
      logo_url: logoUrl,
      cta_url: ctaUrl,
      cta_label: ctaLabel || 'Find out more',
      contact_email: contactEmail,
      active: true,
      logo_band_dark: false,
      ends_at: endsAtOneMonthFromNow(),
      stripe_checkout_session_id: sessionId,
      stripe_subscription_id:
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id || '',
    },
    emptyIndex,
    EVENTS_BROWSE_CAROUSEL_SLOT
  );

  ads[emptyIndex] = nextAd;

  const row = {
    slot: EVENTS_BROWSE_CAROUSEL_SLOT,
    title: 'Events directory advert carousel',
    subtitle: 'Events directory advert carousel',
    body: serializeCarouselBody(ads),
    cta_label: 'Enquire now',
    cta_url: 'https://',
    logo_url: null,
    image_url: null,
    company_name: null,
    active: true,
    updated_at: new Date().toISOString(),
  };

  const saveRes = await sb.from('cms_blocks').upsert(row, { onConflict: 'slot' }).select().single();
  if (saveRes.error) throw new Error(saveRes.error.message);

  return {
    ok: true,
    slot: emptyIndex + 1,
    company,
    contactEmail,
  };
}

async function handleDirectoryCarouselCheckoutCompleted(session) {
  try {
    return await activateDirectoryCarouselSlotFromCheckout(session);
  } catch (e) {
    return {
      ok: false,
      error: e.code || 'directory_carousel_activate_failed',
      message: e.message || 'Could not activate directory carousel slot.',
    };
  }
}

module.exports = {
  DIRECTORY_CAROUSEL_NET_PENCE,
  directoryCarouselQuote,
  countLiveDirectoryCarouselSlots,
  isDirectoryCarouselCheckout,
  activateDirectoryCarouselSlotFromCheckout,
  handleDirectoryCarouselCheckoutCompleted,
};
