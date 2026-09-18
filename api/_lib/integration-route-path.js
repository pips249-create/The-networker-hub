/** Parse /api/integrations/... paths (multi-segment). */
function parseIntegrationRoute(req) {
  const base = '/api/integrations';
  let pathname = '';
  if (req.url) {
    try {
      pathname = new URL(req.url, 'https://internal.local').pathname;
    } catch {
      pathname = String(req.url).split('?')[0];
    }
  }
  if (!pathname.startsWith(base)) {
    const idx = pathname.indexOf(base);
    if (idx < 0) return { type: 'unknown' };
    pathname = pathname.slice(idx);
  }
  const rest = pathname.slice(base.length).replace(/^\//, '');
  const parts = rest.split('/').filter(Boolean);
  if (!parts.length) return { type: 'unknown' };
  if (parts[0] === 'booking') return { type: 'booking' };
  if (parts[0] === 'providers' && parts[1] && parts[2] === 'webhook') {
    return { type: 'provider_webhook', provider: parts[1] };
  }
  return { type: 'unknown', parts };
}

module.exports = { parseIntegrationRoute };
