const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

/**
 * List registrations for the signed-in organiser's events (Supabase).
 *
 * @param {string[]} eventIds
 * @param {string|null} filterEventId — optional single event id, or "all"
 */
async function listAttendeesForOrganiserEvents(eventIds, filterEventId) {
  if (!isSupabaseConfigured() || !eventIds.length) return [];

  const allowed = new Set(eventIds);
  if (filterEventId && filterEventId !== 'all' && !allowed.has(filterEventId)) {
    return [];
  }

  const targetIds =
    filterEventId && filterEventId !== 'all' ? [filterEventId] : [...allowed];

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('registrations')
    .select(
      `
      id,
      created_at,
      event_id,
      payment_status,
      amount_paid,
      quantity,
      attendees ( name, email ),
      events ( title ),
      tickets ( name )
    `
    )
    .in('event_id', targetIds);

  if (error) throw error;

  return (data || [])
    .filter((row) => allowed.has(row.event_id))
    .map((row) => {
      const attendee = row.attendees || {};
      const event = row.events || {};
      const ticket = row.tickets || {};
      const email = String(attendee.email || '').trim();
      const name =
        String(attendee.name || '').trim() || (email ? email.split('@')[0] : 'Attendee');

      const paymentStatus = String(row.payment_status || 'Pending').trim();
      const amountPaid = row.amount_paid != null ? Number(row.amount_paid) : 0;

      return {
        id: row.id,
        eventId: row.event_id,
        eventTitle: String(event.title || 'Event').trim(),
        name,
        email,
        phone: '',
        ticketName: String(ticket.name || 'General admission').trim(),
        quantity: Math.max(1, Number(row.quantity) || 1),
        paymentStatus,
        amountPaid,
        amountDisplay: amountPaid > 0 ? '£' + amountPaid.toFixed(2) : 'Free',
        registeredAt: row.created_at || '',
      };
    })
    .sort((a, b) => {
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return tb - ta;
    });
}

module.exports = {
  listAttendeesForOrganiserEvents,
};
