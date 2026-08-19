/**
 * Organisers removed from launch / Email 2 outreach — do not re-import or include in Brevo CSVs.
 */
const EXCLUDED_EMAILS = new Set([
  'alex@property-connect.org',
  'caroline@business-network-ltd.co.uk',
  'getconnected@my-chamber.co.uk',
  'enquiries@lincs-chamber.co.uk',
  'customerservices@tvchamber.co.uk',
  // Brevo unsubscribes 18 Aug 2026 — plus same-group inboxes still on Segment A.
  'sarah@thinklikeatree.co.uk',
  'admin@thinklikeatree.co.uk',
  'events@cw-chamber.co.uk',
  'events@maverrik.co.uk',
  'david.martin@ether-solutions.co.uk',
  'hello@elm-online.co.uk',
  'sicapp74@gmail.com',
  'shaya@mindfulaboutlife.com',
  'sasha.boltman@bbxworld.com',
  'info@shoutconnect.co.uk',
  'sam.morris1311@gmail.com',
  'andy@pro-doc.co.uk',
  'vramsden@hotmail.com',
  'tim@make-work.work',
  'sarah.clarke@evansco.co.uk',
  'jackywood2016@icloud.com',
  'info@deepconnexions.co.uk',
  'ian@shoutconnect.co.uk',
  'hannah.forbes@c2compliance.co.uk',
  'ccc@greshamstreet.com',
  'suzy@uniqueladies.co.uk',
  'jayson.gurney@darlingtonbusinessclub.co.uk',
  'info@berkshiremummies.co.uk',
  'ian@shoutnetwork.co.uk',
  'contact@theyorkshiresociety.org',
  'p.heathcote@theyorkshiresociety.og',
  'hello@blueskyseo.co.uk',
  'lee@revitalise-connect.com',
]);

const EXCLUDED_SLUGS = new Set([
  'property-connect',
  'the-business-network-ltd',
  'chamber-of-trade-mid-yorkshire',
  'chamber-of-trade-lincolnshire',
  'chamber-of-trade-thames-valley',
  'revitalise-networking-club',
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
