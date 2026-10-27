/**
 * Prepare JPEG logo assets for the printable attendee ticket PDF.
 * Organiser logo is fetched safely from photo_url; Hub logo is local.
 */
const fs = require('fs');
const path = require('path');
const { assertUrlSafeForServerFetch, imageFetchHeadersForUrl } = require('./safe-url-fetch');

const HUB_LOGO_CANDIDATES = [
  path.join(__dirname, '../../assets/logo-nav-on-light.png'),
  path.join(__dirname, '../../assets/logo-networker-uk.png'),
  path.join(__dirname, '../../assets/logo.png'),
];

const MAX_REMOTE_BYTES = 2.5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4000;

let sharpModule = null;
let sharpLoadAttempted = false;
let hubLogoCache = null;

function getSharp() {
  if (sharpLoadAttempted) return sharpModule;
  sharpLoadAttempted = true;
  try {
    sharpModule = require('sharp');
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

function resolveHubLogoPath() {
  for (let i = 0; i < HUB_LOGO_CANDIDATES.length; i += 1) {
    if (fs.existsSync(HUB_LOGO_CANDIDATES[i])) return HUB_LOGO_CANDIDATES[i];
  }
  return '';
}

async function bufferToJpegLogo(input, options) {
  const sharp = getSharp();
  if (!sharp) return null;
  const opts = options || {};
  const maxW = opts.maxWidth || 480;
  const maxH = opts.maxHeight || 220;
  const background = opts.background || '#ffffff';
  const jpeg = await sharp(input)
    .rotate()
    .resize({
      width: maxW,
      height: maxH,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(jpeg).metadata();
  return {
    jpeg,
    width: meta.width || maxW,
    height: meta.height || maxH,
  };
}

async function loadHubLogoJpeg() {
  if (hubLogoCache) return hubLogoCache;
  const filePath = resolveHubLogoPath();
  if (!filePath) return null;
  try {
    const buf = fs.readFileSync(filePath);
    const prepared = await bufferToJpegLogo(buf, {
      maxWidth: 420,
      maxHeight: 120,
      background: '#f3eef5',
    });
    if (prepared) hubLogoCache = prepared;
    return prepared;
  } catch {
    return null;
  }
}

function absoluteLogoUrl(rawUrl, siteUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return 'https:' + value;
  const base = String(siteUrl || 'https://www.thenetworkeruk.com').replace(/\/$/, '');
  if (value.startsWith('/')) return base + value;
  return base + '/' + value;
}

async function loadRemoteLogoJpeg(rawUrl, siteUrl, options) {
  const url = absoluteLogoUrl(rawUrl, siteUrl);
  if (!url) return null;
  const opts = options || {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let upstream;
    try {
      ({ response: upstream } = await assertUrlSafeForServerFetch(url, {
        maxRedirects: 3,
        headers: imageFetchHeadersForUrl(url),
        signal: controller.signal,
      }));
    } finally {
      clearTimeout(timer);
    }
    if (!upstream || !upstream.ok) return null;
    const contentType = String(upstream.headers.get('content-type') || '').split(';')[0];
    if (contentType && !/^image\//i.test(contentType) && contentType !== 'application/octet-stream') {
      return null;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!buf.length || buf.length > MAX_REMOTE_BYTES) return null;
    return bufferToJpegLogo(buf, {
      maxWidth: opts.maxWidth || 480,
      maxHeight: opts.maxHeight || 220,
      background: opts.background || '#ffffff',
    });
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{organiserLogo: object|null, hubLogo: object|null}>}
 */
async function loadTicketPdfLogos(context) {
  const siteUrl = context && context.siteUrl;
  const [organiserLogo, hubLogo] = await Promise.all([
    loadRemoteLogoJpeg(context && context.organiserLogoUrl, siteUrl, {
      maxWidth: 520,
      maxHeight: 220,
      background: '#ffffff',
    }),
    loadHubLogoJpeg(),
  ]);
  return { organiserLogo: organiserLogo || null, hubLogo: hubLogo || null };
}

module.exports = {
  loadTicketPdfLogos,
  loadHubLogoJpeg,
  loadRemoteLogoJpeg,
  absoluteLogoUrl,
};
