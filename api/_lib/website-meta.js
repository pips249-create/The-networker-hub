/**
 * Fetch public website metadata (logo + description) for admin profile cleanup.
 * Many sites block datacenter fetches (403) — we retry with browser headers, then fall back
 * to favicon + a reader proxy for description text.
 */

const FETCH_TIMEOUT_MS = 12000;
const META_CACHE_MS = 5 * 60 * 1000;
const metaCache = new Map();

function readMetaCache(url) {
  const entry = metaCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.at > META_CACHE_MS) {
    metaCache.delete(url);
    return null;
  }
  return entry.data;
}

function writeMetaCache(url, data) {
  if (metaCache.size > 48) {
    const oldest = metaCache.keys().next().value;
    if (oldest) metaCache.delete(oldest);
  }
  metaCache.set(url, { at: Date.now(), data });
}
const BROWSER_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    mdash: '-',
    ndash: '-',
    hellip: '...',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    copy: '(c)',
    reg: '(R)',
    trade: '(TM)',
  };

  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (_, name) => named[name.toLowerCase()] ?? '&' + name + ';');
}

function fixMojibake(text) {
  return String(text || '')
    .replace(/\u00e2\u0080[\u0093-\u0094]/g, '-')
    .replace(/\u00e2\u0080[\u0098-\u0099]/g, "'")
    .replace(/\u00e2\u0080[\u009c-\u009d]/g, '"')
    .replace(/\u00e2\u0080\u00a6/g, '...')
    .replace(/\u00c2\u00a0/g, ' ')
    .replace(/\u00c2(?=[\s'"\-.,!?])/g, '')
    .replace(/â€™|â€˜|Ã¢â‚¬â„¢/g, "'")
    .replace(/â€œ|â€\u009d|Ã¢â‚¬Å"/g, '"')
    .replace(/â€"|Ã¢â‚¬"/g, '-')
    .replace(/â€¦/g, '...')
    .replace(/Â(?=[\s\u00a0'"\-.,!?])/g, '')
    .replace(/\u00a0/g, ' ');
}

function stripMarkup(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '');
}

function cleanDescription(raw) {
  let text = stripMarkup(decodeHtmlEntities(raw));
  text = fixMojibake(text);
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\.{4,}/g, '...')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/\\(['"])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/^(We use cookies[^.]*\.?\s*|This site uses cookies[^.]*\.?\s*)/i, '');
  text = text.replace(/(\s*(Read more|Learn more|Click here|Find out more|View all)\.?)$/i, '');
  text = text.replace(/\s*[|·]\s*(Home|Menu|Skip to content).*$/i, '');
  return text.slice(0, 2000).trim();
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

function urlVariants(url) {
  const variants = [];
  const seen = new Set();
  function add(candidate) {
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    variants.push(candidate);
  }

  add(url);
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.startsWith('www.')) {
      const alt = new URL(parsed.href);
      alt.hostname = host.slice(4);
      add(alt.href);
    } else {
      const alt = new URL(parsed.href);
      alt.hostname = 'www.' + host;
      add(alt.href);
    }
  } catch {
    /* ignore */
  }
  return variants;
}

async function fetchWithTimeout(url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: headers || BROWSER_HEADERS,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isHtmlResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  return !contentType || contentType.includes('text/html') || contentType.includes('application/xhtml');
}

async function fetchPageHtml(url) {
  for (const candidate of urlVariants(url)) {
    try {
      const response = await fetchWithTimeout(candidate, BROWSER_HEADERS);
      if (!response.ok) continue;
      if (!isHtmlResponse(response)) continue;
      const html = (await response.text()).slice(0, 500000);
      return { html, pageUrl: response.url || candidate };
    } catch {
      /* try next variant */
    }
  }
  return null;
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

  const iconPatterns = [
    /<link[^>]+rel=["'][^"']*(?:shortcut icon|apple-touch-icon|icon)[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:shortcut icon|apple-touch-icon|icon)[^"']*["']/gi,
  ];
  for (const re of iconPatterns) {
    const match = re.exec(html);
    if (match && match[1]) {
      const resolved = resolveUrl(pageUrl, decodeHtmlEntities(match[1].trim()));
      if (resolved && /^https?:\/\//i.test(resolved)) return resolved;
    }
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
    const clean = cleanDescription(text);
    if (clean.length >= 20) return clean;
  }

  for (const text of candidates) {
    const clean = cleanDescription(text);
    if (clean) return clean;
  }

  return '';
}

function googleFaviconUrl(hostname) {
  const host = String(hostname || '')
    .replace(/^www\./i, '')
    .trim();
  if (!host) return '';
  return (
    'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=128'
  );
}

function siteFaviconUrl(pageUrl) {
  try {
    return new URL('/favicon.ico', pageUrl).href;
  } catch {
    return '';
  }
}

async function fetchDescriptionViaReader(url) {
  const readerUrl = 'https://r.jina.ai/' + url;
  try {
    const response = await fetchWithTimeout(
      readerUrl,
      {
        Accept: 'text/plain',
        'User-Agent': BROWSER_HEADERS['User-Agent'],
      },
      15000
    );
    if (!response.ok) return '';
    const text = String(await response.text()).slice(0, 100000);
    const contentMatch = text.match(/Markdown Content:\s*\n+([\s\S]+)/i);
    if (contentMatch && contentMatch[1]) {
      const paragraph = contentMatch[1]
        .split(/\n{2,}/)
        .map((block) => cleanDescription(block))
        .find((block) => {
          if (block.length < 40) return false;
          if (/^!\[/.test(block) || /^#+\s/.test(block) || /^\|/.test(block)) return false;
          if (/^\*\*Last Updated/i.test(block)) return false;
          if (block.includes('![') && block.includes('](')) return false;
          return block.split(/\s+/).length >= 8;
        });
      if (paragraph) return paragraph;
    }
    const titleMatch = text.match(/^Title:\s*(.+)$/im);
    if (titleMatch && titleMatch[1]) {
      const title = cleanDescription(titleMatch[1]);
      if (title.length >= 10) return title;
    }
  } catch {
    /* optional fallback */
  }
  return '';
}

function buildResultMessage({ logo_url, description, blocked }) {
  const parts = [];
  if (logo_url) parts.push('logo');
  if (description) parts.push('description');
  if (!parts.length) return '';

  if (blocked) {
    return (
      'This site blocks automated access — filled ' +
      parts.join(' and ') +
      ' from fallback sources. Review and Save.'
    );
  }
  return 'Found ' + parts.join(' and ') + ' on the website.';
}

async function fetchWebsiteMeta(rawUrl) {
  const url = normalizeWebsiteUrl(rawUrl);
  if (!url) {
    const err = new Error('invalid_url');
    err.status = 400;
    err.message = 'Enter a valid website URL (https://…).';
    throw err;
  }

  const cached = readMetaCache(url);
  if (cached) return { ...cached };

  const hostname = new URL(url).hostname;
  let logo_url = '';
  let description = '';
  let blocked = false;

  const page = await fetchPageHtml(url);
  if (page) {
    logo_url = pickLogo(page.html, page.pageUrl);
    description = pickDescription(page.html);
  } else {
    blocked = true;
  }

  if (!logo_url) {
    const directFavicon = siteFaviconUrl(url);
    if (directFavicon) {
      try {
        const iconRes = await fetchWithTimeout(directFavicon, BROWSER_HEADERS, 6000);
        if (iconRes.ok) logo_url = directFavicon;
      } catch {
        /* try google fallback */
      }
    }
  }

  if (!logo_url) {
    logo_url = googleFaviconUrl(hostname);
  }

  if (!description) {
    description = await fetchDescriptionViaReader(url);
    if (description) blocked = true;
  }

  description = cleanDescription(description);

  if (!logo_url && !description) {
    const err = new Error('no_meta');
    err.status = 422;
    err.message =
      'Could not read that website (it may block bots). Paste the logo and description manually.';
    throw err;
  }

  const result = {
    url,
    logo_url,
    description,
    blocked,
    message: buildResultMessage({ logo_url, description, blocked }),
  };
  writeMetaCache(url, result);
  return result;
}

module.exports = {
  fetchWebsiteMeta,
  normalizeWebsiteUrl,
  cleanDescription,
};
