/**
 * Rewrite logo URLs for homepage / marquee strips (≈156×60 CSS).
 * Many organisers upload full-bleed marketing art; without resizing a few
 * tiles alone can be multi‑megabyte and leave blank cards while they load.
 */

const STRIP_WIDTH = 320;

function setSearchParams(url, entries) {
  Object.keys(entries).forEach((key) => {
    const value = entries[key];
    if (value == null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
}

/** Supabase public object → on-the-fly render (Pro / image transform). */
function rewriteSupabase(url) {
  const path = url.pathname;
  if (!path.includes('/storage/v1/object/public/')) return null;
  url.pathname = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  setSearchParams(url, {
    width: STRIP_WIDTH,
    resize: 'contain',
    quality: 75,
  });
  return url.toString();
}

/** Sanity CDN — honour width/quality (and drop oversized defaults). */
function rewriteSanity(url) {
  if (!/\.sanity\.io$/i.test(url.hostname) && !/^cdn\.sanity\.io$/i.test(url.hostname)) {
    return null;
  }
  setSearchParams(url, {
    w: STRIP_WIDTH,
    h: '',
    q: 70,
    auto: 'format',
    fit: 'max',
  });
  return url.toString();
}

/**
 * Framer `/assets/…` serves originals (often 10MB+ PNGs).
 * `/images/…?scale-down-to=` is the resized delivery path.
 */
function rewriteFramer(url) {
  if (!/(^|\.)framerusercontent\.com$/i.test(url.hostname)) return null;
  if (/\/assets\//i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/assets\//i, '/images/');
  }
  if (!/\/images\//i.test(url.pathname)) return null;
  setSearchParams(url, { 'scale-down-to': 512 });
  return url.toString();
}

/** Wix static media — replace fill dimensions with a strip-sized crop. */
function rewriteWix(url) {
  if (!/(^|\.)wixstatic\.com$/i.test(url.hostname)) return null;
  const path = url.pathname;
  if (!/\/media\//i.test(path)) return null;
  if (/\/v1\/fill\//i.test(path)) {
    url.pathname = path.replace(
      /\/v1\/fill\/[^/]+/i,
      `/v1/fill/w_${STRIP_WIDTH},h_160,al_c,q_80,enc_auto`
    );
    return url.toString();
  }
  // Bare media file — append a fill transform segment before the filename.
  const m = path.match(/^(.*\/media\/)([^/]+)$/i);
  if (m) {
    url.pathname =
      m[1] +
      m[2] +
      `/v1/fill/w_${STRIP_WIDTH},h_160,al_c,q_80,enc_auto/` +
      m[2];
    return url.toString();
  }
  return null;
}

/**
 * WordPress uploads via Jetpack Photon (i0.wp.com) — only for photo-like
 * uploads under /wp-content/uploads/ (jpg/jpeg/webp). PNG logos often fail
 * or gain nothing through Photon; leave them on the origin host.
 */
function rewriteWordPressUploads(url) {
  if (!/\/wp-content\/uploads\//i.test(url.pathname)) return null;
  if (!/\.(jpe?g|webp)(\?|$)/i.test(url.pathname)) return null;
  if (/(^|\.)wp\.com$/i.test(url.hostname)) return null;

  const host = url.hostname.replace(/^www\./i, '');
  const photon = new URL('https://i0.wp.com/' + host + url.pathname);
  setSearchParams(photon, { w: STRIP_WIDTH, quality: 70 });
  return photon.toString();
}

/**
 * @param {string} raw
 * @returns {string} same-origin or absolute URL safe for <img src>
 */
function logoStripUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';

  // Site-relative assets are already sized for the Hub — leave alone.
  if (input.startsWith('/') && !input.startsWith('//')) return input;

  let url;
  try {
    url = new URL(input.startsWith('//') ? 'https:' + input : input);
  } catch {
    return input;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return input;

  const rewritten =
    rewriteSupabase(new URL(url.toString())) ||
    rewriteSanity(new URL(url.toString())) ||
    rewriteFramer(new URL(url.toString())) ||
    rewriteWix(new URL(url.toString())) ||
    rewriteWordPressUploads(new URL(url.toString()));

  return rewritten || url.toString();
}

module.exports = {
  STRIP_WIDTH,
  logoStripUrl,
};
