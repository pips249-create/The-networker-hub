/**
 * Parse sub-route from Vercel request URL (e.g. /api/auth/login → login).
 */
function getSubRoute(req, basePath) {
  const base = basePath.replace(/\/$/, '');
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
    if (idx >= 0) pathname = pathname.slice(idx);
  }
  const rest = pathname.slice(base.length).replace(/^\//, '');
  return rest.split('/').filter(Boolean)[0] || '';
}

module.exports = { getSubRoute };
