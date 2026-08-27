/**
 * Shared secret for middleware → /api/seo-meta while the preview gate is on.
 * Prefer a dedicated secret so SITE_ACCESS_PASSWORD is not reused as an HTTP header.
 */
function getInternalSeoSecret() {
  return (
    String(process.env.HUB_INTERNAL_SEO_SECRET || '').trim() ||
    String(process.env.SESSION_SECRET || '').trim() ||
    String(process.env.SITE_ACCESS_PASSWORD || '').trim()
  );
}

function matchesInternalSeoHeader(headerValue) {
  const expected = getInternalSeoSecret();
  if (!expected) return false;
  return String(headerValue || '').trim() === expected;
}

module.exports = {
  getInternalSeoSecret,
  matchesInternalSeoHeader,
};
