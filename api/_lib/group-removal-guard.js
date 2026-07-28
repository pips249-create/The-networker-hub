/**
 * Block removing a networking group while it still has live events with bookings.
 * Those events cannot be deleted — organisers must unpublish (or cancel) them first.
 */
const { getSupabaseAdmin } = require('./supabase');
const { isActiveRegistration } = require('./event-sale-lock');

async function findPublishedEventsWithRegistrations(organiserIds) {
  const ids = [
    ...new Set((organiserIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  if (!ids.length) return [];

  const sb = getSupabaseAdmin();
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, title, status, locked, organiser_id')
    .in('organiser_id', ids)
    .eq('status', 'published');
  if (evErr) throw new Error(evErr.message);

  const rows = events || [];
  if (!rows.length) return [];

  const lockedIds = new Set(rows.filter((e) => e.locked).map((e) => e.id));
  const needRegCheck = rows.filter((e) => !lockedIds.has(e.id)).map((e) => e.id);
  const blockingIds = new Set(lockedIds);

  if (needRegCheck.length) {
    const { data: regs, error: regErr } = await sb
      .from('registrations')
      .select('event_id, cancelled_at, payment_status, application_status')
      .in('event_id', needRegCheck);
    if (regErr) throw new Error(regErr.message);
    (regs || []).forEach((row) => {
      if (isActiveRegistration(row)) blockingIds.add(row.event_id);
    });
  }

  return rows.filter((e) => blockingIds.has(e.id));
}

function groupRemovalBlockedMessage(blocked, action) {
  const count = blocked.length;
  const verb = action === 'delete' ? 'delete' : 'unpublish';
  const title = String(blocked[0]?.title || '').trim();
  if (count === 1 && title) {
    return (
      `“${title}” still has registrations. Unpublish that event first, then ${verb} this group.`
    );
  }
  if (count === 1) {
    return `This group has a live event with registrations. Unpublish that event first, then ${verb} this group.`;
  }
  return (
    `This group has ${count} live events with registrations. Unpublish those events first, then ${verb} this group.`
  );
}

/**
 * @param {string|string[]} organiserIds
 * @param {{ action?: 'unpublish'|'delete' }} [opts]
 */
async function assertGroupCanBeRemoved(organiserIds, opts = {}) {
  const action = opts.action === 'delete' ? 'delete' : 'unpublish';
  const ids = Array.isArray(organiserIds) ? organiserIds : [organiserIds];
  const blocked = await findPublishedEventsWithRegistrations(ids);
  if (!blocked.length) return;

  const e = new Error(groupRemovalBlockedMessage(blocked, action));
  e.status = 409;
  e.code = 'group_has_published_events_with_registrations';
  e.eventIds = blocked.map((ev) => ev.id);
  e.eventCount = blocked.length;
  throw e;
}

module.exports = {
  findPublishedEventsWithRegistrations,
  assertGroupCanBeRemoved,
  groupRemovalBlockedMessage,
};
