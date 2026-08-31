/**
 * Public aggregate demand counts for international markets (no PII).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

/** Only surface counts once demand looks meaningful. */
const DISPLAY_THRESHOLD = 5;

/** Markets we actively promote on the International site. */
const SPOTLIGHT_CODES = ['IE', 'US'];

function emptyStats() {
  return { ok: true, configured: false, threshold: DISPLAY_THRESHOLD, countries: {} };
}

async function countRows(sb, table, countryCode) {
  const res = await sb
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('country_code', countryCode);
  if (res.error) throw new Error(res.error.message || table + '_count_failed');
  return res.count || 0;
}

async function getInternationalInterestStats() {
  if (!isSupabaseConfigured()) return emptyStats();

  const sb = getSupabaseAdmin();
  const countries = {};

  await Promise.all(
    SPOTLIGHT_CODES.map(async function (code) {
      const [interest, groups] = await Promise.all([
        countRows(sb, 'international_country_interest', code),
        countRows(sb, 'international_group_intake', code),
      ]);
      const total = interest + groups;
      countries[code] = {
        interest: interest,
        groups: groups,
        total: total,
        display: total >= DISPLAY_THRESHOLD,
      };
    })
  );

  return {
    ok: true,
    configured: true,
    threshold: DISPLAY_THRESHOLD,
    countries: countries,
  };
}

module.exports = {
  getInternationalInterestStats,
  DISPLAY_THRESHOLD,
  SPOTLIGHT_CODES,
};
