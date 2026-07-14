/**
 * Edge middleware: pre-launch site access gate + server-side SEO meta for event/organiser URLs.
 * Uses Web Standard APIs only (no Next.js dependency).
 */

const SKIP_EVENT_SLUGS = new Set([
  'booking-success',
  'index.html',
  'event.html',
  'organiser.html',
  'index',
  'event',
  'organiser',
]);
const SKIP_OPPORTUNITY_SLUGS = new Set([
  'index.html',
  'opportunity.html',
  'index',
  'opportunity',
  'browse',
  'list',
]);
const SITE_ACCESS_COOKIE = 'hub_site_preview';
const SITE_PREVIEW_TOKEN_TYPE = 'site_preview';
const NOINDEX_HEADER = 'noindex, nofollow';

/** Social scrapers that need OG tags on listing pages while the site gate is on. */
const SOCIAL_CRAWLER_UA =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|vkShare|Applebot|redditbot|embedly|Quora Link Preview|Showyoubot|outbrain|opengraph|Googlebot-Image|bingbot/i;

function isSiteAccessGateActive() {
  const flag = String(process.env.DISABLE_SITE_ACCESS_GATE || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return false;
  return true;
}

function isSocialCrawler(request) {
  const ua = String(request.headers.get('user-agent') || '');
  return SOCIAL_CRAWLER_UA.test(ua);
}

function isPublicListingPath(pathname) {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  const eventMatch = path.match(/^\/events\/([^/]+)$/);
  if (eventMatch && !SKIP_EVENT_SLUGS.has(decodeURIComponent(eventMatch[1]))) return true;
  const orgMatch = path.match(/^\/organisers\/([^/]+)$/);
  if (orgMatch && orgMatch[1] !== 'organiser.html') return true;
  const oppMatch = path.match(/^\/opportunities\/([^/]+)$/);
  if (oppMatch && !SKIP_OPPORTUNITY_SLUGS.has(decodeURIComponent(oppMatch[1]))) return true;
  if (/^\/networking\/[^/]+$/.test(path)) return true;
  return false;
}

// Keep discovery files (llms.txt / agents.txt / sitemap) gated until public launch.
const GATE_BYPASS_PREFIXES = [
  '/api/stripe-webhook',
  '/api/cron/',
  '/api/site-access',
  '/api/auth/site-access',
  '/api/opportunities',
  '/site-access',
  '/site-access.html',
  '/css/',
  '/js/',
  '/assets/',
];

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHeadTags(meta) {
  if (!meta) return '';
  let tags = '<!-- hub-seo-injected -->\n';
  if (meta.title) tags += '<title>' + escapeHtml(meta.title) + '</title>\n';
  if (meta.description) {
    tags += '<meta name="description" content="' + escapeHtml(meta.description) + '" />\n';
  }
  if (meta.canonical) {
    tags += '<link rel="canonical" href="' + escapeHtml(meta.canonical) + '" />\n';
  }
  const og = meta.openGraph || {};
  for (const key of Object.keys(og)) {
    if (!og[key]) continue;
    const attr = key.indexOf('twitter:') === 0 ? 'name' : 'property';
    tags += '<meta ' + attr + '="' + escapeHtml(key) + '" content="' + escapeHtml(og[key]) + '" />\n';
  }
  if (meta.schema) {
    tags += '<script type="application/ld+json">' + JSON.stringify(meta.schema) + '</script>\n';
  }
  return tags;
}

function injectSeoIntoHtml(html, meta) {
  const headTags = buildHeadTags(meta);
  if (!headTags) return html;

  let out = String(html || '');
  out = out.replace(/<title>[^<]*<\/title>\s*/i, '');
  out = out.replace(/<meta\s+name=["']description["'][^>]*>\s*/i, '');
  out = out.replace(/<!--\s*hub-seo-injected\s*-->\s*/gi, '');

  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, headTags + '</head>');
  }
  return out.replace(/<head[^>]*>/i, function (match) {
    return match + '\n' + headTags;
  });
}

/** Edge-safe copy of api/_lib/networking-region-themes.js accents + skylines. */
const NETWORKING_REGION_THEMES = {
  "central-london": {
    "tagline": "From the City to Westminster and the West End.",
    "skylineImage": "/assets/region-skylines/london.png"
  },
  "north-london": {
    "tagline": "From Camden and Islington to Hampstead and Highgate.",
    "skylineImage": "/assets/region-skylines/london.png"
  },
  "south-london": {
    "tagline": "From South Bank and Brixton to Croydon and Greenwich.",
    "skylineImage": "/assets/region-skylines/london.png"
  },
  "east-london": {
    "tagline": "From Shoreditch and Canary Wharf to Stratford and the docks.",
    "skylineImage": "/assets/region-skylines/london.png"
  },
  "west-london": {
    "tagline": "From Kensington and Notting Hill to Hammersmith and Heathrow corridor.",
    "skylineImage": "/assets/region-skylines/london.png"
  },
  "manchester": {
    "tagline": "From the Northern Quarter to Salford Quays and beyond.",
    "skylineImage": "/assets/region-skylines/manchester.png"
  },
  "birmingham": {
    "tagline": "From Digbeth and the Jewellery Quarter to the wider Midlands.",
    "skylineImage": "/assets/region-skylines/birmingham.png"
  },
  "glasgow": {
    "tagline": "Connect with entrepreneurs across the Clyde and the city centre.",
    "skyline": "<svg class=\"networking-region-skyline-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M6 68V46h10v22H6z\"/><path d=\"M10 46V14h5v32H10z\"/><path d=\"M15 18h48v5H15z\"/><path d=\"M58 18v16h5V18h-5z\"/><path d=\"M54 34h14v4H54z\"/><path d=\"M78 68c0-10 8-18 18-18s18 8 18 18H78z\"/><path d=\"M94 50c0-9 6-16 14-16s14 7 14 16H94z\" opacity=\".85\"/><path d=\"M110 50c0-7 5-13 11-13s11 6 11 13h-22z\" opacity=\".7\"/><path d=\"M148 68V22h9l5-14 5 14h9v46h-28z\"/><path d=\"M180 68V34h14v34h-14z\" opacity=\".85\"/></svg>"
  },
  "edinburgh": {
    "tagline": "From the Old Town and New Town to Leith and the wider Lothians.",
    "skylineImage": "/assets/region-skylines/edinburgh.png"
  },
  "leeds": {
    "tagline": "From the city centre to the wider West Yorkshire business community.",
    "skylineImage": "/assets/region-skylines/leeds.png"
  },
  "bristol": {
    "tagline": "From Temple Meads and the Harbourside to Clifton and beyond.",
    "skyline": "<svg class=\"networking-region-skyline-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M10 54c30-30 74-30 104 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M16 68V26h12v42H16zm92 0V26h12v42h-12z\"/><path d=\"M18 26h8l3-10 3 10h8v5H18v-5z\"/><path d=\"M110 26h8l3-10 3 10h8v5h-22v-5z\"/><path d=\"M28 50h80v4H28z\" opacity=\".85\"/><path d=\"M42 50c10-16 28-24 46-24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" opacity=\".5\"/><path d=\"M144 68V16h14v52h-14z\"/><path d=\"M148 16h6l5-12 5 12h6v7h-22v-7z\"/><path d=\"M170 68V32h14v36h-14zm18 0V40h12v28h-12z\" opacity=\".85\"/></svg>"
  },
  "chester": {
    "tagline": "From the city walls and Rows to the wider Cheshire business network.",
    "skyline": "<svg class=\"networking-region-skyline-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M2 62h196v6H2z\" opacity=\".35\"/><path d=\"M6 62V48h7v-5h7v5h7v-5h7v5h7v14H6z\"/><path d=\"M54 68V22h12v-10h5V6l7-6 7 6v6h5v10h12v46H54z\"/><path d=\"M70 6h4V1h4v5h4l-6-5-6 5z\"/><path d=\"M60 22h32v5H60zm0 12h32v4H60z\" opacity=\".4\"/><path d=\"M112 68V26h18v42h-18z\"/><path d=\"M116 26h10l4-10h3l4 10h10v10H116V26z\"/><circle cx=\"127\" cy=\"42\" r=\"4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\"/><path d=\"M146 62V48h6v-4h6v4h6v-4h6v4h6v14h-30z\"/><path d=\"M176 68V30h14v38h-14zm18 0V38h10v30h-10z\" opacity=\".85\"/></svg>"
  }
};

function injectNetworkingRegionContent(html, meta) {
  const region = meta && meta.region;
  if (!region || !region.name) return html;

  const slug = String(meta.slug || region.slug || '').trim().toLowerCase();
  const theme = NETWORKING_REGION_THEMES[slug] || {};
  const name = escapeHtml(region.name);
  const year = escapeHtml(region.year || new Date().getFullYear());
  const introCopy = theme.tagline
    ? escapeHtml(theme.tagline) +
      ' Browse live events and organiser communities without signing in, then create a free account when you are ready to book.'
    : 'Explore live business networking events and the organiser communities behind them in ' +
      name +
      '. Browse without signing in, then create a free account when you are ready to book.';

  let out = String(html || '');
  out = out.replace(
    /<script[^>]+src=["'][^"']*hub-seo-static\.js[^"']*["'][^>]*><\/script>\s*/gi,
    ''
  );
  out = out.replace(
    /<script[^>]+src=["'][^"']*hub-seo-schema\.js[^"']*["'][^>]*><\/script>\s*/gi,
    ''
  );
  out = out.replace(
    /<body([^>]*)class=["']([^"']*)["']([^>]*)>/i,
    '<body$1class="$2 networking-region-page"$3 data-region="' + escapeHtml(slug) + '">'
  );
  out = out.replace(
    /<p class="events-hero-badge" id="events-hero-badge">[\s\S]*?<\/p>/i,
    '<p class="events-hero-badge" id="events-hero-badge">Local networking directory</p>'
  );
  out = out.replace(
    /<h1 id="events-hero-heading">[\s\S]*?<\/h1>/i,
    '<h1 id="events-hero-heading">The best business networking events &amp; groups in <span class="accent">' +
      name +
      ' ' +
      year +
      '</span></h1>'
  );
  out = out.replace(
    /<p class="events-hero-lede" id="events-hero-lede">[\s\S]*?<\/p>/i,
    '<p class="events-hero-lede" id="events-hero-lede">Discover upcoming meetings, workshops, conferences and local networking communities across ' +
      name +
      '.</p>'
  );
  out = out.replace(
    /<h2 class="listings-header" id="all-heading">[\s\S]*?<\/h2>/i,
    '<h2 class="listings-header" id="all-heading">Upcoming networking events in ' + name + '</h2>'
  );
  out = out.replace(
    /<section class="networking-region-intro"[^>]*id="networking-region-intro"[^>]*>/i,
    '<section class="networking-region-intro" id="networking-region-intro" data-region="' +
      escapeHtml(slug) +
      '">'
  );
  out = out.replace(
    /<h2 id="networking-region-intro-heading">[\s\S]*?<\/h2>/i,
    '<h2 id="networking-region-intro-heading">Business networking in <span class="networking-region-name-accent">' +
      name +
      '</span></h2>'
  );
  out = out.replace(
    /<p id="networking-region-intro-copy">[\s\S]*?<\/p>/i,
    '<p id="networking-region-intro-copy">' + introCopy + '</p>'
  );
  if (theme.skylineImage) {
    out = out.replace(
      /<div class="networking-region-skyline[^"]*" id="networking-region-skyline"[^>]*>[\s\S]*?<\/div>/i,
      '<div class="networking-region-skyline is-image" id="networking-region-skyline" aria-hidden="true">' +
        '<img class="networking-region-skyline-img" src="' +
        theme.skylineImage +
        '" alt="" width="320" height="180" decoding="async">' +
        '</div>'
    );
  } else if (theme.skyline) {
    out = out.replace(
      /<div class="networking-region-skyline[^"]*" id="networking-region-skyline"[^>]*>[\s\S]*?<\/div>/i,
      '<div class="networking-region-skyline" id="networking-region-skyline" aria-hidden="true">' +
        theme.skyline +
        '</div>'
    );
  }
  return out;
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const out = {};
  raw.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  });
  return out;
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSha256Base64Url(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function verifySignedToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = await hmacSha256Base64Url(header + '.' + body, secret);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function isGateBypassPath(pathname) {
  return GATE_BYPASS_PREFIXES.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix);
  });
}

function withNoIndexHeaders(headers) {
  const out = new Headers(headers || {});
  out.set('X-Robots-Tag', NOINDEX_HEADER);
  return out;
}

function gateRedirect(url, pathname, search) {
  const gateUrl = new URL('/site-access', url.origin);
  const next = pathname + (search || '');
  if (next && next !== '/site-access') {
    gateUrl.searchParams.set('next', next);
  }
  return Response.redirect(gateUrl.toString(), 302);
}

async function hasSiteAccess(request) {
  const cookies = parseCookies(request);
  const previewSecret = String(process.env.SITE_ACCESS_PASSWORD || '').trim();

  // Preview cookie only — admin hub_session must not skip the shared password gate.
  if (previewSecret) {
    const preview = await verifySignedToken(cookies[SITE_ACCESS_COOKIE], previewSecret);
    if (preview && preview.type === SITE_PREVIEW_TOKEN_TYPE) return true;
  }

  return false;
}

async function maybeGateSiteAccess(request, url) {
  if (!isSiteAccessGateActive()) return null;

  const password = String(process.env.SITE_ACCESS_PASSWORD || '').trim();
  if (!password) return null;

  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const search = url.search || '';

  if (isGateBypassPath(pathname)) return null;

  // Let social crawlers fetch listing HTML + OG tags (still noindexed via authorized path).
  if (isSocialCrawler(request) && isPublicListingPath(pathname)) {
    return { authorized: true, socialCrawler: true };
  }

  const previewInternalSeo =
    String(request.headers.get('x-hub-internal-seo') || '').trim() === password;
  const internalSeoTemplate =
    pathname === '/events' ||
    pathname === '/events/index' ||
    pathname === '/events/event' ||
    pathname === '/events/organiser' ||
    pathname === '/opportunities/opportunity';
  if (
    previewInternalSeo &&
    (
      pathname === '/api/seo-meta' ||
      pathname.startsWith('/api/seo/meta') ||
      internalSeoTemplate
    )
  ) {
    return null;
  }

  if (await hasSiteAccess(request)) {
    return { authorized: true };
  }

  if (pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: withNoIndexHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      }),
    });
  }

  if (pathname === '/sitemap.xml' || pathname === '/llms.txt' || pathname === '/agents.txt' || pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'site_private', message: 'Site is in private preview.' }), {
      status: 403,
      headers: withNoIndexHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      }),
    });
  }

  return gateRedirect(url, pathname, search);
}

function passThroughIfGated(gated) {
  if (!gated) return;
  // Continue to static asset / rewrite; noindex is enforced on blocked paths and SEO responses.
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  const gateResult = await maybeGateSiteAccess(request, url);
  if (gateResult instanceof Response) return gateResult;

  const siteGated = Boolean(gateResult && gateResult.authorized);

  let type;
  let slug;
  let templatePath;

  const eventMatch = pathname.match(/^\/events\/([^/]+)$/);
  const orgMatch = pathname.match(/^\/organisers\/([^/]+)$/);
  const oppMatch = pathname.match(/^\/opportunities\/([^/]+)$/);
  const networkingMatch = pathname.match(/^\/networking\/([^/]+)$/);

  if (eventMatch) {
    slug = decodeURIComponent(eventMatch[1]);
    if (SKIP_EVENT_SLUGS.has(slug)) return passThroughIfGated(siteGated);
    type = 'event';
    templatePath = '/events/event';
  } else if (orgMatch) {
    slug = decodeURIComponent(orgMatch[1]);
    if (slug === 'organiser.html') return passThroughIfGated(siteGated);
    type = 'organiser';
    templatePath = '/events/organiser';
  } else if (oppMatch) {
    slug = decodeURIComponent(oppMatch[1]);
    if (SKIP_OPPORTUNITY_SLUGS.has(slug)) return passThroughIfGated(siteGated);
    type = 'opportunity';
    templatePath = '/opportunities/opportunity';
  } else if (networkingMatch) {
    slug = decodeURIComponent(networkingMatch[1]);
    type = 'networking-region';
    templatePath = '/events/';
  } else {
    return passThroughIfGated(siteGated);
  }

  try {
    const metaUrl = new URL('/api/seo-meta', url.origin);
    metaUrl.searchParams.set('type', type);
    metaUrl.searchParams.set('slug', slug);

    const metaRes = await fetch(metaUrl.toString(), {
      headers: {
        'x-forwarded-host': url.host,
        ...(isSiteAccessGateActive() && String(process.env.SITE_ACCESS_PASSWORD || '').trim()
          ? { 'x-hub-internal-seo': String(process.env.SITE_ACCESS_PASSWORD).trim() }
          : {}),
      },
    });
    if (!metaRes.ok) return passThroughIfGated(siteGated);

    const meta = await metaRes.json();
    if (!meta || !meta.ok) return passThroughIfGated(siteGated);

    if (meta.canonical && type === 'opportunity') {
      try {
        const canonicalPath = new URL(meta.canonical).pathname.replace(/\/$/, '') || '/';
        const currentPath = pathname.replace(/\/$/, '') || '/';
        if (canonicalPath !== currentPath) {
          return Response.redirect(meta.canonical, 301);
        }
      } catch {
        /* continue with SEO injection */
      }
    }

    const htmlRes = await fetch(new URL(templatePath, url.origin).toString(), {
      headers: {
        ...(isSiteAccessGateActive() && String(process.env.SITE_ACCESS_PASSWORD || '').trim()
          ? { 'x-hub-internal-seo': String(process.env.SITE_ACCESS_PASSWORD).trim() }
          : {}),
      },
    });
    if (!htmlRes.ok) return passThroughIfGated(siteGated);

    let html = injectSeoIntoHtml(await htmlRes.text(), meta);
    if (type === 'networking-region') {
      html = injectNetworkingRegionContent(html, meta);
    }

    const seoHeaders = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    };
    if (siteGated) {
      seoHeaders['X-Robots-Tag'] = NOINDEX_HEADER;
    }

    return new Response(html, {
      headers: seoHeaders,
    });
  } catch {
    return passThroughIfGated(siteGated);
  }
}
