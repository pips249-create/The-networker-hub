/**
 * Build ordered logo URL candidates for pitch deck prospects (client tries in order).
 * Prefers real brand marks (header/logo imgs) over og:image hero photos.
 */
const { normalizeWebsite, cleanText } = require('./custom-pitch-deck-generate');

function hostFromWebsite(website) {
  try {
    const w = normalizeWebsite(website);
    if (!w) return '';
    return new URL(w).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function absolutizeUrl(raw, baseWebsite) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.slice(0, 2000);
  try {
    const base = normalizeWebsite(baseWebsite);
    if (!base) return '';
    return new URL(s, base).toString().slice(0, 2000);
  } catch {
    return '';
  }
}

function looksLikePhotoUrl(url) {
  const u = String(url || '').toLowerCase();
  // Common CMS crop suffixes like 131-0-0-1115-10000-8885-1920.jpg are hero frames.
  if (/-\d+-\d+-\d+-\d+-\d+-\d+\.(jpe?g|webp)(?:\?|$)/i.test(u)) return true;
  if (/\.(jpe?g)(?:\?|$)/i.test(u) && /(hero|banner|bg|background|photo|stock|unsplash|pexels)/i.test(u)) {
    return true;
  }
  return false;
}

function buildProspectLogoCandidates(website, explicitUrl) {
  const out = [];
  const add = function (url) {
    const u = String(url || '').trim();
    if (!u || out.indexOf(u) !== -1) return;
    out.push(u);
  };

  add(cleanText(explicitUrl, 2000));
  const host = hostFromWebsite(website);
  if (host) {
    add('https://logo.clearbit.com/' + host);
    add('https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=256');
    add('https://icons.duckduckgo.com/ip3/' + host + '.ico');
    add('https://' + host + '/apple-touch-icon.png');
    add('https://' + host + '/favicon.ico');
  }
  return out;
}

/**
 * Pull brand marks from the prospect homepage HTML.
 * Returns { logos: string[], ogImage: string }.
 */
async function discoverSiteBrandAssets(website) {
  const base = normalizeWebsite(website);
  const empty = { logos: [], ogImage: '' };
  if (!base) return empty;
  try {
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, 4500);
    const res = await fetch(base, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'TheNetworkerUK-PitchDeck/1.0 (+https://www.thenetworkeruk.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const html = String(await res.text()).slice(0, 180000);
    const logos = [];
    const addLogo = function (raw) {
      const abs = absolutizeUrl(raw, base);
      if (!abs || logos.indexOf(abs) !== -1) return;
      if (looksLikePhotoUrl(abs)) return;
      logos.push(abs);
    };

    // 1) Explicit logo images (alt / class / id / src).
    const imgRe = /<img\b[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgRe.exec(html))) {
      const tag = imgMatch[0];
      const lower = tag.toLowerCase();
      const isLogo =
        /\balt=["'][^"']*logo[^"']*["']/i.test(tag) ||
        /\b(?:class|id)=["'][^"']*logo[^"']*["']/i.test(tag) ||
        /\/logo[^"'>\s]*\.(?:png|svg|webp)/i.test(tag) ||
        (/logoarea|site-logo|brand-logo|navbar-brand/i.test(lower) &&
          /\.(?:png|svg|webp)/i.test(tag));
      if (!isLogo) continue;
      const src =
        (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] ||
        (tag.match(/\bsrcset=["']([^"'\s,]+)/i) || [])[1] ||
        '';
      if (src) addLogo(src);
    }

    // 2) Link rel icon / apple-touch-icon as softer fallbacks (after true logos).
    const iconRe =
      /<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/gi;
    let iconMatch;
    while ((iconMatch = iconRe.exec(html))) {
      addLogo(iconMatch[1]);
    }

    // 3) og:image — useful only when no logo mark was found / as last resort.
    let ogImage = '';
    const ogPatterns = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ];
    for (let i = 0; i < ogPatterns.length; i++) {
      const m = html.match(ogPatterns[i]);
      if (m && m[1]) {
        ogImage = absolutizeUrl(m[1], base);
        break;
      }
    }

    return { logos: logos, ogImage: ogImage };
  } catch {
    return empty;
  }
}

/** @deprecated use discoverSiteBrandAssets — kept for callers/tests */
async function discoverOgImage(website) {
  const assets = await discoverSiteBrandAssets(website);
  return assets.logos[0] || assets.ogImage || '';
}

async function resolveProspectLogoCandidates(website, explicitUrl) {
  const candidates = buildProspectLogoCandidates(website, explicitUrl);
  const assets = await discoverSiteBrandAssets(website);
  const preferred = [];
  const add = function (url) {
    const u = String(url || '').trim();
    if (!u || preferred.indexOf(u) !== -1) return;
    preferred.push(u);
  };

  // Explicit admin override always wins.
  add(cleanText(explicitUrl, 2000));
  // Real site logos before Clearbit / favicons / og photos.
  assets.logos.forEach(add);

  candidates.forEach(function (u) {
    if (looksLikePhotoUrl(u)) return;
    add(u);
  });

  // og:image last, and only if it does not look like a stock/hero photo —
  // otherwise the Powered-by slot shows cocktails / lifestyle shots.
  if (assets.ogImage && !looksLikePhotoUrl(assets.ogImage)) {
    add(assets.ogImage);
  }

  return preferred.length ? preferred : candidates;
}

module.exports = {
  buildProspectLogoCandidates,
  resolveProspectLogoCandidates,
  discoverSiteBrandAssets,
  discoverOgImage,
  looksLikePhotoUrl,
  hostFromWebsite,
};
