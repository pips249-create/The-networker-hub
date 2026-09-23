const { normalizeEventbriteWebhook } = require('./adapters/eventbrite');
const { normalizeTicketTailorWebhook } = require('./adapters/ticket-tailor');
const { normalizeLumaWebhook } = require('./adapters/luma');
const { normalizeTryBookingWebhook } = require('./adapters/trybooking');
const { normalizeOwnSiteWebhook } = require('./adapters/own-site');
const { isConnectedBookingProviderId } = require('./registry');

const NORMALIZERS = {
  eventbrite: normalizeEventbriteWebhook,
  ticket_tailor: normalizeTicketTailorWebhook,
  luma: normalizeLumaWebhook,
  trybooking: normalizeTryBookingWebhook,
  own_site: normalizeOwnSiteWebhook,
};

function normalizeProviderWebhook(providerId, body) {
  const key = String(providerId || '').trim().toLowerCase();
  const fn = NORMALIZERS[key];
  if (!fn) return null;
  return fn(body);
}

module.exports = {
  ...require('./registry'),
  normalizeProviderWebhook,
  isConnectedBookingProviderId,
};
