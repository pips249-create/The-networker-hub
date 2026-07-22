/**
 * Live slot availability for Headline Sponsor and Page Partner packages.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isPublishableSponsorBlock } = require('./cms-sponsor-fields');
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
  parseCarouselBody,
  publishableCarouselAds,
} = require('./event-page-carousel');

const HEADLINE_SLOTS = {
  events: 'events_sponsor_hub',
  organisers: 'organisers_sponsor_hub',
  opportunities: 'opportunities_sponsor_hub',
};

const PAGE_PARTNER_SLOTS = {
  events: { slot: EVENT_PAGE_CAROUSEL_SLOT, max: 3 },
  organisers: { slot: ORGANISER_PAGE_CAROUSEL_SLOT, max: 3 },
  opportunities: { slot: OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT, max: 3 },
};

function headlineAvailability(row, slot) {
  const reserved = isPublishableSponsorBlock(row, slot);
  return {
    max: 1,
    taken: reserved ? 1 : 0,
    available: reserved ? 0 : 1,
    reserved,
  };
}

function pagePartnerAvailability(row, slot, max) {
  if (!row || row.active === false) {
    return { max, taken: 0, available: max };
  }
  const taken = publishableCarouselAds(parseCarouselBody(row.body), slot).length;
  return {
    max,
    taken,
    available: Math.max(0, max - taken),
  };
}

async function getAdvertisingAvailability() {
  const sb = getSupabaseAdmin();
  const slotKeys = [
    ...Object.values(HEADLINE_SLOTS),
    EVENT_PAGE_CAROUSEL_SLOT,
    ORGANISER_PAGE_CAROUSEL_SLOT,
    OPPORTUNITY_EMAIL_MINI_SPONSORS_SLOT,
  ];

  const res = await sb.from('cms_blocks').select('*').in('slot', slotKeys);
  if (res.error) throw new Error(res.error.message);

  const bySlot = {};
  (res.data || []).forEach(function (row) {
    bySlot[row.slot] = row;
  });

  const headline = {};
  Object.keys(HEADLINE_SLOTS).forEach(function (key) {
    const slot = HEADLINE_SLOTS[key];
    headline[key] = headlineAvailability(bySlot[slot], slot);
  });

  const pagePartner = {};
  Object.keys(PAGE_PARTNER_SLOTS).forEach(function (key) {
    const cfg = PAGE_PARTNER_SLOTS[key];
    pagePartner[key] = pagePartnerAvailability(bySlot[cfg.slot], cfg.slot, cfg.max);
  });

  return { headline, pagePartner };
}

module.exports = {
  getAdvertisingAvailability,
  HEADLINE_SLOTS,
  PAGE_PARTNER_SLOTS,
};
