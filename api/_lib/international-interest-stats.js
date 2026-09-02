/**
 * Public aggregate demand counts for international markets (no PII).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

/** Only surface marketing copy once demand looks meaningful. */
const DISPLAY_THRESHOLD = 5;

/** Markets we actively promote on the International site. */
const SPOTLIGHT_CODES = ['IE', 'US'];

function emptyStats() {
  return { ok: true, configured: false, threshold: DISPLAY_THRESHOLD, countries: {} };
}

function normalizeCountryCode(code) {
  return String(code || '').trim().toUpperCase();
}

async function aggregateCountryCounts(sb, table) {
  const counts = {};
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const res = await sb
      .from(table)
      .select('country_code')
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(res.error.message || table + '_aggregate_failed');
    const rows = res.data || [];
    rows.forEach(function (row) {
      const code = normalizeCountryCode(row.country_code);
      if (!code) return;
      counts[code] = (counts[code] || 0) + 1;
    });
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return counts;
}

function mergeCountryCounts(interestCounts, groupCounts) {
  const codes = new Set([
    ...Object.keys(interestCounts || {}),
    ...Object.keys(groupCounts || {}),
  ]);
  const countries = {};

  codes.forEach(function (code) {
    const interest = interestCounts[code] || 0;
    const groups = groupCounts[code] || 0;
    const total = interest + groups;
    countries[code] = {
      interest: interest,
      groups: groups,
      total: total,
      display: total >= DISPLAY_THRESHOLD,
    };
  });

  return countries;
}

async function getInternationalInterestStats() {
  if (!isSupabaseConfigured()) return emptyStats();

  const sb = getSupabaseAdmin();
  const [interestCounts, groupCounts] = await Promise.all([
    aggregateCountryCounts(sb, 'international_country_interest'),
    aggregateCountryCounts(sb, 'international_group_intake'),
  ]);

  return {
    ok: true,
    configured: true,
    threshold: DISPLAY_THRESHOLD,
    countries: mergeCountryCounts(interestCounts, groupCounts),
  };
}

module.exports = {
  getInternationalInterestStats,
  DISPLAY_THRESHOLD,
  SPOTLIGHT_CODES,
};
