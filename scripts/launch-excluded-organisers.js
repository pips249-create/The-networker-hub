/**
 * Organisers removed from launch / Email 2 outreach — do not re-import or include in Brevo CSVs.
 */
const EXCLUDED_EMAILS = new Set([
  'alex@property-connect.org',
  'caroline@business-network-ltd.co.uk',
  'getconnected@my-chamber.co.uk',
  'enquiries@lincs-chamber.co.uk',
  'customerservices@tvchamber.co.uk',
]);

const EXCLUDED_SLUGS = new Set([
  'property-connect',
  'the-business-network-ltd',
  'chamber-of-trade-mid-yorkshire',
  'chamber-of-trade-lincolnshire',
  'chamber-of-trade-thames-valley',
]);

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isExcludedLaunchOrganiser({ email, slug, name }) {
  const em = normalizeEmail(email);
  if (EXCLUDED_EMAILS.has(em)) return true;
  const s = String(slug || '')
    .trim()
    .toLowerCase();
  if (EXCLUDED_SLUGS.has(s)) return true;
  if (/^property connect$/i.test(String(name || '').trim())) return true;
  if (/^the business network ltd\s*-?\s*$/i.test(String(name || '').trim())) return true;
  return false;
}

module.exports = {
  EXCLUDED_EMAILS,
  EXCLUDED_SLUGS,
  normalizeEmail,
  isExcludedLaunchOrganiser,
};
