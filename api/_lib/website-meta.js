/**
 * Fetch public website metadata (logo + description) for admin profile cleanup.
 */

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function normalizeWebsiteUrl(input) {
  let url = String(input || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (isBlockedHost(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      '<meta[^>]+(?:property|name)=["\']' + escaped + '["\'][^>]+content=["\']([^"\']+)["\']',
      'i'
    ),
    new RegExp(
      '<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + escaped + '["\']',
      'i'
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[1]) return decodeHtmlEntities(match[1].trim());
  }
  return '';
}

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return String(relative || '').trim();
  }
}

function pickLogo(html, pageUrl) {
  const candidates = [
    metaContent(html, 'og:image'),
    metaContent(html, 'og:image:url'),
    metaContent(html, 'twitter:image'),
    metaContent(html, 'twitter:image:src'),
  ].filter(Boolean);

  for (const raw of candidates) {
    const resolved = resolveUrl(pageUrl, raw);
    if (resolved && /^https?:\/\//i.test(resolved)) return resolved;
  }

  const iconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i
  );
  if (iconMatch && iconMatch[1]) {
    const resolved = resolveUrl(pageUrl, decodeHtmlEntities(iconMatch[1].trim()));
    if (resolved && /^https?:\/\//i.test(resolved)) return resolved;
  }

  return '';
}

function pickDescription(html) {
  const candidates = [
    metaContent(html, 'og:description'),
    metaContent(html, 'description'),
    metaContent(html, 'twitter:description'),
  ].filter(Boolean);

  for (const text of candidates) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length >= 20) return clean.slice(0, 2000);
  }

  for (const text of candidates) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) return clean.slice(0, 2000);
  }

  return '';
}

async function fetchWebsiteMeta(rawUrl) {
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) {
    const err = new Error('invalid_url');
    err.status = 400;
    err.message = 'Enter a valid website URL (https://…).';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; NetworkerHubAdmin/1.0; +profile-cleanup)',
      },
    });
  } catch (e) {
    const err = new Error('fetch_failed');
    err.status = 502;
    err.message =
      e && e.name === 'AbortError'
        ? 'Website took too long to respond.'
        : 'Could not reach that website.';
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const err = new Error('fetch_failed');
    err.status = 502;
    err.message = 'Website returned ' + response.status + '.';
    throw err;
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    const err = new Error('not_html');
    err.status = 422;
    err.message = 'That URL did not return a web page.';
    throw err;
  }

  const html = (await response.text()).slice(0, 500000);
  const logo_url = pickLogo(html, url);
  const description = pickDescription(html);

  if (!logo_url && !description) {
    const err = new Error('no_meta');
    err.status = 422;
    err.message = 'No logo or description found on that page — try pasting manually.';
    throw err;
  }

  return { url, logo_url, description };
}

module.exports = {
  fetchWebsiteMeta,
  normalizeWebsiteUrl,
};
