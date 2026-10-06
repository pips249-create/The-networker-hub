/**
 * Log each newly created event (including every date in a series) to the
 * entity activity log. Jamie's targets count her event_created rows.
 */
const { logFromSession } = require('./entity-activity-log');

function formatUkDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(d);
}

async function logCreatedEvents(session, events, options) {
  const list = (Array.isArray(events) ? events : []).filter((ev) => ev && ev.id);
  if (!session || !list.length) return;
  const opts = options || {};
  const source = String(opts.source || 'event_create');
  const series = list.length > 1 || list.some((ev) => ev && ev.seriesGroupId);
  await Promise.all(
    list.map((ev) => {
      const title = String(ev.title || '').trim().slice(0, 80);
      const when = formatUkDate(ev.date || ev.startsAt || ev.starts_at);
      const organiserId =
        opts.organiserId || ev.groupId || ev.organiserId || ev.organiserGroupId || null;
      const summary =
        (series ? 'Added series date' : 'Added event') +
        (title ? ': ' + title : '') +
        (when ? ' (' + when + ')' : '');
      return logFromSession(session, null, {
        entity_type: 'event',
        entity_id: ev.id,
        organiser_id: organiserId,
        action: 'event_created',
        summary,
        metadata: {
          source,
          seriesGroupId: ev.seriesGroupId || opts.seriesGroupId || null,
          date: ev.date || null,
          title: title || null,
          seriesSize: list.length,
        },
      }).catch(() => null);
    })
  );
}

module.exports = {
  logCreatedEvents,
};
