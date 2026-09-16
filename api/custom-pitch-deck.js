/**
 * GET /api/custom-pitch-deck?slug=custom-acme-a1b2c3
 * Public JSON for tailored internal pitch decks (unlisted URLs).
 */
const { json } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { getSupabaseAdmin, isSupabaseConfigured } = require('./_lib/supabase');
const { publicPathForSlug } = require('./_lib/custom-pitch-deck-generate');

function normalizeSlug(raw) {
  let s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, '');
  if (s.startsWith('/p-tnh-')) s = s.slice('/p-tnh-'.length);
  if (s.startsWith('p-tnh-')) s = s.slice('p-tnh-'.length);
  s = s.replace(/[^a-z0-9-]/g, '').slice(0, 80);
  if (!/^custom-[a-z0-9-]+$/.test(s)) return '';
  return s;
}

module.exports = wrapHandler(async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const slug = normalizeSlug(req.query && req.query.slug);
  if (!slug) {
    return json(res, 400, { error: 'invalid_slug', message: 'Missing or invalid deck slug.' });
  }

  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('custom_pitch_decks')
    .select(
      'id, slug, company_name, website, contact_name, prospect_logo_url, include_sections, brief, deck, created_at, updated_at'
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    const missing = /custom_pitch_decks|does not exist|schema cache/i.test(String(error.message || ''));
    return json(res, missing ? 503 : 500, {
      error: missing ? 'migration_required' : 'load_failed',
      message: missing
        ? 'Run migration 293_custom_pitch_decks.sql in Supabase.'
        : error.message,
    });
  }

  if (!data) {
    return json(res, 404, { error: 'not_found', message: 'Pitch deck not found.' });
  }

  return json(res, 200, {
    ok: true,
    slug: data.slug,
    path: publicPathForSlug(data.slug),
    companyName: data.company_name,
    website: data.website || '',
    contactName: data.contact_name || '',
    prospectLogoUrl: data.prospect_logo_url || (data.deck && data.deck.hero && data.deck.hero.prospectLogoUrl) || '',
    includeSections: data.include_sections || [],
    brief: data.brief || '',
    deck: data.deck || {},
    updatedAt: data.updated_at,
  });
});
