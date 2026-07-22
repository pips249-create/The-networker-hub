/**
 * City Partner waitlist — join from /advertising and notify when a slot opens.
 */
const { getSupabaseAdmin } = require('./supabase');
const { normalizeCitySlugs, listCityPartnerRegions } = require('./networking-city-partners');
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase } = require('./hub-email-urls');

const VALID_SLUGS = new Set(listCityPartnerRegions().map((r) => r.slug));

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cityNameForSlug(slug) {
  const match = listCityPartnerRegions().find((r) => r.slug === slug);
  return match ? match.name : slug;
}

function formatAvailableFromLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

async function joinCityPartnerWaitlist(email, cities, options) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, error: 'invalid_email' };
  }

  const slugs = normalizeCitySlugs(cities).filter((slug) => VALID_SLUGS.has(slug));
  if (!slugs.length) {
    return { ok: false, error: 'no_cities_selected' };
  }

  const sb = getSupabaseAdmin();
  const companyName = String(options?.companyName || options?.company_name || '').trim() || null;
  const joined = [];
  const already = [];

  for (const slug of slugs) {
    const { data: existing } = await sb
      .from('city_partner_waitlist')
      .select('id')
      .ilike('email', normalizedEmail)
      .eq('city_slug', slug)
      .is('notified_at', null)
      .maybeSingle();

    if (existing) {
      already.push(slug);
      continue;
    }

    const { error } = await sb.from('city_partner_waitlist').insert({
      city_slug: slug,
      email: normalizedEmail,
      company_name: companyName,
    });
    if (error) throw new Error(error.message);
    joined.push(slug);
  }

  return {
    ok: true,
    joined,
    already,
    cities: slugs,
  };
}

async function cityPartnerWaitlistStatus(email, cities) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, error: 'invalid_email' };
  }

  const slugs = normalizeCitySlugs(cities).filter((slug) => VALID_SLUGS.has(slug));
  if (!slugs.length) {
    return { ok: true, onWaitlist: [] };
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('city_partner_waitlist')
    .select('city_slug, created_at')
    .ilike('email', normalizedEmail)
    .in('city_slug', slugs)
    .is('notified_at', null);
  if (error) throw new Error(error.message);

  return {
    ok: true,
    onWaitlist: (data || []).map((row) => row.city_slug),
    entries: data || [],
  };
}

async function notifyCityPartnerWaitlistForSlug(citySlug, options) {
  const slug = String(citySlug || '').trim().toLowerCase();
  if (!VALID_SLUGS.has(slug)) {
    return { notified: 0, skipped: true, reason: 'invalid_slug' };
  }

  const sb = options?.sb || getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('city_partner_waitlist')
    .select('id, email, company_name')
    .eq('city_slug', slug)
    .is('notified_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows?.length) return { notified: 0, skipped: true, reason: 'empty' };

  const siteUrl = siteBase();
  const cityName = cityNameForSlug(slug);
  const availableFrom = formatAvailableFromLabel(options?.availableFrom);
  const advertisingUrl = siteUrl + '/advertising#city-partner-package';
  let notified = 0;

  for (const row of rows) {
    const to = normalizeEmail(row.email);
    if (!to) continue;
    const contactName =
      String(row.company_name || '').trim() || to.split('@')[0] || 'there';
    try {
      const availableFromNote =
        availableFrom && availableFrom !== 'now'
          ? ' from ' + availableFrom
          : '';
      await sendTemplatedEmail({
        slug: 'city_partner_slot_open',
        to,
        variables: {
          contact_name: contactName,
          city_name: cityName,
          advertising_url: advertisingUrl,
          available_from: availableFrom || 'now',
          available_from_note: availableFromNote,
          site_url: siteUrl,
        },
      });
      await sb
        .from('city_partner_waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id);
      notified += 1;
    } catch {
      /* continue with next */
    }
  }

  return { notified, citySlug: slug, cityName };
}

async function notifyCityPartnerWaitlistOpeningSoon(citySlug, options) {
  const slug = String(citySlug || '').trim().toLowerCase();
  if (!VALID_SLUGS.has(slug)) {
    return { notified: 0, skipped: true, reason: 'invalid_slug' };
  }

  const availableFromIso = options?.availableFrom || null;
  const availableFrom = formatAvailableFromLabel(availableFromIso);
  if (!availableFrom) {
    return { notified: 0, skipped: true, reason: 'missing_available_from' };
  }

  const sb = options?.sb || getSupabaseAdmin();
  const { data: rows, error } = await sb
    .from('city_partner_waitlist')
    .select('id, email, company_name')
    .eq('city_slug', slug)
    .is('notified_at', null)
    .is('opening_soon_notified_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows?.length) return { notified: 0, skipped: true, reason: 'empty' };

  const siteUrl = siteBase();
  const cityName = cityNameForSlug(slug);
  const advertisingUrl = siteUrl + '/advertising#city-partner-package';
  let notified = 0;

  for (const row of rows) {
    const to = normalizeEmail(row.email);
    if (!to) continue;
    const contactName =
      String(row.company_name || '').trim() || to.split('@')[0] || 'there';
    try {
      await sendTemplatedEmail({
        slug: 'city_partner_opening_soon',
        to,
        variables: {
          contact_name: contactName,
          city_name: cityName,
          available_from: availableFrom,
          advertising_url: advertisingUrl,
          site_url: siteUrl,
        },
      });
      await sb
        .from('city_partner_waitlist')
        .update({ opening_soon_notified_at: new Date().toISOString() })
        .eq('id', row.id);
      notified += 1;
    } catch {
      /* continue with next */
    }
  }

  return { notified, citySlug: slug, cityName, availableFrom };
}

module.exports = {
  joinCityPartnerWaitlist,
  cityPartnerWaitlistStatus,
  notifyCityPartnerWaitlistForSlug,
  notifyCityPartnerWaitlistOpeningSoon,
  formatAvailableFromLabel,
};
