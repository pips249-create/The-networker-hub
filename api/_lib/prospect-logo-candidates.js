/**
 * Build ordered logo URL candidates for pitch deck prospects (client tries in order).
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

async function discoverOgImage(website) {
  const base = normalizeWebsite(website);
  if (!base) return '';
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
    if (!res.ok) return '';
    const html = String(await res.text()).slice(0, 120000);
    const patterns = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]+href=["']([^"']+)["']/i,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const m = html.match(patterns[i]);
      if (m && m[1]) {
        const abs = absolutizeUrl(m[1], base);
        if (abs) return abs;
      }
    }
  } catch {
    /* optional enrichment */
  }
  return '';
}

async function resolveProspectLogoCandidates(website, explicitUrl) {
  const candidates = buildProspectLogoCandidates(website, explicitUrl);
  const og = await discoverOgImage(website);
  if (og) {
    const rest = candidates.filter(function (u) {
      return u !== og;
    });
    return [og].concat(rest);
  }
  return candidates;
}

module.exports = {
  buildProspectLogoCandidates,
  resolveProspectLogoCandidates,
  hostFromWebsite,
};
