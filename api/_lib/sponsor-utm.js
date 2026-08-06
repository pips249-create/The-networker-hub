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

  const source = String(opts?.source || 'thenetworkerhub').trim().slice(0, 64) || 'thenetworkerhub';
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

module.exports = {
  withSponsorUtm,
};
