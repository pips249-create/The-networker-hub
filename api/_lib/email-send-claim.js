/**
 * Claim-before-send helpers so overlapping cron workers cannot double-email.
 * Claim the sent_at (or equivalent) column first; release it if Resend fails.
 */

async function claimRowTimestamp(sb, { table, id, column, claimedAt, previousValue, idColumn }) {
  const rowId = String(id || '').trim();
  const col = String(column || '').trim();
  const key = String(idColumn || 'id').trim() || 'id';
  if (!rowId || !col || !table || !claimedAt) return false;

  let query = sb
    .from(table)
    .update({ [col]: claimedAt })
    .eq(key, rowId);

  if (previousValue == null || previousValue === '') {
    query = query.is(col, null);
  } else {
    query = query.eq(col, previousValue);
  }

  const { data, error } = await query.select(key);
  if (error) throw new Error(error.message);
  return Boolean(data && data.length);
}

async function releaseRowTimestamp(sb, { table, id, column, claimedAt, idColumn }) {
  const rowId = String(id || '').trim();
  const col = String(column || '').trim();
  const key = String(idColumn || 'id').trim() || 'id';
  if (!rowId || !col || !table || !claimedAt) return;
  await sb
    .from(table)
    .update({ [col]: null })
    .eq(key, rowId)
    .eq(col, claimedAt);
}

/**
 * Claim a queue row by setting sent_at while it is still unsent/unfailed.
 * Returns the claimed row fields, or null if another worker won the race.
 */
async function claimQueueRow(sb, { table, id, claimedAt, select }) {
  const rowId = String(id || '').trim();
  if (!rowId || !table || !claimedAt) return null;
  const { data, error } = await sb
    .from(table)
    .update({ sent_at: claimedAt })
    .eq('id', rowId)
    .is('sent_at', null)
    .is('failed_at', null)
    .select(select || '*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

module.exports = {
  claimRowTimestamp,
  releaseRowTimestamp,
  claimQueueRow,
};
