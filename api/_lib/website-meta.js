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

function normalizeHexColor(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    value =
      '#' +
      value
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('');
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) return '';
  return value;
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

function hslToHex(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s))) / 100;
  const light = Math.max(0, Math.min(100, Number(l))) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function parseHslComponents(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  // "176.9, 28.16%, 59.61%" (Squarespace --accent-hsl) or "176.9 28.16% 59.61%"
  const bare = value.match(
    /^([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*$/
  );
  if (bare) return hslToHex(bare[1], bare[2], bare[3]);
  const fn = value.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i
  );
  if (fn) return hslToHex(fn[1], fn[2], fn[3]);
  return '';
}

function parseCssColor(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const hex = normalizeHexColor(value);
  if (hex) return hex;
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[/,]\s*[\d.]+%?)?\s*\)$/i
  );
  if (rgb) return rgbToHex(rgb[1], rgb[2], rgb[3]);
  return parseHslComponents(value);
}

function colorLuminance(hex) {
  const h = normalizeHexColor(hex);
  if (!h) return 1;
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function isBoringColor(hex) {
  const h = normalizeHexColor(hex);
  if (!h) return true;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx > 245 && mn > 230) return true; // near white
  if (mx < 28) return true; // near black
  if (mx - mn < 14) return true; // greys (any lightness)
  return false;
}

function stylesheetPriority(href) {
  const u = String(href || '').toLowerCase();
  if (!u) return 0;
  if (u.includes('versioned-site-css') || /\/site\.css(?:\?|$)/.test(u)) return 100;
  if (u.includes('static.css') || u.includes('custom.css') || u.includes('custom-css')) return 80;
  if (u.includes('squarespace') && u.includes('site')) return 60;
  if (u.includes('theme') || u.includes('brand')) return 40;
  if (u.includes('assets.squarespace.com/universal')) return 5;
  return 20;
}

function collectStylesheetHrefs(html, pageUrl) {
  const found = [];
  const seen = new Set();
  function push(rawHref) {
    const resolved = resolveUrl(pageUrl, decodeHtmlEntities(String(rawHref || '').trim()));
    if (!resolved || !/^https?:\/\//i.test(resolved)) return;
    const key = resolved.split('#')[0];
    if (seen.has(key)) return;
    seen.add(key);
    found.push(key);
  }

  const linkTags = String(html || '').match(/<link\b[^>]*>/gi) || [];
  linkTags.forEach((tag) => {
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) return;
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    if (href) push(href[1]);
  });

  return found
    .map((href) => ({ href, score: stylesheetPriority(href) }))
    .filter((item) => item.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.href);
}

async function fetchStylesheetTexts(html, pageUrl) {
  const hrefs = collectStylesheetHrefs(html, pageUrl);
  if (!hrefs.length) return [];
  const texts = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const response = await fetchWithTimeout(href, BROWSER_HEADERS, 7000);
        if (!response.ok) return '';
        const type = String(response.headers.get('content-type') || '').toLowerCase();
        if (type && !type.includes('css') && !type.includes('text/plain') && !type.includes('octet-stream')) {
          return '';
        }
        return String(await response.text()).slice(0, 350000);
      } catch {
        return '';
      }
    })
  );
  return texts.filter(Boolean);
}

function pickColorsFromCssText(cssText, scored, baseWeight) {
  const weight = Number(baseWeight) || 2;
  const text = String(cssText || '');
  if (!text) return;

  function add(raw, w) {
    const hex = parseCssColor(raw) || normalizeHexColor(raw);
    if (!hex || isBoringColor(hex)) return;
    scored.set(hex, (scored.get(hex) || 0) + w);
  }

  // Squarespace / theme palette HSL triples: --accent-hsl: 176.9,28.16%,59.61%
  const paletteHslRe =
    /--(safeLightAccent|safeDarkAccent|lightAccent|darkAccent|accent|brand|primary|secondary|main|theme|highlight)(?:-?color)?-hsl\s*:\s*([^;}{]+)/gi;
  let match;
  let foundPalette = false;
  while ((match = paletteHslRe.exec(text))) {
    foundPalette = true;
    const name = String(match[1] || '').toLowerCase();
    let w = 40 + weight;
    if (name === 'accent' || name === 'brand' || name === 'primary' || name === 'main') w = 100 + weight;
    else if (name === 'lightaccent' || name === 'secondary' || name === 'highlight') w = 80 + weight;
    else if (name === 'darkaccent') w = 70 + weight;
    else if (name === 'safelightaccent' || name === 'safedarkaccent') w = 30 + weight;
    add(match[2], w);
  }

  // Direct color vars: --brand-primary: #abc123 / hsl(...)
  const cssVarRe =
    /--(?:brand|primary|secondary|accent|main|theme|highlight|lightAccent|darkAccent)[-a-zA-Z0-9]*\s*:\s*([^;}{"']+)/gi;
  while ((match = cssVarRe.exec(text))) {
    const prop = String(match[0].split(':')[0] || '');
    if (/-hsl\s*$/i.test(prop.trim())) continue;
    const raw = String(match[1] || '').trim();
    if (/^var\(/i.test(raw)) continue;
    add(raw, 20 + weight);
  }

  // Template CSS often contains many unrelated hexes — only mine them when
  // we did not already find an explicit site palette.
  if (foundPalette) return;

  const hexes = text.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) || [];
  hexes.slice(0, 80).forEach((h) => add(h, weight));

  const hslFns =
    text.match(
      /hsla?\(\s*[\d.]+(?:deg)?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi
    ) || [];
  hslFns.slice(0, 40).forEach((fn) => add(fn, weight + 1));

  const rgbFns =
    text.match(
      /(?:background(?:-color)?|color|border-color|fill|stroke)\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi
    ) || [];
  rgbFns.slice(0, 80).forEach((decl) => {
    const part = decl.split(':').slice(1).join(':');
    add(part, weight + 1);
  });
}

function pickColors(html, extraCssTexts) {
  const scored = new Map();

  function add(raw, weight) {
    const hex = parseCssColor(raw) || normalizeHexColor(raw);
    if (!hex || isBoringColor(hex)) return;
    scored.set(hex, (scored.get(hex) || 0) + weight);
  }

  [
    metaContent(html, 'theme-color'),
    metaContent(html, 'msapplication-TileColor'),
    metaContent(html, 'msapplication-navbutton-color'),
  ].forEach((c) => add(c, 12));

  pickColorsFromCssText(html, scored, 2);

  const styleBlocks = String(html || '').match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  styleBlocks.slice(0, 8).forEach((block) => {
    pickColorsFromCssText(block, scored, 3);
  });

  (extraCssTexts || []).forEach((cssText) => {
    pickColorsFromCssText(cssText, scored, 4);
  });

  const ranked = [...scored.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const topScore = ranked.length ? ranked[0][1] : 0;
  // When we clearly found a theme palette, drop low-weight template noise.
  const filtered =
    topScore >= 70 ? ranked.filter(([, score]) => score >= 50) : ranked;
  return filtered.map(([hex]) => hex).slice(0, 6);
}

function classifySocialHref(href) {
  let parsed;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname || '/';
  if (host.includes('instagram.com')) {
    if (/^\/(p|reel|stories|explore)\b/i.test(path)) return null;
    return { key: 'instagram_url', url: parsed.href.split('?')[0].replace(/\/$/, '') };
  }
  if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.me')) {
    if (/^\/(share|sharer|dialog|groups)\b/i.test(path)) return null;
    return { key: 'facebook_url', url: parsed.href.split('?')[0].replace(/\/$/, '') };
  }
  if (host.includes('linkedin.com')) {
    if (!/^\/(company|in|school)\b/i.test(path)) return null;
    return { key: 'linkedin_url', url: parsed.href.split('?')[0].replace(/\/$/, '') };
  }
  if (host === 'x.com' || host === 'twitter.com' || host === 't.co') {
    if (/^\/(i|intent|share|search|hashtag)\b/i.test(path)) return null;
    if (path === '/' || path.length < 2) return null;
    return { key: 'x_url', url: parsed.href.split('?')[0].replace(/\/$/, '') };
  }
  return null;
}

function pickSocialLinks(html, pageUrl) {
  const found = {
    instagram_url: '',
    facebook_url: '',
    linkedin_url: '',
    x_url: '',
  };
  const hrefRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = hrefRe.exec(html))) {
    const resolved = resolveUrl(pageUrl, decodeHtmlEntities(match[1].trim()));
    if (!resolved || !/^https?:\/\//i.test(resolved)) continue;
    const classified = classifySocialHref(resolved);
    if (!classified) continue;
    if (!found[classified.key]) found[classified.key] = classified.url;
  }

  // Also catch plain URLs in footer/schema text
  const plainRe =
    /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|linkedin\.com|x\.com|twitter\.com)\/[^\s"'<>]+/gi;
  let plain;
  while ((plain = plainRe.exec(html))) {
    const classified = classifySocialHref(plain[0].replace(/[.,;)]+$/, ''));
    if (!classified) continue;
    if (!found[classified.key]) found[classified.key] = classified.url;
  }

  return found;
}

function assignPalette(colors) {
  const list = (colors || []).map(normalizeHexColor).filter(Boolean);
  const primary = list[0] || '';
  if (!primary) {
    return {
      brand_primary_color: '',
      brand_secondary_color: '',
      brand_accent_color: '',
      colors: list,
    };
  }
  const accent =
    list.find((c) => c !== primary && Math.abs(colorLuminance(c) - colorLuminance(primary)) > 0.15) ||
    list[1] ||
    '';
  // Only invent a contrast partner when we actually found a primary colour.
  const secondary =
    list.find((c) => c !== primary && c !== accent) ||
    (colorLuminance(primary) < 0.45 ? '#f7f1e8' : '#1a1a1a');
  return {
    brand_primary_color: primary,
    brand_secondary_color: secondary && secondary !== primary ? secondary : '',
    brand_accent_color: accent && accent !== primary ? accent : '',
    colors: list,
  };
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

function buildResultMessage({ logo_url, description, socials, colors, blocked }) {
  const parts = [];
  if (logo_url) parts.push('logo');
  if (description) parts.push('description');
  const socialCount = socials
    ? ['instagram_url', 'facebook_url', 'linkedin_url', 'x_url'].filter((k) => socials[k]).length
    : 0;
  if (socialCount) parts.push(socialCount === 1 ? '1 social link' : socialCount + ' social links');
  if (colors && colors.length) {
    parts.push(colors.length === 1 ? '1 brand colour' : colors.length + ' brand colours');
  }
  if (!parts.length) return '';

  if (blocked) {
    return (
      'This site blocks automated access — filled ' +
      parts.join(', ').replace(/, ([^,]*)$/, ' and $1') +
      ' from fallback sources. Review and save.'
    );
  }
  return 'Found ' + parts.join(', ').replace(/, ([^,]*)$/, ' and $1') + ' on the website.';
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
  let socials = {
    instagram_url: '',
    facebook_url: '',
    linkedin_url: '',
    x_url: '',
  };
  let colors = [];
  let palette = assignPalette([]);

  const page = await fetchPageHtml(url);
  if (page) {
    logo_url = pickLogo(page.html, page.pageUrl);
    description = pickDescription(page.html);
    socials = pickSocialLinks(page.html, page.pageUrl);
    const stylesheetTexts = await fetchStylesheetTexts(page.html, page.pageUrl);
    colors = pickColors(page.html, stylesheetTexts);
    palette = assignPalette(colors);
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

  const hasSocial = Object.values(socials).some(Boolean);
  if (!logo_url && !description && !hasSocial && !colors.length) {
    const err = new Error('no_meta');
    err.status = 422;
    err.message =
      'Could not read that website (it may block bots). Enter colours and social links manually.';
    throw err;
  }

  const result = {
    url,
    logo_url,
    description,
    blocked,
    instagram_url: socials.instagram_url,
    facebook_url: socials.facebook_url,
    linkedin_url: socials.linkedin_url,
    x_url: socials.x_url,
    colors,
    brand_primary_color: palette.brand_primary_color,
    brand_secondary_color: palette.brand_secondary_color,
    brand_accent_color: palette.brand_accent_color,
    message: buildResultMessage({
      logo_url,
      description,
      socials,
      colors,
      blocked,
    }),
  };
  writeMetaCache(url, result);
  return result;
}

module.exports = {
  fetchWebsiteMeta,
  normalizeWebsiteUrl,
  cleanDescription,
  normalizeHexColor,
  assignPalette,
};
