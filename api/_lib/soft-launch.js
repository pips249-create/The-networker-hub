/**
 * Soft-launch dates for public catalogue vs paid/enquiry actions.
 * Browse: 25 Aug 2026 · Tickets & opportunity enquiries: 1 Sep 2026 (Europe/London).
 *
 * Override for staging/admin tests:
 *   PUBLIC_TICKET_SALES_FORCE_OPEN=true
 *   PUBLIC_TICKET_SALES_FORCE_CLOSED=true
 *   PUBLIC_ENQUIRIES_FORCE_OPEN=true
 *   PUBLIC_ENQUIRIES_FORCE_CLOSED=true
 */

const PUBLIC_BROWSE_OPENS_AT = '2026-08-25T00:00:00+01:00';
const PUBLIC_TRANSACTIONS_OPENS_AT = '2026-09-01T00:00:00+01:00';

function parseEnvFlag(name) {
  const raw = String(process.env[name] || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function publicBrowseOpensAtMs() {
  return Date.parse(PUBLIC_BROWSE_OPENS_AT);
}

function publicTransactionsOpensAtMs() {
  return Date.parse(PUBLIC_TRANSACTIONS_OPENS_AT);
}

function isPublicBrowseOpen(nowMs) {
  const now = nowMs == null ? Date.now() : Number(nowMs);
  return now >= publicBrowseOpensAtMs();
}

/**
 * Public ticket buying (paid + free). Opens 1 September 2026 unless forced.
 * Browse and organiser nudges stay available before then.
 */
function arePublicTicketSalesOpen(nowMs) {
  if (parseEnvFlag('PUBLIC_TICKET_SALES_FORCE_CLOSED')) return false;
  if (parseEnvFlag('PUBLIC_TICKET_SALES_FORCE_OPEN')) return true;
  const now = nowMs == null ? Date.now() : Number(nowMs);
  return now >= publicTransactionsOpensAtMs();
}

function publicTicketSalesClosedMessage() {
  return 'Ticket buying opens on 1 September 2026. You can browse events now and nudge organisers to list tickets.';
}

/**
 * Opportunity enquiries. Opens 1 September 2026 unless forced open/closed via env.
 */
function arePublicEnquiriesOpen(nowMs) {
  if (parseEnvFlag('PUBLIC_ENQUIRIES_FORCE_CLOSED')) return false;
  if (parseEnvFlag('PUBLIC_ENQUIRIES_FORCE_OPEN')) return true;
  const now = nowMs == null ? Date.now() : Number(nowMs);
  return now >= publicTransactionsOpensAtMs();
}

function publicEnquiriesClosedMessage() {
  return 'Opportunity enquiries open on 1 September 2026. You can browse listings now and enquire when they go live.';
}

function softLaunchPublicMeta(nowMs) {
  const now = nowMs == null ? Date.now() : Number(nowMs);
  return {
    browseOpen: isPublicBrowseOpen(now),
    browseOpensAt: PUBLIC_BROWSE_OPENS_AT,
    ticketSalesOpen: arePublicTicketSalesOpen(now),
    ticketSalesOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
    enquiriesOpen: arePublicEnquiriesOpen(now),
    enquiriesOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
    transactionsOpensAt: PUBLIC_TRANSACTIONS_OPENS_AT,
  };
}

module.exports = {
  PUBLIC_BROWSE_OPENS_AT,
  PUBLIC_TRANSACTIONS_OPENS_AT,
  publicBrowseOpensAtMs,
  publicTransactionsOpensAtMs,
  isPublicBrowseOpen,
  arePublicTicketSalesOpen,
  publicTicketSalesClosedMessage,
  arePublicEnquiriesOpen,
  publicEnquiriesClosedMessage,
  softLaunchPublicMeta,
};
