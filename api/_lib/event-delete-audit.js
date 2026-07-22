/**
 * Preserve organiser payout rows when empty events are hard-deleted.
 */
async function countPayoutRowsForEvent(sb, eventId) {
  const { count, error } = await sb
    .from('organiser_payouts')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function snapshotPayoutHistoryBeforeEventDelete(sb, eventId, eventTitle) {
  const title = String(eventTitle || '').trim() || 'Untitled';
  const count = await countPayoutRowsForEvent(sb, eventId);
  if (!count) return { snapshotted: 0 };

  const snapshot = {
    event_title_snapshot: title,
    event_archived_at: new Date().toISOString(),
  };

  const { error } = await sb.from('organiser_payouts').update(snapshot).eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return { snapshotted: count };
}

module.exports = {
  countPayoutRowsForEvent,
  snapshotPayoutHistoryBeforeEventDelete,
};
