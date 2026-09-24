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

/** Pilot: activate Connected booking without Stripe for these organiser login emails. */
function connectedBookingPilotGrantEmails() {
  const raw = String(process.env.CONNECTED_BOOKING_PILOT_GRANT_EMAILS || '').trim();
  if (!raw) return null;
  const list = raw
    .split(/[,;\s]+/)
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

function connectedBookingPilotGrantPlan() {
  const plan = String(process.env.CONNECTED_BOOKING_PILOT_GRANT_PLAN || 'starter').trim().toLowerCase();
  return plan in PLAN_GROUP_LIMITS ? plan : 'starter';
}

function connectedBookingPilotGrantEligible(email) {
  const em = normalizeConnectedBookingEmail(email);
  if (!em) return false;
  const list = connectedBookingPilotGrantEmails();
  return Boolean(list && list.includes(em));
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

/** Public listing + attendee checkout (includes rows saved with URL/price but checkout_mode stuck on hub). */
function publicListingUsesExternalBooking(row) {
  if (!row) return false;
  if (isExternalConnectedEvent(row)) return true;
  return Boolean(
    String(row.external_booking_url || '').trim() &&
      String(row.external_price_label || '').trim()
  );
}

function normalizeExternalPriceLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.length > 80) return text.slice(0, 80).trim();
  return text;
}

/** Numeric Eventbrite event id from public /e/… or checkout-external?eid= URLs. */
function parseEventbriteEventIdFromUrl(raw) {
  const url = String(raw || '').trim();
  if (!url || !/eventbrite/i.test(url)) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  const eidParam = String(parsed.searchParams.get('eid') || '').trim();
  if (/^\d+$/.test(eidParam)) return eidParam;
  const numericPath = parsed.pathname.match(/\/e\/(\d{6,})(?:\/|$)/i);
  if (numericPath) return numericPath[1];
  const pathId = parsed.pathname.match(/-(\d{8,})(?:\/|$)/);
  if (pathId) return pathId[1];
  return '';
}

/** Send attendees to ticket checkout, not the Eventbrite marketing listing. */
function preferEventbriteCheckoutUrl(raw) {
  const url = String(raw || '').trim();
  if (!url || !/eventbrite/i.test(url)) return url;
  if (/checkout-external|orderstart/i.test(url)) return url;
  const eid = parseEventbriteEventIdFromUrl(url);
  if (!eid) return url;
  try {
    const parsed = new URL(url);
    const host = /\.co\.uk/i.test(parsed.hostname) ? 'www.eventbrite.co.uk' : 'www.eventbrite.com';
    return `https://${host}/checkout-external?eid=${eid}`;
  } catch {
    return url;
  }
}

function isTicketTailorWebhookEventId(raw) {
  return /^ev_/i.test(String(raw || '').trim());
}

function validateProviderExternalEventId(provider, externalEventId) {
  const p = String(provider || '').trim().toLowerCase();
  const id = String(externalEventId || '').trim();
  if (!id || p === 'own_site' || p === 'custom') return { ok: true };
  if (p === 'ticket_tailor' && !isTicketTailorWebhookEventId(id)) {
    return {
      ok: false,
      error: 'invalid_ticket_tailor_event_id',
      message:
        'Ticket Tailor sync needs the ev_… event id from Box office (webhooks do not use the checkout URL slug).',
    };
  }
  return { ok: true };
}

function guessProviderExternalEventId(provider, raw) {
  const platform = String(provider || '').trim().toLowerCase();
  const url = String(raw || '').trim();
  if (!platform || !url) return '';
  if (platform === 'eventbrite') return parseEventbriteEventIdFromUrl(url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (platform === 'luma' && /lu\.ma|luma\.com/i.test(parsed.hostname)) {
    const slug = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    if (slug && !/^event$/i.test(slug)) return slug;
  }
  if (platform === 'ticket_tailor' && /tickettailor|ticket-tailor/i.test(url)) {
    const m = parsed.pathname.match(/\/events\/([^/?#]+)/i);
    if (m) return m[1];
  }
  if (platform === 'trybooking' && /trybooking/i.test(url)) {
    const m = parsed.pathname.match(/\/(\d{5,})(?:\/|$)/);
    if (m) return m[1];
  }
  return '';
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
  const normalized = parsed.toString();
  return preferEventbriteCheckoutUrl(normalized);
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

function isConnectedPlanActive(account) {
  if (!account) return false;
  return String(account.connected_booking_status || '').trim() === 'active';
}

module.exports = {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  connectedBookingPreviewEmails,
  connectedBookingPilotGrantEmails,
  connectedBookingPilotGrantPlan,
  connectedBookingPilotGrantEligible,
  connectedBookingPreviewLocked,
  connectedBookingAllowedForEmail,
  connectedBookingAllowedForSession,
  connectedBookingOperationsEnabled,
  normalizeConnectedBookingEmail,
  isExternalConnectedEvent,
  publicListingUsesExternalBooking,
  normalizeExternalPriceLabel,
  normalizeExternalBookingUrl,
  parseEventbriteEventIdFromUrl,
  preferEventbriteCheckoutUrl,
  guessProviderExternalEventId,
  isTicketTailorWebhookEventId,
  validateProviderExternalEventId,
  parseExternalPriceLabelToDisplay,
  newWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  groupLimitForPlan,
  isConnectedPlanActive,
};
