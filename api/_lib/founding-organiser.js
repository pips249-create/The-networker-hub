/**
 * Founding Organiser cohort — claim before soft launch.
 * Badge: everyone who claims before 1 Sept 2026.
 * Homepage strip: first 50 claims, visible until end of Nov 2026.
 */
const FOUNDING_CLAIM_DEADLINE = new Date('2026-09-01T00:00:00+01:00');
const FOUNDING_HOMEPAGE_UNTIL = new Date('2026-11-30T23:59:59+00:00');
const FOUNDING_HOMEPAGE_CAP = 50;

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
    .order('ownership_claimed_at', { ascending: true })
    .limit(FOUNDING_HOMEPAGE_CAP);
  if (error) throw new Error(error.message);
  return data || [];
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
    .order('founding_organiser_at', { ascending: true })
    .limit(Math.min(100, Math.max(1, Number(limit) || 48)));
  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  FOUNDING_CLAIM_DEADLINE,
  FOUNDING_HOMEPAGE_UNTIL,
  FOUNDING_HOMEPAGE_CAP,
  isFoundingClaimWindow,
  isFoundingHomepageActive,
  isFoundingOrganiser,
  foundingFieldsForClaim,
  listFoundingHomepageOrganisers,
  listFoundingOrganisersForGateway,
};
