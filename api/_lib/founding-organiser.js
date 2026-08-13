/**
 * Founding Organiser cohort — claim before soft launch unlocks the badge.
 * Eligibility / award: ownership claimed before 1 Sept 2026.
 * Homepage strip: first 50 awards, visible until end of Nov 2026.
 * maybeAwardFoundingAfterEventPublish remains as a safety net for older claims.
 */
const FOUNDING_CLAIM_DEADLINE = new Date('2026-09-01T00:00:00+01:00');
const FOUNDING_HOMEPAGE_UNTIL = new Date('2026-11-30T23:59:59+00:00');
const FOUNDING_HOMEPAGE_CAP = 50;

/**
 * Soft-launch showcase tiles until the real organiser claims (and gets a homepage slot).
 * Deduped by name / BMUK aliases when merging with DB rows.
 */
const SOFT_LAUNCH_FOUNDING_SHOWCASE = [
  {
    id: 'soft-launch-bmuk',
    name: 'Business Matching UK',
    slug: '',
    photo_url: '/assets/marketing/bmu-logo.png',
    website: 'https://business-matching.co.uk/',
    industries: [],
    founding_organiser_at: '2026-01-01T00:00:00.000Z',
    founding_homepage_until: FOUNDING_HOMEPAGE_UNTIL.toISOString(),
    ownership_claimed_at: '2026-01-01T00:00:00.000Z',
    logo_band_dark: false,
    soft_launch: true,
  },
];

function isBmukName(name) {
  return /bmuk|\bbmu\b|business\s*matching/i.test(String(name || ''));
}

function mergeSoftLaunchFoundingShowcase(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const hasBmuk = list.some((row) => isBmukName(row && row.name));
  SOFT_LAUNCH_FOUNDING_SHOWCASE.forEach((seed) => {
    if (isBmukName(seed.name) && hasBmuk) return;
    const already = list.some(
      (row) =>
        String((row && row.name) || '')
          .trim()
          .toLowerCase() === String(seed.name || '').trim().toLowerCase()
    );
    if (already) return;
    list.unshift(seed);
  });
  return list;
}

function isFoundingClaimWindow(now = new Date()) {
  return now.getTime() < FOUNDING_CLAIM_DEADLINE.getTime();
}

function isFoundingHomepageActive(row, now = new Date()) {
  const until = row && row.founding_homepage_until;
  if (!until) return false;
  const end = new Date(until).getTime();
  return Number.isFinite(end) && end > now.getTime();
}

function isFoundingOrganiser(row) {
  return Boolean(row && row.founding_organiser_at);
}

/**
 * Patch fields to set on claim when still inside the founding window.
 * Homepage slot is assigned only while under the cap (best-effort; rare races OK).
 */
async function foundingFieldsForClaim(sb, now = new Date()) {
  if (!isFoundingClaimWindow(now)) return {};

  const patch = {
    founding_organiser_at: now.toISOString(),
  };

  try {
    const { count, error } = await sb
      .from('organisers')
      .select('id', { count: 'exact', head: true })
      .not('founding_homepage_until', 'is', null);
    if (error) throw error;
    if ((count || 0) < FOUNDING_HOMEPAGE_CAP) {
      patch.founding_homepage_until = FOUNDING_HOMEPAGE_UNTIL.toISOString();
    }
  } catch (e) {
    console.warn('founding homepage slot check failed:', e.message || e);
  }

  return patch;
}

function claimedDuringFoundingWindow(row) {
  if (!row || String(row.ownership_claim_status || '').toLowerCase() !== 'claimed') return false;
  const claimedAt = row.ownership_claimed_at ? new Date(row.ownership_claimed_at) : null;
  if (!claimedAt || !Number.isFinite(claimedAt.getTime())) return false;
  return claimedAt.getTime() < FOUNDING_CLAIM_DEADLINE.getTime();
}

async function foundingHomepageSlotPatch(sb) {
  try {
    const { count, error } = await sb
      .from('organisers')
      .select('id', { count: 'exact', head: true })
      .not('founding_homepage_until', 'is', null);
    if (error) throw error;
    if ((count || 0) < FOUNDING_HOMEPAGE_CAP) {
      return { founding_homepage_until: FOUNDING_HOMEPAGE_UNTIL.toISOString() };
    }
  } catch (e) {
    console.warn('founding homepage slot check failed:', e.message || e);
  }
  return {};
}

/**
 * Safety net: award founding on publish if claim was pre-deadline but badge was missed
 * (e.g. claimed before award-on-claim shipped). Prefer foundingFieldsForClaim on claim.
 * @returns {Promise<object[]>} updated organiser rows that newly received founding
 */
async function maybeAwardFoundingAfterEventPublish(sb, organiserIds, now = new Date()) {
  const ids = [...new Set((organiserIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];

  const awarded = [];
  for (const id of ids) {
    const { data: row, error } = await sb.from('organisers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.founding_organiser_at) continue;
    if (!claimedDuringFoundingWindow(row)) continue;

    const patch = {
      founding_organiser_at: now.toISOString(),
      ...(await foundingHomepageSlotPatch(sb)),
    };
    const { data: updated, error: upErr } = await sb
      .from('organisers')
      .update(patch)
      .eq('id', id)
      .is('founding_organiser_at', null)
      .select('*')
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    if (updated) awarded.push(updated);
  }
  return awarded;
}

async function listFoundingHomepageOrganisers(sb, now = new Date()) {
  const iso = now.toISOString();
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, photo_url, website, industries, founding_organiser_at, founding_homepage_until, ownership_claimed_at'
    )
    .not('founding_homepage_until', 'is', null)
    .gt('founding_homepage_until', iso)
    .eq('ownership_claim_status', 'claimed')
    .eq('is_internal', false)
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .order('ownership_claimed_at', { ascending: true })
    .limit(FOUNDING_HOMEPAGE_CAP);
  if (error) throw new Error(error.message);
  // Drop rows whose photo_url is whitespace-only after trim
  const withLogo = (data || []).filter((row) => String(row.photo_url || '').trim());
  return mergeSoftLaunchFoundingShowcase(withLogo);
}

/** All founding claimants — for the public preview gateway social-proof strip. */
async function listFoundingOrganisersForGateway(sb, limit = 48) {
  const { data, error } = await sb
    .from('organisers')
    .select(
      'id, name, slug, photo_url, website, industries, founding_organiser_at, founding_homepage_until, ownership_claimed_at'
    )
    .not('founding_organiser_at', 'is', null)
    .eq('ownership_claim_status', 'claimed')
    .eq('is_internal', false)
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .order('founding_organiser_at', { ascending: true })
    .limit(Math.min(100, Math.max(1, Number(limit) || 48)));
  if (error) throw new Error(error.message);
  const withLogo = (data || []).filter((row) => String(row.photo_url || '').trim());
  return mergeSoftLaunchFoundingShowcase(withLogo);
}

module.exports = {
  FOUNDING_CLAIM_DEADLINE,
  FOUNDING_HOMEPAGE_UNTIL,
  FOUNDING_HOMEPAGE_CAP,
  SOFT_LAUNCH_FOUNDING_SHOWCASE,
  isFoundingClaimWindow,
  isFoundingHomepageActive,
  isFoundingOrganiser,
  foundingFieldsForClaim,
  claimedDuringFoundingWindow,
  maybeAwardFoundingAfterEventPublish,
  listFoundingHomepageOrganisers,
  listFoundingOrganisersForGateway,
  mergeSoftLaunchFoundingShowcase,
};
