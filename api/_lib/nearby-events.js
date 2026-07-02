const { isEventPublishedForSale } = require('./ticket-sales');

function locationTokens(location) {
  const raw = String(location || '').trim().toLowerCase();
  if (!raw) return [];
  return raw
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function eventMatchesLocation(eventRow, tokens) {
  if (!tokens.length) return false;
  const haystack = [
    eventRow.city,
    eventRow.venue,
    eventRow.location_label,
    eventRow.postcode,
    eventRow.outcode,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return tokens.some((token) => haystack.includes(token));
}

function nearbyLocationLabel(location) {
  const raw = String(location || '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim();
}

/**
 * Upcoming published events whose city/venue/postcode matches the member location string.
 */
async function fetchNearbyEvents(sb, location, options = {}) {
  const tokens = locationTokens(location);
  if (!tokens.length) return { events: [], locationLabel: '' };

  const excludeIds = new Set((options.excludeEventIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  const limit = Math.max(1, Math.min(Number(options.limit) || 4, 6));
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, city, venue, location_label, postcode, outcode, status, approval_status, published_at, featured, ticket_sales_enabled, refund_terms_agreed_at, refund_terms_agreed, organisers(name)'
    )
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(60);
  if (error) throw new Error(error.message);

  const events = (data || [])
    .filter(isEventPublishedForSale)
    .filter((row) => eventMatchesLocation(row, tokens))
    .filter((row) => !excludeIds.has(String(row.id)))
    .slice(0, limit);

  return {
    events,
    locationLabel: nearbyLocationLabel(location),
  };
}

module.exports = {
  locationTokens,
  eventMatchesLocation,
  nearbyLocationLabel,
  fetchNearbyEvents,
};
