async function fetchEventRegistrationStats(sb, eventIds) {
  const stats = {};
  const ids = [...new Set((eventIds || []).filter(Boolean))];
  ids.forEach((id) => {
    stats[id] = { registration_count: 0, paid_booking_count: 0 };
  });
  if (!ids.length) return stats;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await sb
      .from('registrations')
      .select('event_id, payment_status')
      .in('event_id', chunk);
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      const eventId = row.event_id;
      if (!stats[eventId]) stats[eventId] = { registration_count: 0, paid_booking_count: 0 };
      stats[eventId].registration_count += 1;
      if (String(row.payment_status || '').trim() === 'Paid') {
        stats[eventId].paid_booking_count += 1;
      }
    });
  }

  return stats;
}

async function fetchLatestCancellationsByEventId(sb, eventIds) {
  const byEvent = {};
  const ids = [...new Set((eventIds || []).filter(Boolean))];
  if (!ids.length) return byEvent;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await sb
      .from('event_cancellations')
      .select(
        'id, event_id, created_at, refunds_confirmed_at, reinstated_at, removed_by_admin, reason'
      )
      .in('event_id', chunk)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    (data || []).forEach((row) => {
      if (!row?.event_id || byEvent[row.event_id]) return;
      byEvent[row.event_id] = row;
    });
  }

  return byEvent;
}

module.exports = {
  fetchEventRegistrationStats,
  fetchLatestCancellationsByEventId,
};
