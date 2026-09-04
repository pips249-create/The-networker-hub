/**
 * Expire manual sponsorship placements whose end date has passed.
 * - Headline / County / sidebar: cms_blocks.sponsor_available_from
 * - Page Partner mini slots: ends_at on each carousel ad in body JSON
 * City Partner prepaid holds stay with expirePrepaidCityPartnerSlots.
 */
const {
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
  parseCarouselBody,
  serializeCarouselBody,
  normalizeCarouselAdsList,
} = require('./event-page-carousel');
const { sponsorPlacementEnded } = require('./cms-sponsor-fields');

const CAROUSEL_SLOTS = [
  EVENT_PAGE_CAROUSEL_SLOT,
  ORGANISER_PAGE_CAROUSEL_SLOT,
  OPPORTUNITY_PAGE_CAROUSEL_SLOT,
];

async function expirePagePartnerCarouselAds(sb, now = new Date()) {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const { data: rows, error } = await sb.from('cms_blocks').select('*').in('slot', CAROUSEL_SLOTS);
  if (error) throw new Error(error.message);

  const expired = [];
  for (const row of rows || []) {
    const ads = normalizeCarouselAdsList(parseCarouselBody(row.body), row.slot);
    let changed = false;
    const nextAds = ads.map((ad) => {
      if (!ad.ends_at) return ad;
      const ends = new Date(ad.ends_at);
      if (Number.isNaN(ends.getTime()) || ends.getTime() > nowMs) return ad;
      const hadHold = ad.active !== false || ad.sponsor_subscription_id;
      if (!hadHold) return ad;
      changed = true;
      expired.push({ slot: row.slot, adId: ad.id, endsAt: ad.ends_at });
      return {
        ...ad,
        active: false,
        sponsor_subscription_id: null,
        sponsor_email: null,
        reserved_at: null,
      };
    });
    if (!changed) continue;

    const stillLive = nextAds.some(
      (ad) => ad.active !== false && ad.logo_url && ad.cta_url
    );
    const { error: updateError } = await sb
      .from('cms_blocks')
      .update({
        body: serializeCarouselBody(nextAds),
        active: stillLive ? row.active !== false : false,
        updated_at: nowIso,
      })
      .eq('slot', row.slot);
    if (updateError) throw new Error(updateError.message);
  }

  return { expired, count: expired.length };
}

async function expireTimedSponsorBlocks(sb, now = new Date()) {
  const nowIso = now.toISOString();
  const { data: rows, error } = await sb
    .from('cms_blocks')
    .select('slot, active, sponsor_available_from, sponsor_subscription_id')
    .eq('active', true)
    .not('sponsor_available_from', 'is', null)
    .lte('sponsor_available_from', nowIso);
  if (error) throw new Error(error.message);

  const expired = [];
  for (const row of rows || []) {
    const slot = String(row.slot || '');
    if (String(row.sponsor_subscription_id || '').toLowerCase().startsWith('prepaid:')) continue;
    if (slot.startsWith('networking_city_partner_')) continue;
    if (slot.startsWith('networking_county_partner_')) continue;
    if (slot.startsWith('opportunity_industry_sponsor_')) continue;
    if (!sponsorPlacementEnded(row, now)) continue;

    const { error: updateError } = await sb
      .from('cms_blocks')
      .update({
        active: false,
        updated_at: nowIso,
      })
      .eq('slot', slot);
    if (updateError) throw new Error(updateError.message);
    expired.push(slot);
  }

  return { expired, count: expired.length };
}

async function expireManualSponsorshipPlacements(sb, now = new Date()) {
  const [carousels, timed] = await Promise.all([
    expirePagePartnerCarouselAds(sb, now),
    expireTimedSponsorBlocks(sb, now),
  ]);
  return {
    carousels,
    timed,
    count: carousels.count + timed.count,
  };
}

module.exports = {
  expireManualSponsorshipPlacements,
  expirePagePartnerCarouselAds,
  expireTimedSponsorBlocks,
};
