const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { ensureAttendeeId, resolveAttendeeId } = require('./supabase-favourites');
const { sendApplicationEmails } = require('./registration-emails');
const { resolveTicketSalesEnabled, isTicketOnSale } = require('./ticket-sales');
const { assertApplicationSeatAvailable, countApprovedApplicationSeats } = require('./application-capacity');
const { assertEventHasCapacity, rethrowIfCapacityExceeded } = require('./event-capacity');
const { isUuid } = require('./uuid');
const { assertNotBlockedByOrganiser } = require('./organiser-attendee-blocks');

function ticketIsApplication(row) {
  const ticketType = String(row.ticket_type || '').trim();
  const name = String(row.name || '').toLowerCase();
  return ticketType.includes('application') || /application to attend/.test(name);
}

async function countTicketApplications(sb, ticketId) {
  return countApprovedApplicationSeats(sb, ticketId);
}

/**
 * Create a pending Category Exclusivity / application-based registration and notify organiser + attendee.
 */
async function createApplicationFromSubmission(input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const sb = getSupabaseAdmin();
  const eventId = String(input.eventId || input.event_id || '').trim();
  const ticketId = String(input.ticketId || input.ticket_id || '').trim();
  const industry = String(input.industry || input.screening_answer_industry || '').trim();
  const jobTitle = String(input.jobTitle || input.job_title || input.screening_answer_job_title || '').trim();
  const email = String(input.email || '').trim().toLowerCase();

  if (!eventId || !isUuid(eventId)) {
    const err = new Error('invalid_event_id');
    err.code = 'invalid_event_id';
    throw err;
  }
  if (!ticketId || !isUuid(ticketId)) {
    const err = new Error('invalid_ticket_id');
    err.code = 'invalid_ticket_id';
    throw err;
  }
  if (!email) {
    const err = new Error('missing_email');
    err.code = 'missing_email';
    throw err;
  }
  if (!industry) {
    const err = new Error('missing_industry');
    err.code = 'missing_industry';
    throw err;
  }
  if (!jobTitle) {
    const err = new Error('missing_job_title');
    err.code = 'missing_job_title';
    throw err;
  }

  const [evRes, ticketRes] = await Promise.all([
    sb
      .from('events')
      .select('id, title, slug, status, approval_status, organiser_id, ticket_sales_enabled')
      .eq('id', eventId)
      .maybeSingle(),
    sb.from('tickets').select('*').eq('id', ticketId).maybeSingle(),
  ]);
  if (evRes.error) throw new Error(evRes.error.message);
  if (ticketRes.error) throw new Error(ticketRes.error.message);

  const eventRow = evRes.data;
  const ticketRow = ticketRes.data;
  if (!eventRow) {
    const err = new Error('event_not_found');
    err.code = 'event_not_found';
    throw err;
  }
  if (!ticketRow || ticketRow.event_id !== eventId) {
    const err = new Error('ticket_not_found');
    err.code = 'ticket_not_found';
    throw err;
  }
  if (String(eventRow.status || '').toLowerCase() !== 'published') {
    const err = new Error('event_not_published');
    err.code = 'event_not_published';
    throw err;
  }
  if (!String(eventRow.organiser_id || '').trim()) {
    const err = new Error('missing_organiser');
    err.code = 'missing_organiser';
    throw err;
  }
  await assertNotBlockedByOrganiser(sb, {
    organiserId: eventRow.organiser_id,
    email,
  });
  if (!ticketIsApplication(ticketRow)) {
    const err = new Error('not_application_ticket');
    err.code = 'not_application_ticket';
    throw err;
  }

  const { data: eventTickets, error: ticketsErr } = await sb
    .from('tickets')
    .select('id, status, sale_starts_at, sale_ends_at')
    .eq('event_id', eventId);
  if (ticketsErr) throw new Error(ticketsErr.message);

  if (!resolveTicketSalesEnabled(eventRow, eventTickets || [])) {
    const err = new Error('applications_not_open');
    err.code = 'applications_not_open';
    throw err;
  }
  if (!isTicketOnSale(ticketRow)) {
    const err = new Error('applications_closed');
    err.code = 'applications_closed';
    throw err;
  }

  if (ticketRow.quantity != null) {
    const cap = Math.max(0, Number(ticketRow.quantity) || 0);
    const sold = await countTicketApplications(sb, ticketId);
    if (cap > 0 && sold >= cap) {
      const err = new Error('applications_full');
      err.code = 'applications_full';
      throw err;
    }
  }

  await assertEventHasCapacity(sb, eventId, 1);

  const session = {
    email,
    name: input.name || input.customerName || null,
    sub: input.userId || input.supabase_user_id || null,
  };
  const attendeeId = await ensureAttendeeId(sb, session);

  const dupRes = await sb
    .from('registrations')
    .select('id, application_status')
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId)
    .is('cancelled_at', null)
    .neq('application_status', 'Denied')
    .limit(1)
    .maybeSingle();
  if (dupRes.error) throw new Error(dupRes.error.message);
  if (dupRes.data?.id) {
    const err = new Error('already_applied');
    err.code = 'already_applied';
    throw err;
  }

  const organiserId = eventRow.organiser_id || input.organiserId || input.organiser_id || null;
  const { buildBookingSnapshotForRegistration } = require('./booking-snapshot');
  const bookedSnapshot = await buildBookingSnapshotForRegistration(sb, {
    eventId,
    ticketId,
    quantity: 1,
    amountPaid: 0,
    paymentStatus: 'Pending',
  });
  const row = {
    attendee_id: attendeeId,
    event_id: eventId,
    ticket_id: ticketId,
    organiser_id: organiserId,
    payment_status: 'Pending',
    amount_paid: 0,
    quantity: 1,
    application_status: 'Pending',
    screening_answer_industry: industry,
    screening_answer_job_title: jobTitle,
    booked_snapshot: bookedSnapshot,
  };

  const ins = await sb.from('registrations').insert(row).select('*').single();
  if (ins.error) {
    rethrowIfCapacityExceeded(ins.error);
    throw new Error(ins.error.message);
  }

  const { lockEventOnFirstSale } = require('./event-sale-lock');
  await lockEventOnFirstSale(sb, eventId);

  let emailResult = null;
  try {
    emailResult = await sendApplicationEmails(sb, ins.data);
  } catch (e) {
    emailResult = { error: e.message || String(e) };
  }

  return {
    action: 'created',
    id: ins.data.id,
    attendeeId,
    registration: ins.data,
    emailResult,
  };
}

/**
 * Whether the signed-in attendee already has an active application/registration for an event.
 */
async function getEventApplicationForSession(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');

  const id = String(eventId || '').trim();
  if (!id) {
    const err = new Error('invalid_event_id');
    err.code = 'invalid_event_id';
    throw err;
  }

  const email = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return { hasApplication: false };
  }

  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    return { hasApplication: false };
  }

  const { data, error } = await sb
    .from('registrations')
    .select('id, application_status, payment_status, created_at')
    .eq('event_id', id)
    .eq('attendee_id', attendeeId)
    .is('cancelled_at', null)
    .neq('application_status', 'Denied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    return { hasApplication: false };
  }

  return {
    hasApplication: true,
    registrationId: data.id,
    applicationStatus: String(data.application_status || 'Approved').trim(),
    paymentStatus: String(data.payment_status || 'Pending').trim(),
    submittedAt: data.created_at || null,
  };
}

module.exports = {
  createApplicationFromSubmission,
  getEventApplicationForSession,
  ticketIsApplication,
};
