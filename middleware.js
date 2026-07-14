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

/** Organiser early-access paths — reachable while the public site gate is on. */
const ORGANISER_EARLY_ACCESS_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/welcome',
  '/organiser',
  '/for-organisers',
  '/guides/list-an-event',
  '/guides/list-a-conference-or-exhibition',
  '/guides/list-a-business-opportunity',
  '/guides/invite-your-team',
  '/help/organiser-payouts',
  '/help/pricing-fees',
  '/api/auth',
  '/api/organiser',
  '/api/contact-chat',
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

/** Edge-safe copy of api/_lib/networking-region-themes.js accents + landmarks. */
const NETWORKING_REGION_THEMES = {
  "central-london": {
    "tagline": "From the City to Westminster and the West End.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M78 68V14h44v54H78z\"/><path d=\"M86 14V4h28v10\"/><path d=\"M92 24h20v22H92z\" opacity=\".45\"/><path d=\"M100 2v8M94 10h12\"/></svg>"
  },
  "north-london": {
    "tagline": "From Camden and Islington to Hampstead and Highgate.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M100 68V34\"/><ellipse cx=\"100\" cy=\"26\" rx=\"38\" ry=\"18\"/><path d=\"M62 34h76\"/><path d=\"M84 68V42h32v26\"/></svg>"
  },
  "south-london": {
    "tagline": "From South Bank and Brixton to Croydon and Greenwich.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M24 66h152\" stroke=\"currentColor\" stroke-width=\"2\" opacity=\".35\"/><path d=\"M68 66V38l32-50 32 50v28\"/><circle cx=\"100\" cy=\"30\" r=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"/><circle cx=\"100\" cy=\"30\" r=\"4\"/><path d=\"M100 4v52M74 30h52M80 12l40 36M120 12L80 48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" opacity=\".55\"/></svg>"
  },
  "east-london": {
    "tagline": "From Shoreditch and Canary Wharf to Stratford and the docks.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M20 66h160\" opacity=\".35\"/><path d=\"M36 66V28h24v38M140 66V28h24v38\"/><path d=\"M28 28h40v12H28zm104 0h40v12H132z\"/><path d=\"M56 40h88v8H56z\"/><path d=\"M64 28V12h12v16M124 28V12h12v16\"/></svg>"
  },
  "west-london": {
    "tagline": "From Kensington and Notting Hill to Hammersmith and Heathrow corridor.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M36 66V18h28v48M72 66V8h18v58M108 66V18h28v48M144 66V26h24v40\"/></svg>"
  },
  "manchester": {
    "tagline": "From the Northern Quarter to Salford Quays and beyond.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M128 66L100 8 72 66z\"/><path d=\"M100 8v58\" opacity=\".25\"/></svg>"
  },
  "birmingham": {
    "tagline": "From Digbeth and the Jewellery Quarter to the wider Midlands.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><circle cx=\"100\" cy=\"30\" r=\"34\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6\"/><circle cx=\"100\" cy=\"30\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.5\" opacity=\".6\"/><path d=\"M40 66h120\" opacity=\".35\"/></svg>"
  },
  "glasgow": {
    "tagline": "Connect with entrepreneurs across the Clyde and the city centre.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M52 66V22h10v44\"/><path d=\"M28 22h96v8H28z\"/><path d=\"M112 30v36\"/><path d=\"M104 66h16\"/></svg>"
  },
  "edinburgh": {
    "tagline": "From the Old Town and New Town to Leith and the wider Lothians.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M32 66c16-28 40-42 68-42s52 14 68 42\"/><path d=\"M52 52h16v14H52zm32-18h16v32H84zm32 6h16v26h-16z\"/><path d=\"M84 18l-8 10h16l-8-10z\"/></svg>"
  },
  "leeds": {
    "tagline": "From the city centre to the wider West Yorkshire business community.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M72 66V18h56v48\"/><path d=\"M80 18V6h40v12\"/><path d=\"M88 28h24v18H88z\" opacity=\".45\"/><path d=\"M100 4v10\"/></svg>"
  },
  "liverpool": {
    "tagline": "From the Albert Dock and Baltic Triangle to the wider Merseyside business community.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 58h168\" opacity=\".35\"/><path d=\"M28 58V24h48v34M124 58V10h48v48\"/><path d=\"M32 24h40v10H32zm88 0h40v16h-40z\"/><path d=\"M72 34h56v8H72z\"/><path d=\"M36 14l12-10 12 10M116 8l10-8 10 8\" opacity=\".7\"/></svg>"
  },
  "newcastle": {
    "tagline": "From the Quayside and city centre to the wider North East.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M28 66V34h32v32M140 66V34h32v32\"/><path d=\"M20 34c60-40 120-40 180 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M52 48h96v8H52z\"/></svg>"
  },
  "bristol": {
    "tagline": "From Temple Meads and the Harbourside to Clifton and beyond.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 38c56-36 112-36 168 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M24 66V22h20v44M156 66V22h20v44\"/><path d=\"M16 66h168\" opacity=\".35\"/></svg>"
  },
  "sheffield": {
    "tagline": "From the city centre to business communities across South Yorkshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M24 66V24h28v42M72 66V12h24v54M120 66V28h28v38M164 66V18h24v48\"/></svg>"
  },
  "nottingham": {
    "tagline": "From the Lace Market and city centre to the wider East Midlands.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M32 66c16-26 40-38 68-38s52 12 68 38\"/><path d=\"M52 52h16v14H52zm32-16h16v30H84zm32 4h16v26h-16z\"/><path d=\"M84 16l-8 10h16l-8-10z\"/></svg>"
  },
  "cardiff": {
    "tagline": "From the bay and city centre to business networks across South Wales.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><ellipse cx=\"100\" cy=\"32\" rx=\"58\" ry=\"24\"/><path d=\"M42 32h116\"/><path d=\"M48 66V32M152 66V32\"/></svg>"
  },
  "brighton": {
    "tagline": "From the seafront and creative quarter to the wider Sussex coast.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M24 66h152\" opacity=\".35\"/><path d=\"M48 66V28c8-24 24-36 52-36s44 12 52 36v38\"/><path d=\"M56 28h88\" opacity=\".5\"/><path d=\"M68 14c0-10 12-18 32-18s32 8 32 18\"/></svg>"
  },
  "cambridge": {
    "tagline": "From the science park and city centre to the wider Cambridgeshire network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M32 66h136\" opacity=\".35\"/><path d=\"M48 66V18h104v48\"/><path d=\"M56 18V8h24v10M120 18V8h24v10\"/><path d=\"M100 2v12\"/><path d=\"M68 36h64v10H68z\" opacity=\".45\"/></svg>"
  },
  "oxford": {
    "tagline": "From the city centre to business communities across Oxfordshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M32 66h136\" opacity=\".35\"/><circle cx=\"100\" cy=\"30\" r=\"34\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"5\"/><path d=\"M66 66V38h68v28\"/><path d=\"M100 4v10\"/></svg>"
  },
  "chester": {
    "tagline": "From the city walls and Rows to the wider Cheshire business network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 200 72\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M16 66h168\" opacity=\".35\"/><path d=\"M64 66V24h72v42\"/><path d=\"M72 24h56v14H72z\"/><circle cx=\"100\" cy=\"40\" r=\"10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><path d=\"M88 66V52h24v14\"/></svg>"
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
    ? escapeHtml(theme.tagline) + ' Browse live events and local organiser communities.'
    : 'Browse live business networking events and organiser communities across ' +
      name +
      '.';

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
  out = out.replace(
    /<div class="networking-region-(?:skyline|landmark)[^"]*" id="networking-region-skyline"[^>]*>[\s\S]*?<\/div>/i,
    theme.landmark
      ? '<div class="networking-region-landmark" id="networking-region-skyline" aria-hidden="true">' +
        theme.landmark +
        '</div>'
      : '<div class="networking-region-landmark" id="networking-region-skyline" hidden aria-hidden="true"></div>'
  );
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

function isOrganiserEarlyAccessPath(pathname) {
  return ORGANISER_EARLY_ACCESS_PREFIXES.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix + '/');
  });
}

function isGateBypassPath(pathname) {
  if (
    GATE_BYPASS_PREFIXES.some(function (prefix) {
      return pathname === prefix || pathname.startsWith(prefix);
    })
  ) {
    return true;
  }
  return isOrganiserEarlyAccessPath(pathname);
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
