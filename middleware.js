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
  if (/^\/opportunities\/networking\/[^/]+$/.test(path)) return true;
  return false;
}

// Keep discovery files (llms.txt / agents.txt / sitemap) gated until public launch.
const GATE_BYPASS_PREFIXES = [
  '/api/stripe-webhook',
  '/api/cron/',
  '/api/site-access',
  '/api/auth/site-access',
  '/site-access',
  '/site-access.html',
  '/css/',
  '/js/',
  '/assets/',
];

/** Unlisted internal sales decks — not linked from nav; noindex in page HTML. */
const INTERNAL_SALES_PREFIXES = [
  '/p-tnh-ev-hub-k7m2',
  '/p/tnh-ev-hub-k7m2',
  '/p-tnh-org-onboard-x4n7',
  '/p/tnh-org-onboard-x4n7',
  '/p-tnh-bmu-onboard-k7m2',
  '/p/tnh-bmu-onboard-k7m2',
  '/p-tnh-wibn-onboard-w9m3',
  '/p/tnh-wibn-onboard-w9m3',
  '/p-tnh-embed-events-k1',
  '/p-tnh-embed-org-k2',
  '/p-tnh-embed-dash-k3',
  '/p-tnh-embed-events-wibn',
  '/p-tnh-embed-org-wibn',
  '/p-tnh-embed-opps-wibn',
  '/p-tnh-embed-dash-wibn',
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

  // Preview cookie only — admin hub_session must not skip the shared password gate.
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
    return sitePrivateResponse();
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

    const internalHeaders =
      isSiteAccessGateActive() && String(process.env.SITE_ACCESS_PASSWORD || '').trim()
        ? { 'x-hub-internal-seo': String(process.env.SITE_ACCESS_PASSWORD).trim() }
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
