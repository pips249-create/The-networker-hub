const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase, hubAccountUrl, legalPolicyUrl, contactUrl, eventPublicUrl, browseEventsUrl } = require('./hub-email-urls');

function matchesEventSearchCriteria(eventRow, criteria) {
  if (!eventRow || !criteria) return false;

  const q = String(criteria.q || '')
    .trim()
    .toLowerCase();
  if (q) {
    const hay = [eventRow.title, eventRow.description, eventRow.city, eventRow.venue_name, eventRow.event_type]
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }

  const location = String(criteria.location || criteria.loc || '').trim().toLowerCase();
  if (location) {
    const locHay = [eventRow.city, eventRow.venue_name, eventRow.postcode, eventRow.region]
      .join(' ')
      .toLowerCase();
    if (!locHay.includes(location)) return false;
  }

  const typesRaw = criteria.types || criteria.type || '';
  const types = Array.isArray(typesRaw)
    ? typesRaw
    : String(typesRaw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  if (types.length) {
    const eventType = String(eventRow.event_type || eventRow.type || '').trim().toLowerCase();
    const ok = types.some((t) => eventType === String(t).trim().toLowerCase());
    if (!ok) return false;
  }

  const format = String(criteria.format || '').trim().toLowerCase();
  if (format && format !== 'all') {
    const eventFormat = String(eventRow.event_format || eventRow.format || '').trim().toLowerCase();
    if (eventFormat && eventFormat !== format) return false;
  }

  return true;
}

function criteriaLabel(criteria) {
  const parts = [];
  if (criteria.q) parts.push(`"${criteria.q}"`);
  if (criteria.location || criteria.loc) parts.push(String(criteria.location || criteria.loc));
  if (criteria.types || criteria.type) {
    const types = Array.isArray(criteria.types)
      ? criteria.types
      : String(criteria.types || criteria.type || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    if (types.length) parts.push(types.join(', '));
  }
  if (criteria.format && criteria.format !== 'all') parts.push(String(criteria.format));
  return parts.length ? parts.join(' · ') : 'your saved search';
}

async function sendDueEventSavedSearchMatchEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const siteUrl = siteBase();

  const { data: events, error: eventErr } = await sb
    .from('events')
    .select(
      'id, title, slug, description, city, venue_name, postcode, region, event_type, event_format, published_at, status, approval_status, ticket_sales_enabled'
    )
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('published_at', since);
  if (eventErr) throw new Error(eventErr.message);
  if (!events || !events.length) return result;

  const { data: searches, error: searchErr } = await sb
    .from('event_saved_searches')
    .select('id, label, criteria, notify_email, attendees(id, email, name)')
    .eq('notify_email', true);
  if (searchErr) throw new Error(searchErr.message);
  result.checked = (searches || []).length;

  for (const search of searches || []) {
    const attendee = search.attendees;
    const email = String(attendee?.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    const matches = (events || []).filter((ev) => matchesEventSearchCriteria(ev, search.criteria || {}));
    if (!matches.length) continue;

    const { data: hits } = await sb
      .from('event_saved_search_hits')
      .select('event_id')
      .eq('search_id', search.id);
    const hitIds = new Set((hits || []).map((h) => String(h.event_id)));
    const fresh = matches.filter((ev) => !hitIds.has(String(ev.id)));
    if (!fresh.length) continue;

    const top = fresh[0];
    try {
      await sendTemplatedEmail({
        slug: 'event_saved_search_match',
        to: email,
        variables: {
          user_name: String(attendee?.name || '').trim() || 'there',
          user_email: email,
          search_label: String(search.label || '').trim() || criteriaLabel(search.criteria || {}),
          match_count: String(fresh.length),
          event_name: String(top.title || 'New event').trim(),
          event_url: eventPublicUrl(top, siteUrl),
          browse_events_url: browseEventsUrl(siteUrl),
          hub_account_url: hubAccountUrl(siteUrl),
          contact_url: contactUrl(siteUrl),
          privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
          terms_url: legalPolicyUrl(siteUrl, 'terms'),
          site_url: siteUrl,
        },
        skipEmailCheck: true,
      });

      await sb.from('event_saved_search_hits').insert(
        fresh.slice(0, 20).map((ev) => ({
          search_id: search.id,
          event_id: ev.id,
        }))
      );
      await sb
        .from('event_saved_searches')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('id', search.id);
      result.sent += 1;
    } catch (e) {
      result.errors.push({ searchId: search.id, error: e.message || String(e) });
    }
  }

  return result;
}

module.exports = {
  matchesEventSearchCriteria,
  sendDueEventSavedSearchMatchEmails,
};
