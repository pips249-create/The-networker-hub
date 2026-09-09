/**
 * Lightweight listing count for industry AEO meta (no full SSR cards yet).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

async function countPublishedOpportunitiesByCategory(categoryId) {
  const category = String(categoryId || '').trim().toLowerCase();
  if (!category || !isSupabaseConfigured()) return 0;
  try {
    const sb = getSupabaseAdmin();
    const { count, error } = await sb
      .from('business_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('approval_status', 'Approved')
      .eq('category', category);
    if (error) {
      console.error('opportunity_industry_count_failed', error.message || error);
      return 0;
    }
    return Number(count) || 0;
  } catch (e) {
    console.error('opportunity_industry_count_failed', e && e.message ? e.message : e);
    return 0;
  }
}

module.exports = {
  countPublishedOpportunitiesByCategory,
};
