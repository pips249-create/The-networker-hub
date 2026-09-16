const crypto = require('crypto');

const PLAN_GROUP_LIMITS = {
  starter: 1,
  growth: 5,
  scale: 20,
  enterprise: null,
};

const CHECKOUT_EXTERNAL = 'external_connected';
const CHECKOUT_HUB = 'hub';

function connectedBookingFeatureEnabled() {
  const v = String(process.env.CONNECTED_BOOKING_ENABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** When set, only these signed-in emails see/use Connected booking (everyone else: feature hidden). */
function connectedBookingPreviewEmails() {
  const raw = String(process.env.CONNECTED_BOOKING_PREVIEW_EMAILS || '').trim();
  if (!raw) return null;
  const list = raw
    .split(/[,;\s]+/)
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

function connectedBookingPreviewLocked() {
  return Boolean(connectedBookingPreviewEmails()?.length);
}

function normalizeConnectedBookingEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** Session/UI/API access for a signed-in organiser email. */
function connectedBookingAllowedForEmail(email) {
  const em = normalizeConnectedBookingEmail(email);
  if (!em) return false;
  const preview = connectedBookingPreviewEmails();
  if (preview) return preview.includes(em);
  return connectedBookingFeatureEnabled();
}

function connectedBookingAllowedForSession(session) {
  return connectedBookingAllowedForEmail(session?.email);
}

/** Webhooks & server paths without a session (e.g. integration POST). */
function connectedBookingOperationsEnabled() {
  if (connectedBookingPreviewLocked()) return true;
  return connectedBookingFeatureEnabled();
}

function isExternalConnectedEvent(row) {
  return String(row?.checkout_mode || CHECKOUT_HUB).trim() === CHECKOUT_EXTERNAL;
}

function normalizeExternalPriceLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.length > 80) return text.slice(0, 80).trim();
  return text;
}

function normalizeExternalBookingUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
  return parsed.toString();
}

function parseExternalPriceLabelToDisplay(label) {
  const text = normalizeExternalPriceLabel(label);
  if (!text) return { display: '', priceKey: 'paid', priceNum: 0 };
  if (/^free$/i.test(text)) return { display: 'Free', priceKey: 'free', priceNum: 0 };
  const fromMatch = text.match(/^from\s+£?\s*([\d,.]+)/i);
  if (fromMatch) {
    const n = Number(String(fromMatch[1]).replace(/,/g, ''));
    const num = Number.isFinite(n) ? n : 0;
    return {
      display: text.startsWith('From') || text.startsWith('from') ? text : `From £${num.toFixed(2)}`,
      priceKey: num > 0 ? 'paid' : 'free',
      priceNum: num,
    };
  }
  const poundMatch = text.match(/£?\s*([\d,.]+)/);
  if (poundMatch) {
    const n = Number(String(poundMatch[1]).replace(/,/g, ''));
    const num = Number.isFinite(n) ? n : 0;
    if (num <= 0) return { display: 'Free', priceKey: 'free', priceNum: 0 };
    return { display: text.includes('£') ? text : `£${num.toFixed(2)}`, priceKey: 'paid', priceNum: num };
  }
  return { display: text, priceKey: 'paid', priceNum: 0 };
}

function newWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function signWebhookPayload(secret, rawBody) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verifyWebhookSignature(secret, rawBody, signatureHeader) {
  const sig = String(signatureHeader || '').trim();
  if (!secret || !sig) return false;
  const expected = signWebhookPayload(secret, rawBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sig.replace(/^sha256=/i, ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function groupLimitForPlan(plan) {
  const key = String(plan || '').trim().toLowerCase();
  if (!key || !(key in PLAN_GROUP_LIMITS)) return 0;
  return PLAN_GROUP_LIMITS[key];
}

module.exports = {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  connectedBookingPreviewEmails,
  connectedBookingPreviewLocked,
  connectedBookingAllowedForEmail,
  connectedBookingAllowedForSession,
  connectedBookingOperationsEnabled,
  normalizeConnectedBookingEmail,
  isExternalConnectedEvent,
  normalizeExternalPriceLabel,
  normalizeExternalBookingUrl,
  parseExternalPriceLabelToDisplay,
  newWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  groupLimitForPlan,
};
