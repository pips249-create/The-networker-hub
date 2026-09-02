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

/** Prefer dedicated secret so SITE_ACCESS_PASSWORD is not sent as an HTTP header. */
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

function isInternationalHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase();
  return h === 'thenetworkerinternational.com' || h === 'www.thenetworkerinternational.com';
}

function isMarketPreviewHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase();
  return (
    h === 'thenetworkerireland.com' ||
    h === 'www.thenetworkerireland.com' ||
    h === 'thenetworkerusa.com' ||
    h === 'www.thenetworkerusa.com'
  );
}

/** Public routing / coming-soon domains — never send through UK site-access gate. */
function isPublicMarketHost(host) {
  return isInternationalHost(host) || isMarketPreviewHost(host);
}

function isSocialCrawler(request) {
  const ua = String(request.headers.get('user-agent') || '');
  return SOCIAL_CRAWLER_UA.test(ua);
}

/** Ticket iframe widget — must load anonymously on organiser websites while the gate is on. */
function isTicketEmbedPath(pathname) {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  return (
    path === '/embed/event' ||
    path === '/embed/event.html' ||
    /^\/embed\/event\/[^/]+$/i.test(path)
  );
}

function isPublicListingPath(pathname, searchParams) {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  const params = searchParams || new URLSearchParams();
  if (isTicketEmbedPath(path)) return true;
  const eventMatch = path.match(/^\/events\/([^/]+)$/);
  if (eventMatch && !SKIP_EVENT_SLUGS.has(decodeURIComponent(eventMatch[1]))) return true;
  // Fallback share links: /events/event?id=… (and .html) — used when slug is missing.
  if (
    (path === '/events/event' || path === '/events/event.html') &&
    (params.get('id') || params.get('slug'))
  ) {
    return true;
  }
  const orgMatch = path.match(/^\/organisers\/([^/]+)$/);
  if (orgMatch && orgMatch[1] !== 'organiser.html') return true;
  if (
    (path === '/events/organiser' || path === '/events/organiser.html') &&
    (params.get('id') || params.get('slug'))
  ) {
    return true;
  }
  const oppMatch = path.match(/^\/opportunities\/([^/]+)$/);
  if (oppMatch && !SKIP_OPPORTUNITY_SLUGS.has(decodeURIComponent(oppMatch[1]))) return true;
  if (/^\/networking\/[^/]+$/.test(path)) return true;
  if (/^\/opportunities\/networking\/[^/]+$/.test(path)) return true;
  if (path === '/rankings/badge') return true;
  return false;
}

// Keep discovery files (llms.txt / agents.txt / sitemap) gated until public launch.
const GATE_BYPASS_PREFIXES = [
  '/api/stripe-webhook',
  '/api/resend-webhook',
  '/api/cron/',
  '/api/health',
  '/api/track',
  '/api/sponsor-out',
  '/api/sponsor-analytics',
  '/api/site-access',
  '/api/auth/site-access',
  '/api/founding-organisers',
  '/site-access',
  '/site-access.html',
  // Soft-launch mini-site for co.uk banner (closed bubble — not the full Hub)
  '/peek',
  '/css/',
  '/js/',
  '/assets/',
  '/data/',
  '/international',
  '/ireland',
  '/united-states',
  '/api/international-interest',
  '/api/international-group-intake',
  '/api/international-hub-stats',
  '/api/international-interest-stats',
  // Non-secret client bootstrap (Turnstile site key) — needed on gated + early-access forms.
  '/api/public-config',
];

/** Unlisted internal sales decks — not linked from nav; noindex in page HTML. */
const INTERNAL_SALES_PREFIXES = [
  '/p-tnh-ev-hub-k7m2',
  '/p/tnh-ev-hub-k7m2',
  '/p-tnh-barnsgate-ev-m4p8',
  '/p/tnh-barnsgate-ev-m4p8',
  '/p-tnh-vci-ftt-k9w4',
  '/p/tnh-vci-ftt-k9w4',
  '/p-tnh-org-onboard-x4n7',
  '/p/tnh-org-onboard-x4n7',
  '/p-tnh-bmu-onboard-k7m2',
  '/p/tnh-bmu-onboard-k7m2',
  '/p-tnh-wibn-onboard-w9m3',
  '/p/tnh-wibn-onboard-w9m3',
  '/p-tnh-intl-overview-i8n2',
  '/p/tnh-intl-overview-i8n2',
  '/p-tnh-embed-events-k1',
  '/p-tnh-embed-org-k2',
  '/p-tnh-embed-dash-k3',
  '/p-tnh-embed-events-wibn',
  '/p-tnh-embed-org-wibn',
  '/p-tnh-embed-opps-wibn',
  '/p-tnh-embed-dash-wibn',
];

/**
 * Organiser early-access paths — reachable while the public site gate is on.
 * Email 1/2: claim, auth, organiser workspace, trust pages, and setup guides only.
 * Soft-launch /peek mini-site is retired (301 → live pages).
 * Public catalogue stays gated until SITE_ACCESS_PASSWORD is removed at launch.
 * Signed-in claim sessions unlock the organiser workspace only — not public browse.
 */
const ORGANISER_EARLY_ACCESS_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/welcome',
  '/organiser',
  '/for-organisers',
  '/for-organisers.html',
  '/add-your-event',
  '/add-your-event.html',
  '/contact',
  '/contact.html',
  '/legal-policies',
  '/guides/claim-your-organiser-page',
  '/guides/list-an-event',
  '/guides/list-a-business-opportunity',
  '/guides/list-a-conference-or-exhibition',
  '/guides/invite-your-team',
  '/guides/export-attendees-and-visits',
  '/help/pricing-fees',
  '/help/organiser-payouts',
  '/account',
  '/advertising',
  '/api/auth',
  '/api/organiser',
  '/api/contact-chat',
  '/api/contact-message',
  '/api/event-intake',
  '/api/advertising',
  // Snippet helper for organisers (widget iframe itself is fully public via isTicketEmbedPath).
  '/embed/tickets',
  '/embed/tickets.html',
];

/** Public organiser profile pages for Email 2 path B (`/organisers/{slug}` only). */
function isPublicOrganiserProfilePath(pathname) {
  return /^\/organisers\/[^/]+$/i.test(String(pathname || ''));
}

/** Soft-launch /peek mini-site → live marketing pages (retired after public launch). */
function retiredPeekRedirectPath(pathname) {
  const path = String(pathname || '').replace(/\/$/, '') || '/';
  if (path === '/peek' || path === '/peek/index') return '/';
  if (path === '/peek/about-us') return '/about';
  if (path === '/peek/for-organisers') return '/for-organisers';
  if (path === '/peek/for-networkers' || path === '/peek/for-attendees') return '/for-networkers';
  return null;
}

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
  out = out.replace(/<html(\s[^>]*)?>/i, function (match) {
    if (/\sdata-hub-seo-injected(?:\s|=|>)/i.test(match)) return match;
    return match.replace(/>$/, ' data-hub-seo-injected="true">');
  });

  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, headTags + '</head>');
  }
  return out.replace(/<head[^>]*>/i, function (match) {
    return match + '\n' + headTags;
  });
}

/** Edge-safe copy of api/_lib/networking-region-themes.js accents + landmarks. */
const NETWORKING_REGION_THEMES = {
  "online": {
    "tagline": "Webinars and virtual meetings you can join from anywhere.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><rect x=\"56\" y=\"16\" width=\"128\" height=\"56\" rx=\"3\" stroke-width=\"2\"/><rect x=\"64\" y=\"24\" width=\"112\" height=\"40\" rx=\"2\" opacity=\".45\"/><circle cx=\"120\" cy=\"44\" r=\"16\" stroke-width=\"1.8\"/><ellipse cx=\"120\" cy=\"44\" rx=\"16\" ry=\"6\" opacity=\".45\"/><path d=\"M96 44h48M120 28v32\" opacity=\".45\"/><path d=\"M88 82h64\" stroke-width=\"2\"/><path d=\"M120 74v8M108 82h24\"/></svg>"
  },
  "central-london": {
    "tagline": "From the City to Westminster and the West End.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><rect x=\"96\" y=\"18\" width=\"48\" height=\"64\"/><path d=\"M96 34h48M96 50h48M96 66h48\" opacity=\".35\"/><rect x=\"102\" y=\"4\" width=\"36\" height=\"18\"/><circle cx=\"120\" cy=\"13\" r=\"8\"/><path d=\"M120 13v-5M120 13l4 3\"/><path d=\"M110 4V0h20v4\"/><path d=\"M120-2v2\"/><rect x=\"106\" y=\"42\" width=\"8\" height=\"10\" opacity=\".5\"/><rect x=\"126\" y=\"42\" width=\"8\" height=\"10\" opacity=\".5\"/><path d=\"M140 24l6 6M140 36l6 6M140 48l6 6M140 60l6 6\" opacity=\".3\"/></svg>"
  },
  "north-london": {
    "tagline": "From Camden and Islington to Hampstead and Highgate.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82V52h36v30M180 82V52h36v30\"/><path d=\"M52 82V40h28v42M160 82V40h28v42\"/><path d=\"M72 82V32h96v50\"/><path d=\"M84 32c0-20 10-28 28-28s28 8 28 28\"/><ellipse cx=\"112\" cy=\"18\" rx=\"30\" ry=\"12\"/><path d=\"M112 2v8\"/><path d=\"M88 52h8v14M104 52h8v14M120 52h8v14M136 52h8v14\" opacity=\".5\"/></svg>"
  },
  "south-london": {
    "tagline": "From South Bank and Brixton to Croydon and Greenwich.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M40 82c0-42 26-64 80-64s80 22 80 64\" stroke-width=\"2.2\"/><path d=\"M60 78c4-34 16-50 40-50M120 28c24 0 36 16 40 50M80 78c2-26 10-40 20-42M160 78c-2-26-10-40-20-42\" opacity=\".4\"/><path d=\"M120 8v18M52 58l-14-22M188 58l14-22M68 42l-12-16M172 42l12-16M88 26l-6-16M152 26l6-16\" stroke-width=\"1.8\"/></svg>"
  },
  "east-london": {
    "tagline": "From Shoreditch and Canary Wharf to Stratford and the docks.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M36 82V28h36v54M168 82V28h36v54\"/><path d=\"M30 28h48v12H30zM162 28h48v12H162z\"/><path d=\"M42 28V12h8v16M58 28V12h8v16M174 28V12h8v16M190 28V12h8v16\"/><path d=\"M72 36h96M72 42h96\"/><path d=\"M78 36l8 6M96 36l8 6M114 36l8 6M132 36l8 6M86 42l-8-6M104 42l-8-6M122 42l-8-6M140 42l-8-6\" opacity=\".45\"/><path d=\"M72 56h96\" stroke-width=\"2\"/><rect x=\"46\" y=\"48\" width=\"10\" height=\"12\" opacity=\".5\"/><rect x=\"184\" y=\"48\" width=\"10\" height=\"12\" opacity=\".5\"/></svg>"
  },
  "west-london": {
    "tagline": "From Kensington and Notting Hill to Hammersmith and Heathrow corridor.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M32 82V40h40v42M80 82V28h40v54M128 82V40h40v42M176 82V48h32v34\"/><path d=\"M44 40V12h12v28M96 28V6h12v22M144 40V12h12v28M188 48V20h12v28\"/><path d=\"M42 12h16M94 6h16M142 12h16M186 20h16\"/><path d=\"M40 56h16v10H40zM92 48h16v10H92zM136 56h16v10h-16z\" opacity=\".5\"/></svg>"
  },
  "manchester": {
    "tagline": "From the Northern Quarter to Salford Quays and beyond.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V24h32v58\"/><path d=\"M108 24V4h24v20\"/><path d=\"M98 24h44\" stroke-width=\"2\"/><path d=\"M104 36h32M104 48h32M104 60h32M104 72h32\" opacity=\".4\"/><path d=\"M114 24v58M126 24v58\" opacity=\".35\"/><path d=\"M90 82h60\" stroke-width=\"2\"/></svg>"
  },
  "liverpool": {
    "tagline": "From the Albert Dock and Baltic Triangle to the wider Merseyside business community.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M40 82V28h40v54M160 82V16h40v66\"/><circle cx=\"60\" cy=\"42\" r=\"10\"/><circle cx=\"180\" cy=\"32\" r=\"10\"/><path d=\"M48 20c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M168 8c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M80 62h80v20H80z\"/><path d=\"M48 56h24M48 68h24M168 48h24M168 60h24\" opacity=\".4\"/></svg>"
  },
  "leeds": {
    "tagline": "From the city centre to the wider West Yorkshire business community.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M36 82V52h168v30\"/><path d=\"M48 52v28M72 52v28M96 52v28M144 52v28M168 52v28M192 52v28\" opacity=\".45\"/><path d=\"M36 52l84-22 84 22\"/><path d=\"M100 40V10h40v30\"/><circle cx=\"120\" cy=\"24\" r=\"10\"/><path d=\"M120 24v-6M120 24l5 3\"/><path d=\"M104 10h32l-4-8h-24z\"/><path d=\"M120 2v-4\"/></svg>"
  },
  "chester": {
    "tagline": "From the city walls and Rows to the wider Cheshire business network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V32h120v50\"/><path d=\"M80 82V50c0-14 10-22 40-22s40 8 40 22v32\" opacity=\".55\"/><path d=\"M72 32h96v28H72z\"/><circle cx=\"120\" cy=\"46\" r=\"12\"/><path d=\"M120 46v-8M120 46l6 4\"/><path d=\"M84 32l10-16h52l10 16\"/></svg>"
  },
  "cheshire": {
    "tagline": "From Chester and Crewe to Warrington and the wider Cheshire business network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V32h120v50\"/><path d=\"M80 82V50c0-14 10-22 40-22s40 8 40 22v32\" opacity=\".55\"/><path d=\"M72 32h96v28H72z\"/><circle cx=\"120\" cy=\"46\" r=\"12\"/><path d=\"M120 46v-8M120 46l6 4\"/><path d=\"M84 32l10-16h52l10 16\"/></svg>"
  },
  "lancashire": {
    "tagline": "From Preston and Blackpool to Burnley and business communities across Lancashire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M40 82V28h40v54M160 82V16h40v66\"/><circle cx=\"60\" cy=\"42\" r=\"10\"/><circle cx=\"180\" cy=\"32\" r=\"10\"/><path d=\"M48 20c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M168 8c0-12 6-18 10-18 2 0 4 4 6 8l4-12c4 8 6 16 4 22\"/><path d=\"M80 62h80v20H80z\"/><path d=\"M48 56h24M48 68h24M168 48h24M168 60h24\" opacity=\".4\"/></svg>"
  },
  "newcastle": {
    "tagline": "From the Quayside and city centre to the wider North East.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82V40h32v42M180 82V40h32v42\"/><path d=\"M20 40c56-40 112-40 168 0\" stroke-width=\"2.4\"/><path d=\"M40 44c40-28 80-28 120 0\" opacity=\".45\"/><path d=\"M48 54h144\" stroke-width=\"2\"/><path d=\"M60 42v12M90 32v22M120 32v22M150 32v22M180 42v12\" opacity=\".55\"/></svg>"
  },
  "birmingham": {
    "tagline": "From Digbeth and the Jewellery Quarter to the wider Midlands.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M90 38C54 34 42 10 56-4c0 20 14 36 34 46M150 38c36-4 48-28 34-42 0 20-14 36-34 46\" stroke-width=\"3\"/><path d=\"M84 44l-14 4 4 14 14-8M156 44l14 4-4 14-14-8\"/><path d=\"M88 36h64l4 14H84z\"/><path d=\"M84 50c-2 18 4 34 16 44h40c12-10 18-26 16-44\"/><circle cx=\"104\" cy=\"58\" r=\"4\"/><circle cx=\"136\" cy=\"58\" r=\"4\"/><path d=\"M100 70h40v16H100z\"/><path d=\"M110 76v5M130 76v5\" stroke-width=\"2\"/><circle cx=\"120\" cy=\"92\" r=\"9\"/><path d=\"M120 83v-4\"/></svg>"
  },
  "nottingham": {
    "tagline": "From the Lace Market and city centre to the wider East Midlands.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82c14-18 36-26 92-26s78 8 92 26\"/><path d=\"M48 62V34h144v28\"/><path d=\"M88 34l32-22 32 22\"/><path d=\"M108 62v-20c0-8 5-12 12-12s12 4 12 12v20\" opacity=\".55\"/><path d=\"M48 34V20h22v14M170 34V20h22v14\"/><path d=\"M120 12V0M120 0h16l-4 4 4 4h-16\"/></svg>"
  },
  "sheffield": {
    "tagline": "From the city centre to business communities across South Yorkshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M28 82V44h48v38M88 82V24h52v58M152 82V52h48v30\"/><path d=\"M28 44l12-14 12 14 12-14\"/><path d=\"M88 24l14-16 14 16 14-16\"/><path d=\"M40 30V8h8v22M108 14V0h8v14M168 40V18h8v22\"/><path d=\"M36 56h12v12H36zM100 44h12v12h-12z\" opacity=\".5\"/></svg>"
  },
  "bristol": {
    "tagline": "From Temple Meads and the Harbourside to Clifton and beyond.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M32 82V28h28v54M180 82V28h28v54\"/><path d=\"M24 36c48-32 96-32 144 0\" stroke-width=\"2.2\"/><path d=\"M36 44c36-20 72-20 108 0\" opacity=\".45\"/><path d=\"M60 52h120\" stroke-width=\"2\"/><path d=\"M72 36v16M96 28v24M120 28v24M144 28v24M168 36v16\" opacity=\".5\"/></svg>"
  },
  "brighton": {
    "tagline": "From the seafront and creative quarter to the wider Sussex coast.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V44c10-32 24-44 60-44s50 12 60 44v38\"/><path d=\"M100 22c0-16 8-24 20-24s20 8 20 24\"/><path d=\"M40 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M164 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M100 58c0-6 4-10 8-10s8 4 8 10v14h-16V58z\" opacity=\".5\"/></svg>"
  },
  "cambridge": {
    "tagline": "From the science park and city centre to the wider Cambridgeshire network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><path d=\"M48 82V24h144v58\"/><path d=\"M52 24V6h28v18M160 24V6h28v18\"/><path d=\"M60 6l6-8 6 8M168 6l6-8 6 8\"/><path d=\"M96 36c0-12 8-18 16-18s16 6 16 18v28H96V36z\" opacity=\".55\"/><path d=\"M48 48h144M48 64h144\" opacity=\".3\"/></svg>"
  },
  "oxford": {
    "tagline": "From the city centre to business communities across Oxfordshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><circle cx=\"120\" cy=\"42\" r=\"36\"/><path d=\"M90 34c8-28 20-40 30-40s22 12 30 40\"/><path d=\"M120 2v8\"/><path d=\"M88 42v28M100 36v34M120 32v38M140 36v34M152 42v28\" opacity=\".45\"/><path d=\"M84 70h72v12H84z\"/></svg>"
  },
  "surrey": {
    "tagline": "From Guildford and Woking to Reigate and business communities across Surrey.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V12h32v70\"/><path d=\"M90 82h60\" stroke-width=\"2\"/><path d=\"M104 28h32M104 44h32M104 60h32\" opacity=\".4\"/><path d=\"M112 12V0h16v12\"/><path d=\"M140 24l8 6M140 44l8 6M140 64l8 6\" opacity=\".3\"/></svg>"
  },
  "kent": {
    "tagline": "From Canterbury and Maidstone to Tunbridge Wells and the wider Kent network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V44c10-32 24-44 60-44s50 12 60 44v38\"/><path d=\"M100 22c0-16 8-24 20-24s20 8 20 24\"/><path d=\"M40 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M164 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M100 58c0-6 4-10 8-10s8 4 8 10v14h-16V58z\" opacity=\".5\"/></svg>"
  },
  "hampshire": {
    "tagline": "From Southampton and Portsmouth to Winchester and business communities across Hampshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M40 82h160\" opacity=\".35\"/><path d=\"M48 82V56h24v26M168 82V56h24v26\"/><path d=\"M72 56h96\" stroke-width=\"2\"/><path d=\"M80 56V42h80v14\"/><path d=\"M72 42l48-16 48 16\"/><path d=\"M104 30v12M128 30v12\" opacity=\".45\"/></svg>"
  },
  "essex": {
    "tagline": "From Chelmsford and Colchester to Southend and business communities across Essex.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><path d=\"M48 82V24h144v58\"/><path d=\"M52 24V6h28v18M160 24V6h28v18\"/><path d=\"M60 6l6-8 6 8M168 6l6-8 6 8\"/><path d=\"M96 36c0-12 8-18 16-18s16 6 16 18v28H96V36z\" opacity=\".55\"/><path d=\"M48 48h144M48 64h144\" opacity=\".3\"/></svg>"
  },
  "hertfordshire": {
    "tagline": "From St Albans and Watford to Hertford and business communities across Hertfordshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><circle cx=\"120\" cy=\"42\" r=\"36\"/><path d=\"M90 34c8-28 20-40 30-40s22 12 30 40\"/><path d=\"M120 2v8\"/><path d=\"M88 42v28M100 36v34M120 32v38M140 36v34M152 42v28\" opacity=\".45\"/><path d=\"M84 70h72v12H84z\"/></svg>"
  },
  "berkshire": {
    "tagline": "From Reading and Maidenhead to Newbury and business communities across Berkshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V12h32v70\"/><path d=\"M90 82h60\" stroke-width=\"2\"/><path d=\"M104 28h32M104 44h32M104 60h32\" opacity=\".4\"/><path d=\"M112 12V0h16v12\"/><path d=\"M140 24l8 6M140 44l8 6M140 64l8 6\" opacity=\".3\"/></svg>"
  },
  "oxfordshire": {
    "tagline": "From Oxford and Banbury to Abingdon and business communities across Oxfordshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><circle cx=\"120\" cy=\"42\" r=\"36\"/><path d=\"M90 34c8-28 20-40 30-40s22 12 30 40\"/><path d=\"M120 2v8\"/><path d=\"M88 42v28M100 36v34M120 32v38M140 36v34M152 42v28\" opacity=\".45\"/><path d=\"M84 70h72v12H84z\"/></svg>"
  },
  "buckinghamshire": {
    "tagline": "From High Wycombe and Aylesbury to Milton Keynes and business communities across Buckinghamshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V12h32v70\"/><path d=\"M90 82h60\" stroke-width=\"2\"/><path d=\"M104 28h32M104 44h32M104 60h32\" opacity=\".4\"/><path d=\"M112 12V0h16v12\"/><path d=\"M140 24l8 6M140 44l8 6M140 64l8 6\" opacity=\".3\"/></svg>"
  },
  "cambridgeshire": {
    "tagline": "From Cambridge and Ely to Peterborough and business communities across Cambridgeshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M24 82h192\" opacity=\".35\"/><path d=\"M48 82V24h144v58\"/><path d=\"M52 24V6h28v18M160 24V6h28v18\"/><path d=\"M60 6l6-8 6 8M168 6l6-8 6 8\"/><path d=\"M96 36c0-12 8-18 16-18s16 6 16 18v28H96V36z\" opacity=\".55\"/><path d=\"M48 48h144M48 64h144\" opacity=\".3\"/></svg>"
  },
  "sussex": {
    "tagline": "From Brighton and Worthing to Eastbourne, Chichester and business communities across Sussex.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M60 82V44c10-32 24-44 60-44s50 12 60 44v38\"/><path d=\"M100 22c0-16 8-24 20-24s20 8 20 24\"/><path d=\"M40 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M164 82V56c4-14 10-20 18-20s14 6 18 20v26\"/><path d=\"M100 58c0-6 4-10 8-10s8 4 8 10v14h-16V58z\" opacity=\".5\"/></svg>"
  },
  "glasgow": {
    "tagline": "Connect with entrepreneurs across the Clyde and the city centre.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M56 82V20h14v62\"/><path d=\"M56 34l14 10M56 50l14 10M56 66l14 10M70 34l-14 10M70 50l-14 10M70 66l-14 10\" opacity=\".45\"/><path d=\"M36 20h140v12H36z\"/><path d=\"M48 20l16 12M80 20l16 12M112 20l16 12M144 20l16 12M64 32l-16-12M96 32l-16-12M128 32l-16-12M160 32l-16-12\" opacity=\".5\"/><path d=\"M156 32v36\"/><path d=\"M148 68h16\"/></svg>"
  },
  "edinburgh": {
    "tagline": "From the Old Town and New Town to Leith and the wider Lothians.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><path d=\"M24 82L40 56l16 10 20-36 16 8 24-32 16 14 20-18 16 20 20 40v20H24z\" stroke-width=\"2\"/><path d=\"M72 48h96\" stroke-width=\"2.2\"/><path d=\"M72 48V28h24v20M96 48V16h40v32M136 48V30h28v18\"/><path d=\"M72 28h3v-5h4v5h4v-5h4v5h5\"/><path d=\"M96 16h4v-5h5v5h5v-5h5v5h5v-5h5v5h6\"/><path d=\"M136 30h3v-5h4v5h4v-5h4v5h5\"/><path d=\"M116 16V2M116 2h14l-4 4 4 4h-14\"/><path d=\"M84 36h6v8M112 28h8v10M148 36h6v8\" opacity=\".5\"/></svg>"
  },
  "cardiff": {
    "tagline": "From the bay and city centre to business networks across South Wales.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 82h208\" opacity=\".35\"/><ellipse cx=\"120\" cy=\"42\" rx=\"88\" ry=\"28\"/><ellipse cx=\"120\" cy=\"42\" rx=\"52\" ry=\"14\" opacity=\".45\"/><path d=\"M40 42h160\" opacity=\".4\"/><path d=\"M48 62c18 14 44 20 72 20s54-6 72-20\" opacity=\".5\"/><path d=\"M40 62V42M200 62V42\"/></svg>"
  },
  "belfast": {
    "tagline": "From the Cathedral Quarter and Titanic Quarter to business networks across Belfast.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M48 82V44h144v38\"/><path d=\"M48 44l72-18 72 18\"/><path d=\"M96 44V24h48v20\"/><circle cx=\"120\" cy=\"34\" r=\"10\"/><path d=\"M108 24h24l-4-10h-16z\"/><path d=\"M120 14v4\"/><path d=\"M64 56h16M160 56h16\" opacity=\".45\"/></svg>"
  },
  "reading": {
    "tagline": "From the town centre and Thames Valley to business communities across Berkshire.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M104 82V12h32v70\"/><path d=\"M90 82h60\" stroke-width=\"2\"/><path d=\"M104 28h32M104 44h32M104 60h32\" opacity=\".4\"/><path d=\"M112 12V0h16v12\"/><path d=\"M140 24l8 6M140 44l8 6M140 64l8 6\" opacity=\".3\"/></svg>"
  },
  "leicester": {
    "tagline": "From the Golden Mile and city centre to the wider Leicestershire network.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M96 82V34h48v48\"/><path d=\"M92 34h56\"/><path d=\"M104 34V16h32v18\"/><circle cx=\"120\" cy=\"26\" r=\"9\"/><path d=\"M120 26v-5M120 26l4 3\"/><path d=\"M108 16h24l-3-8h-18z\"/><path d=\"M120 8v4\"/></svg>"
  },
  "bournemouth": {
    "tagline": "From the seafront and BIC to business communities across Dorset.",
    "landmark": "<svg class=\"networking-region-landmark-svg\" viewBox=\"0 0 240 90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 82h200\" opacity=\".35\"/><path d=\"M40 82h160\" opacity=\".35\"/><path d=\"M48 82V56h24v26M168 82V56h24v26\"/><path d=\"M72 56h96\" stroke-width=\"2\"/><path d=\"M80 56V42h80v14\"/><path d=\"M72 42l48-16 48 16\"/><path d=\"M104 30v12M128 30v12\" opacity=\".45\"/></svg>"
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
    '<p class="events-hero-badge" id="events-hero-badge">' +
      (region.areaType === 'county' ? 'County networking directory' : 'Local networking directory') +
      '</p>'
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

  if (meta.listingsHtml) {
    out = out.replace(/<div class="event-listings" id="event-listings"><\/div>/i, meta.listingsHtml);
  }

  if (region.location) {
    const locVal = escapeHtml(region.location);
    out = out.replace(
      /(<input[^>]*\bid="postcode"[^>]*)(>)/i,
      function (match, before, close) {
        if (/\bvalue=/i.test(before)) return match;
        return before + ' value="' + locVal + '"' + close;
      }
    );
  }

  if (typeof meta.listingsTotal === 'number' && meta.listingsTotal >= 0) {
    out = out.replace(
      /<strong id="results-count">[\s\S]*?<\/strong>/i,
      '<strong id="results-count">' + escapeHtml(String(meta.listingsTotal)) + '</strong>'
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

function isInternalSalesPath(pathname) {
  if (/^\/p-tnh-[a-z0-9-]+(?:\.html)?$/i.test(pathname)) return true;
  if (/^\/p\/tnh-[a-z0-9-]+(?:\.html)?$/i.test(pathname)) return true;
  if (pathname.startsWith('/marketing/internal/')) return true;
  return INTERNAL_SALES_PREFIXES.some(function (prefix) {
    return pathname === prefix || pathname.startsWith(prefix + '/');
  });
}

function isOrganiserEarlyAccessPath(pathname) {
  if (isPublicOrganiserProfilePath(pathname)) return true;
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
  if (isTicketEmbedPath(pathname)) return true;
  if (isInternalSalesPath(pathname)) return true;
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

  // Preview cookie unlocks browse for anyone who knows the shared password.
  // Signed-in hub sessions unlock separately via hasValidSession in the gate.
  if (previewSecret) {
    const preview = await verifySignedToken(cookies[SITE_ACCESS_COOKIE], previewSecret);
    if (preview && preview.type === SITE_PREVIEW_TOKEN_TYPE) return true;
  }

  return false;
}

/** Signed-in user (organiser/member) with a valid hub_session — used for early-access APIs. */
async function hasValidSession(request) {
  const secret = String(process.env.SESSION_SECRET || '').trim();
  if (!secret) return false;
  const cookies = parseCookies(request);
  const session = await verifySignedToken(cookies.hub_session, secret);
  return Boolean(session && (session.email || session.sub));
}

function sitePrivateResponse() {
  return new Response(
    JSON.stringify({ error: 'site_private', message: 'Site is in private preview.' }),
    {
      status: 403,
      headers: withNoIndexHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      }),
    }
  );
}

async function maybeGateSiteAccess(request, url) {
  if (!isSiteAccessGateActive()) return null;

  const password = String(process.env.SITE_ACCESS_PASSWORD || '').trim();
  if (!password) return null;

  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const search = url.search || '';
  const host = String(url.hostname || '')
    .trim()
    .toLowerCase();

  // International + market preview domains are public — never send through Hub preview.
  if (isPublicMarketHost(host)) return null;

  if (isGateBypassPath(pathname)) return null;

  // Public opportunities API: reachable by preview-cookie holders and signed-in
  // organisers/members only — never anonymously while the gate is on. This keeps the
  // organiser premium-slots flow working without exposing the catalogue to the public.
  if (pathname === '/api/opportunities' || pathname.startsWith('/api/opportunities/')) {
    if ((await hasSiteAccess(request)) || (await hasValidSession(request))) {
      return { authorized: true };
    }
    return sitePrivateResponse();
  }

  // Event/organiser listing detail APIs power public listing pages opened from shared
  // social captions. Allow single-item fetches (id/slug) so the page can render; keep
  // browse/list payloads (and the nav catalogue probe) gated until launch — same as
  // HTML /events redirects for soft-launch claim sessions.
  if (
    pathname === '/api/hub-listings' ||
    pathname === '/api/events' ||
    pathname.startsWith('/api/hub-listings/') ||
    pathname.startsWith('/api/events/')
  ) {
    const hasDetail = url.searchParams.get('id') || url.searchParams.get('slug');
    if (hasDetail) return null;
    if (await hasSiteAccess(request)) {
      return { authorized: true };
    }
    if (await hasValidSession(request)) {
      const secret = String(process.env.SESSION_SECRET || '').trim();
      const cookies = parseCookies(request);
      const session = secret ? await verifySignedToken(cookies.hub_session, secret) : null;
      const role = String((session && session.role) || '')
        .trim()
        .toLowerCase();
      // Platform admins keep catalogue access for support; organisers/members do not.
      if (role === 'admin') {
        return { authorized: true };
      }
    }
    return sitePrivateResponse();
  }

  // Email 2 path B: anonymous claim links may load one public organiser (+ siblings).
  // Full catalogue list stays gated until preview cookie / signed-in session.
  if (pathname === '/api/organisers' || pathname.startsWith('/api/organisers/')) {
    const hasDetail =
      url.searchParams.get('slug') ||
      url.searchParams.get('id') ||
      url.searchParams.get('claim_email');
    if (hasDetail) return null;
    if ((await hasSiteAccess(request)) || (await hasValidSession(request))) {
      return { authorized: true };
    }
    return sitePrivateResponse();
  }

  // Command Centre API: signed-in hub users (admin gate is enforced in the handler).
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    if ((await hasSiteAccess(request)) || (await hasValidSession(request))) {
      return { authorized: true };
    }
    return sitePrivateResponse();
  }

  // Let social crawlers fetch listing HTML + OG tags (still noindexed via authorized path).
  if (isSocialCrawler(request) && isPublicListingPath(pathname, url.searchParams)) {
    return { authorized: true, socialCrawler: true };
  }

  const previewInternalSeo = matchesInternalSeoHeader(
    request.headers.get('x-hub-internal-seo')
  );
  const internalSeoTemplate =
    pathname === '/events' ||
    pathname === '/events/index' ||
    pathname === '/events/event' ||
    pathname === '/events/organiser' ||
    pathname === '/opportunities/opportunity' ||
    pathname === '/rankings/badge' ||
    pathname === '/rankings/badge.html';
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

  // Soft launch: signed-in claim/organiser sessions unlock the workspace only
  // (early-access paths already bypass above). Do NOT open public browse until
  // SITE_ACCESS_PASSWORD is removed on 25 August (public browsing). Team preview still uses the
  // password cookie. Platform admins keep full access for support.
  // Individual listing pages stay reachable so organisers can preview their own
  // public event / organiser URLs after publishing.
  if (await hasValidSession(request)) {
    const secret = String(process.env.SESSION_SECRET || '').trim();
    const cookies = parseCookies(request);
    const session = secret ? await verifySignedToken(cookies.hub_session, secret) : null;
    const role = String((session && session.role) || '')
      .trim()
      .toLowerCase();
    if (role === 'admin') {
      return { authorized: true };
    }
    if (isPublicListingPath(pathname, url.searchParams)) {
      return { authorized: true };
    }
    // Friendly soft-launch: send workspace users to /organiser/ instead of the
    // password wall when they hit the public catalogue from top nav.
    if (
      pathname === '/' ||
      pathname === '/index' ||
      pathname === '/index.html' ||
      pathname === '/events' ||
      pathname === '/events/index' ||
      pathname === '/events/' ||
      pathname === '/opportunities' ||
      pathname === '/opportunities/' ||
      pathname === '/rankings' ||
      pathname === '/rankings/' ||
      pathname === '/organisers' ||
      pathname === '/organisers/'
    ) {
      return Response.redirect(new URL('/organiser/', url.origin).toString(), 302);
    }
    // Nested catalogue browse paths (filters, etc.) — still soft-launch locked.
    if (
      pathname.startsWith('/events/') ||
      pathname.startsWith('/opportunities/') ||
      pathname.startsWith('/rankings/') ||
      pathname.startsWith('/networking/')
    ) {
      return Response.redirect(new URL('/organiser/', url.origin).toString(), 302);
    }
    return gateRedirect(url, pathname, search);
  }

  // Early-access paths (including /organiser claim) already returned above via
  // isGateBypassPath.

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
    return sitePrivateResponse();
  }

  return gateRedirect(url, pathname, search);
}

function passThroughIfGated(gated) {
  if (!gated) return;
  // Continue to static asset / rewrite; noindex is enforced on blocked paths and SEO responses.
}

export const config = {
  // Include robots/llms/agents so the gate can Disallow crawlers and 403 discovery
  // files until SITE_ACCESS_PASSWORD is removed. Static robots.txt says Allow — do not
  // serve that while the preview gate is on.
  // international/index.html is excluded so middleware can safely fetch it for host rewrites.
  matcher: [
    '/((?!api/stripe-webhook|api/resend-webhook|api/sponsor-out|api/health|_next/static|_next/image|favicon.ico|css/|js/|assets/|data/|international/index\\.html|international/ireland/index\\.html|international/united-states/index\\.html).*)',
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const host = String(url.hostname || '')
    .trim()
    .toLowerCase();
  // Hub brand domains → canonical UK host (DNS live; consolidates Search Console / Google listing).
  // Legacy WordPress domain (early SEO flip — MX stays on co.uk DNS; web only on Vercel).
  if (
    host === 'thenetworkerhub.com' ||
    host === 'www.thenetworkerhub.com' ||
    host === 'thenetworkerhub.co.uk' ||
    host === 'www.thenetworkerhub.co.uk' ||
    host === 'the-networker.co.uk' ||
    host === 'www.the-networker.co.uk'
  ) {
    const dest = new URL(request.url);
    dest.protocol = 'https:';
    dest.hostname = 'www.thenetworkeruk.com';
    dest.port = '';
    return Response.redirect(dest.toString(), 308);
  }
  if (host === 'thenetworkeruk.com') {
    const dest = new URL(request.url);
    dest.protocol = 'https:';
    dest.hostname = 'www.thenetworkeruk.com';
    dest.port = '';
    return Response.redirect(dest.toString(), 308);
  }
  if (host === 'thenetworkerinternational.com') {
    const dest = new URL(request.url);
    dest.protocol = 'https:';
    dest.hostname = 'www.thenetworkerinternational.com';
    dest.port = '';
    return Response.redirect(dest.toString(), 308);
  }

  if (host === 'thenetworkerireland.com') {
    const dest = new URL(request.url);
    dest.protocol = 'https:';
    dest.hostname = 'www.thenetworkerireland.com';
    dest.port = '';
    return Response.redirect(dest.toString(), 308);
  }
  if (host === 'thenetworkerusa.com') {
    const dest = new URL(request.url);
    dest.protocol = 'https:';
    dest.hostname = 'www.thenetworkerusa.com';
    dest.port = '';
    return Response.redirect(dest.toString(), 308);
  }

  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Soft-launch /peek mini-site retired — send bookmarks and co.uk banner links live.
  const peekLive = retiredPeekRedirectPath(pathname);
  if (peekLive) {
    const dest = new URL(peekLive, url.origin);
    dest.search = url.search || '';
    return Response.redirect(dest.toString(), 301);
  }

  // Market preview domains (Ireland / USA): always serve the coming-soon gate.
  if (isMarketPreviewHost(host) && request.headers.get('x-market-preview-fetch') !== '1') {
    if (
      pathname.startsWith('/api/international-') ||
      pathname.startsWith('/css/') ||
      pathname.startsWith('/js/') ||
      pathname.startsWith('/assets/') ||
      pathname === '/favicon.ico'
    ) {
      /* allow static + interest APIs */
    } else {
      try {
        const htmlRes = await fetch(new URL('/market-preview', url.origin).toString(), {
          headers: { 'x-market-preview-fetch': '1' },
        });
        if (htmlRes.ok) {
          return new Response(await htmlRes.text(), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, must-revalidate',
            },
          });
        }
      } catch {
        /* fall through */
      }
    }
  }

  // International domain: homepage is the world-map landing (root index.html is the UK home).
  // Subrequests use x-intl-landing-fetch to avoid recursion when we pull the HTML.
  if (isInternationalHost(host) && request.headers.get('x-intl-landing-fetch') !== '1') {
    // Root robots.txt / llms.txt / agents.txt are UK static files — Vercel serves them
    // before host rewrites. Proxy the International copies here instead.
    const intlDiscovery = {
      '/robots.txt': { path: '/international/robots.txt', type: 'text/plain; charset=utf-8' },
      '/llms.txt': { path: '/international/llms.txt', type: 'text/plain; charset=utf-8' },
      '/agents.txt': { path: '/international/agents.txt', type: 'text/plain; charset=utf-8' },
      '/sitemap.xml': { path: '/international/sitemap.xml', type: 'application/xml; charset=utf-8' },
    };
    const discovery = intlDiscovery[pathname];
    if (discovery) {
      try {
        const fileRes = await fetch(new URL(discovery.path, url.origin).toString(), {
          headers: { 'x-intl-landing-fetch': '1' },
        });
        if (fileRes.ok) {
          return new Response(await fileRes.text(), {
            status: 200,
            headers: {
              'Content-Type': discovery.type,
              'Cache-Control': 'public, max-age=3600, must-revalidate',
            },
          });
        }
      } catch {
        /* fall through */
      }
    }

    if (
      pathname === '/' ||
      pathname === '/international' ||
      pathname === '/international/index.html'
    ) {
      try {
        const htmlRes = await fetch(new URL('/international', url.origin).toString(), {
          headers: { 'x-intl-landing-fetch': '1' },
        });
        if (htmlRes.ok) {
          return new Response(await htmlRes.text(), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, must-revalidate',
            },
          });
        }
      } catch {
        /* fall through */
      }
    }

    const intlCountryPages = {
      '/ireland': '/international/ireland',
      '/united-states': '/international/united-states',
    };
    const countryPage = intlCountryPages[pathname];
    if (countryPage) {
      try {
        const htmlRes = await fetch(new URL(countryPage, url.origin).toString(), {
          headers: { 'x-intl-landing-fetch': '1' },
        });
        if (htmlRes.ok) {
          return new Response(await htmlRes.text(), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, must-revalidate',
            },
          });
        }
      } catch {
        /* fall through */
      }
    }

    if (
      !pathname.startsWith('/api/international-') &&
      !pathname.startsWith('/css/') &&
      !pathname.startsWith('/js/') &&
      !pathname.startsWith('/assets/') &&
      !pathname.startsWith('/data/') &&
      !pathname.startsWith('/international/ireland') &&
      !pathname.startsWith('/international/united-states') &&
      pathname !== '/favicon.ico' &&
      pathname !== '/robots.txt' &&
      pathname !== '/sitemap.xml' &&
      pathname !== '/llms.txt' &&
      pathname !== '/agents.txt' &&
      pathname !== '/ireland' &&
      pathname !== '/united-states'
    ) {
      const dest = new URL(request.url);
      dest.protocol = 'https:';
      dest.hostname = 'www.thenetworkeruk.com';
      dest.port = '';
      return Response.redirect(dest.toString(), 302);
    }
  }

  const gateResult = await maybeGateSiteAccess(request, url);
  if (gateResult instanceof Response) return gateResult;

  const siteGated = Boolean(gateResult && gateResult.authorized);

  // cleanUrls maps embed/event.html → /embed/event, so /embed/event/:slug is not a
  // valid filesystem child and Vercel rewrites 404. Serve the widget HTML here;
  // the browser URL keeps the slug path for embed-event.js.
  const embedSlugMatch = pathname.match(/^\/embed\/event\/([^/]+)$/i);
  if (embedSlugMatch) {
    const embedSlug = decodeURIComponent(embedSlugMatch[1] || '').trim();
    if (embedSlug && !/\.html$/i.test(embedSlug)) {
      try {
        const htmlRes = await fetch(new URL('/embed/event', url.origin).toString());
        if (htmlRes.ok) {
          return new Response(await htmlRes.text(), {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'public, max-age=60, must-revalidate',
              'X-Robots-Tag': NOINDEX_HEADER,
            },
          });
        }
      } catch {
        /* fall through to static / 404 */
      }
    }
  }

  let type;
  let slug;
  let templatePath;

  const eventMatch = pathname.match(/^\/events\/([^/]+)$/);
  const orgMatch = pathname.match(/^\/organisers\/([^/]+)$/);
  const oppMatch = pathname.match(/^\/opportunities\/([^/]+)$/);
  const networkingMatch = pathname.match(/^\/networking\/([^/]+)$/);
  const rankingBadgePath = pathname === '/rankings/badge';

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
  } else if (rankingBadgePath) {
    type = 'ranking-badge';
    slug =
      url.searchParams.get('id') ||
      url.searchParams.get('organiserId') ||
      url.searchParams.get('organiser') ||
      url.searchParams.get('slug') ||
      'default';
    templatePath = '/rankings/badge.html';
  } else {
    return passThroughIfGated(siteGated);
  }

  try {
    const metaUrl = new URL('/api/seo-meta', url.origin);
    metaUrl.searchParams.set('type', type);
    metaUrl.searchParams.set('slug', slug);

    const seoSecret = getInternalSeoSecret();
    const internalHeaders =
      isSiteAccessGateActive() && String(process.env.SITE_ACCESS_PASSWORD || '').trim() && seoSecret
        ? { 'x-hub-internal-seo': seoSecret }
        : {};
    const [metaRes, htmlRes] = await Promise.all([
      fetch(metaUrl.toString(), {
        headers: {
          'x-forwarded-host': url.host,
          ...internalHeaders,
        },
      }),
      fetch(new URL(templatePath, url.origin).toString(), {
        headers: internalHeaders,
      }),
    ]);
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
