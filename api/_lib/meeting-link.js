/**
 * Normalise online join / meeting links for storage and email CTAs.
 *
 * Resend click-tracking redirects to the href destination. Relative URLs
 * (missing https://), pasted Zoom invite blobs, zoommtg:// deep links, and
 * https:/host typos make iOS Safari report "The URL can't be shown" on
 * links.mail.* instead of opening Zoom.
 */

const HTTP_URL_RE = /https?:\/\/[^\s<>"'\\]+/i;
const BARE_HOST_URL_RE =
  /(?:www\.)?(?:[\w-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com|gotomeeting\.com|whereby\.com|around\.co|riverside\.fm)\/[^\s<>"'\\]+/i;
const ZOOM_CONF_RE = /(?:confno|meeting[_-]?id|mn)=(\d{9,13})/i;
const ZOOM_PWD_RE = /(?:pwd|passwd|password)=([^&\s<>"']+)/i;

function stripJunk(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function fixProtocolTypos(url) {
  let out = String(url || '').trim();
  // https:/host or http:/host (single slash)
  out = out.replace(/^(https?:)\/(?!\/)/i, '$1//');
  // protocol-relative //host → https://host
  if (/^\/\//.test(out)) out = 'https:' + out;
  return out;
}

function extractCandidate(raw) {
  const text = decodeBasicEntities(stripJunk(raw));
  if (!text) return '';

  const httpMatch = text.match(HTTP_URL_RE);
  if (httpMatch) return fixProtocolTypos(httpMatch[0].replace(/[),.;]+$/g, ''));

  const zoommtgMatch = text.match(/zoommtg:\/\/[^\s<>"']+/i);
  if (zoommtgMatch) return zoommtgMatch[0].replace(/[),.;]+$/g, '');

  const zoomusMatch = text.match(/zoomus:\/\/[^\s<>"']+/i);
  if (zoomusMatch) return zoomusMatch[0].replace(/[),.;]+$/g, '');

  const bareMatch = text.match(BARE_HOST_URL_RE);
  if (bareMatch) return bareMatch[0].replace(/[),.;]+$/g, '');

  // Single-token host path (no spaces) — organiser typed zoom.us/j/…
  if (!/\s/.test(text) && /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(text)) {
    return text.replace(/[),.;]+$/g, '');
  }

  return '';
}

function zoomDeepLinkToHttps(raw) {
  const text = String(raw || '').trim();
  if (!/^zoom(?:mtg|us):\/\//i.test(text)) return '';

  let conf = '';
  let pwd = '';
  const confMatch = text.match(ZOOM_CONF_RE);
  if (confMatch) conf = confMatch[1];
  const pwdMatch = text.match(ZOOM_PWD_RE);
  if (pwdMatch) pwd = pwdMatch[1];

  // zoommtg://zoom.us/join?action=join&confno=…
  // also path forms: zoommtg://zoom.us/j/123
  if (!conf) {
    const pathMatch = text.match(/\/j\/(\d{9,13})/i);
    if (pathMatch) conf = pathMatch[1];
  }
  if (!conf) return '';

  let url = 'https://zoom.us/j/' + conf;
  if (pwd) url += '?pwd=' + encodeURIComponent(decodeURIComponent(pwd));
  return url;
}

function ensureHttpUrl(candidate) {
  let url = fixProtocolTypos(String(candidate || '').trim());
  if (!url) return '';

  if (/^zoom(?:mtg|us):\/\//i.test(url)) {
    url = zoomDeepLinkToHttps(url);
    if (!url) return '';
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (!parsed.hostname || !parsed.hostname.includes('.')) return '';
    // Prefer https for join links (Zoom/Teams/etc.).
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * @param {unknown} raw
 * @returns {string} Absolute https URL, or '' if none could be recovered.
 */
function normalizeMeetingLink(raw) {
  const candidate = extractCandidate(raw);
  if (!candidate) return '';
  return ensureHttpUrl(candidate);
}

/** Attribute-safe href value (quotes only — URL is already validated). */
function meetingLinkHref(raw) {
  const url = normalizeMeetingLink(raw);
  if (!url) return '';
  return url.replace(/"/g, '%22');
}

module.exports = {
  normalizeMeetingLink,
  meetingLinkHref,
  extractCandidate,
  zoomDeepLinkToHttps,
};
