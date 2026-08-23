/**
 * Append Hub sponsorship UTM params to outbound sponsor / partner links.
 * Lets sponsors attribute site visits and form leads in their own analytics.
 */
function withSponsorUtm(rawUrl, placement, opts) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return url;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const place = String(placement || opts?.placement || 'sponsor')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'sponsor';

  const source = String(opts?.source || 'thenetworkeruk').trim().slice(0, 64) || 'thenetworkeruk';
  const medium = String(opts?.medium || 'sponsor').trim().slice(0, 64) || 'sponsor';
  const campaign = String(opts?.campaign || place).trim().slice(0, 64) || place;

  if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', source);
  if (!parsed.searchParams.has('utm_medium')) parsed.searchParams.set('utm_medium', medium);
  if (!parsed.searchParams.has('utm_campaign')) parsed.searchParams.set('utm_campaign', campaign);
  if (!parsed.searchParams.has('utm_content') && place) {
    parsed.searchParams.set('utm_content', place);
  }

  return parsed.toString();
}

/**
 * Wrap a destination URL in the Hub click-through so email / Brevo logos
 * land in Command Centre sponsor reports (sponsor_clicks).
 */
function withSponsorClickThrough(rawUrl, placement, opts) {
  const dest = withSponsorUtm(rawUrl, placement, opts);
  if (!/^https?:\/\//i.test(dest)) return dest;

  const site = String(opts?.siteUrl || process.env.SITE_URL || 'https://www.thenetworkeruk.com')
    .trim()
    .replace(/\/$/, '');
  const place = String(placement || opts?.placement || 'email_sponsor')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'email_sponsor';
  const company = String(opts?.company || opts?.companyName || '')
    .trim()
    .slice(0, 120);

  const out = new URL(site + '/api/sponsor-out');
  out.searchParams.set('u', dest);
  out.searchParams.set('p', place);
  if (company) out.searchParams.set('c', company);
  return out.toString();
}

module.exports = {
  withSponsorUtm,
  withSponsorClickThrough,
};
