/**
 * Previous Attendees — invite-only discounted tickets for past confirmed attendees.
 */
const { siteBase } = require('./hub-email-urls');
const { formatEventDateTime } = require('./favourite-sales-emails');

const ALUMNI_TICKET_TYPE = 'Alumni';
const ALUMNI_TIER_NAME = 'Alumni ticket';
const INVITE_STATUSES_ACTIVE = ['pending', 'sent'];

function isAlumniTicket(ticket) {
  if (!ticket) return false;
  const type = String(ticket.ticket_type || ticket.ticketType || '').trim();
  if (type === ALUMNI_TICKET_TYPE) return true;
  return /^alumni/i.test(String(ticket.name || '').trim());
}

function alumniTierPayload({ price, quantityAvailable, saleEnd, description } = {}) {
  const priceNum = parseFloat(String(price || '0').replace(/[^0-9.]/g, '')) || 0;
  const qty =
    quantityAvailable != null && quantityAvailable !== ''
      ? Number(quantityAvailable)
      : null;
  return {
    name: ALUMNI_TIER_NAME,
    price: priceNum,
    description:
      String(description || '').trim() ||
      'Exclusive rate for previous attendees — invite only.',
    status: 'Available',
    quantityAvailable: Number.isFinite(qty) ? qty : null,
    saleEnd: saleEnd || null,
    ticketType: ALUMNI_TICKET_TYPE,
    displayOrder: 99,
    isAlumni: true,
  };
}

async function resolveAttendeeId(sb, { attendeeId, email }) {
  const id = String(attendeeId || '').trim();
  if (id) {
    // Callers may pass attendees.id or session.sub (supabase auth user id).
    const byId = await sb.from('attendees').select('id').eq('id', id).maybeSingle();
    if (byId.error) throw new Error(byId.error.message);
    if (byId.data?.id) return byId.data.id;

    const byUser = await sb
      .from('attendees')
      .select('id')
      .eq('supabase_user_id', id)
      .maybeSingle();
    if (byUser.error) throw new Error(byUser.error.message);
    if (byUser.data?.id) return byUser.data.id;
  }
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  const { data, error } = await sb
    .from('attendees')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id || null;
}

function registrationCountsAsAlumniSource(row) {
  if (!row || row.cancelled_at) return false;
  if (String(row.application_status || '').trim() === 'Denied') return false;
  if (String(row.application_status || '').trim() === 'Pending') return false;
  const payment = String(row.payment_status || '').trim();
  return payment === 'Paid' || payment === 'Free';
}

async function listConfirmedAttendeesForEvent(sb, eventId) {
  const { data, error } = await sb
    .from('registrations')
    .select(
      `
      id,
      attendee_id,
      payment_status,
      application_status,
      cancelled_at,
      attendees ( id, name, email )
    `
    )
    .eq('event_id', eventId)
    .is('cancelled_at', null);
  if (error) throw new Error(error.message);

  const byEmail = new Map();
  (data || []).forEach((row) => {
    if (!registrationCountsAsAlumniSource(row)) return;
    const attendee = row.attendees || {};
    const email = String(attendee.email || '')
      .trim()
      .toLowerCase();
    if (!email) return;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        email,
        attendeeId: attendee.id || row.attendee_id || null,
        name: String(attendee.name || '').trim() || email.split('@')[0],
      });
    }
  });
  return [...byEmail.values()];
}

async function findActiveInvite(sb, { eventId, email, token }) {
  if (token) {
    const { data, error } = await sb
      .from('alumni_invites')
      .select('*')
      .eq('invite_token', String(token).trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    if (!INVITE_STATUSES_ACTIVE.includes(String(data.status || '').trim())) return null;
    if (eventId && data.event_id !== eventId) return null;
    return data;
  }
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized || !eventId) return null;
  const { data, error } = await sb
    .from('alumni_invites')
    .select('*')
    .eq('event_id', eventId)
    .ilike('email', normalized)
    .in('status', INVITE_STATUSES_ACTIVE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function getAlumniEligibility(sb, { eventId, email, attendeeId, token }) {
  const evRes = await sb
    .from('events')
    .select('id, title, slug, organiser_id, alumni_fast_pass_enabled, status')
    .eq('id', eventId)
    .maybeSingle();
  if (evRes.error) throw new Error(evRes.error.message);
  const eventRow = evRes.data;
  if (!eventRow || !eventRow.alumni_fast_pass_enabled) {
    return { eligible: false, reason: 'not_enabled', invite: null };
  }

  const ticketRes = await sb
    .from('tickets')
    .select('id, name, price, quantity, ticket_type, sale_ends_at, status')
    .eq('event_id', eventId)
    .eq('ticket_type', ALUMNI_TICKET_TYPE)
    .limit(1)
    .maybeSingle();
  if (ticketRes.error) throw new Error(ticketRes.error.message);
  if (!ticketRes.data) {
    return { eligible: false, reason: 'no_alumni_tier', invite: null };
  }

  const invite = await findActiveInvite(sb, { eventId, email, token });
  if (!invite) {
    return { eligible: false, reason: 'not_invited', invite: null, alumniTierId: ticketRes.data.id };
  }

  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (normalized && invite.email.toLowerCase() !== normalized) {
    return { eligible: false, reason: 'email_mismatch', invite: null };
  }

  return {
    eligible: true,
    reason: 'invited',
    invite,
    alumniTierId: ticketRes.data.id,
    alumniTier: ticketRes.data,
    inviteToken: invite.invite_token,
  };
}

async function assertAlumniBookingAllowed(sb, { eventId, email, attendeeId, inviteToken }) {
  const eligibility = await getAlumniEligibility(sb, {
    eventId,
    email,
    attendeeId,
    token: inviteToken,
  });
  if (!eligibility.eligible) {
    const err = new Error(eligibility.reason || 'alumni_not_eligible');
    err.status = 403;
    err.code = eligibility.reason || 'alumni_not_eligible';
    err.eligibility = eligibility;
    throw err;
  }
  return eligibility;
}

async function markInviteRedeemed(sb, { inviteId, registrationId }) {
  if (!inviteId) return;
  const { error } = await sb
    .from('alumni_invites')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      registration_id: registrationId || null,
    })
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

function buildInviteUrl(siteUrl, eventSlug, token) {
  const base = String(siteUrl || siteBase()).replace(/\/$/, '');
  const slug = String(eventSlug || '').trim();
  const tokenQs = 'alumni_token=' + encodeURIComponent(String(token || '').trim());
  if (slug) return base + '/events/' + encodeURIComponent(slug) + '?' + tokenQs;
  return base + '/events/event?' + tokenQs;
}

function inviteEmailVariables({
  siteUrl,
  invite,
  attendee,
  eventRow,
  sourceEventRow,
  organiserRow,
  alumniTicket,
}) {
  const site = String(siteUrl || siteBase()).replace(/\/$/, '');
  const { event_date, event_time } = formatEventDateTime(eventRow?.starts_at);
  const priceNum = Number(alumniTicket?.price) || 0;
  const alumniPrice = priceNum > 0 ? '£' + priceNum.toFixed(2) : 'Free';
  return {
    site_url: site,
    logo_url: site + '/images/logo-email.png',
    logo_footer_url: site + '/images/logo-email-footer.png',
    privacy_url: site + '/legal-policies#privacy',
    terms_url: site + '/legal-policies#terms',
    contact_url: site + '/contact',
    user_name: String(attendee?.name || '').trim() || 'there',
    organiser_name: String(organiserRow?.name || 'the organiser').trim(),
    event_name: String(eventRow?.title || 'your event').trim(),
    event_date: event_date || '',
    event_time: event_time || '',
    event_location: String(eventRow?.location_label || eventRow?.city || '').trim(),
    event_url: (() => {
      const slug = String(eventRow?.slug || '').trim();
      if (slug) return site + '/events/' + encodeURIComponent(slug);
      const id = String(eventRow?.id || '').trim();
      if (id) return site + '/events/event?id=' + encodeURIComponent(id);
      return site + '/events/';
    })(),
    source_event_name: String(sourceEventRow?.title || 'your previous event').trim(),
    alumni_price: alumniPrice,
    invite_url: buildInviteUrl(site, eventRow?.slug, invite?.invite_token),
  };
}

module.exports = {
  ALUMNI_TICKET_TYPE,
  ALUMNI_TIER_NAME,
  INVITE_STATUSES_ACTIVE,
  isAlumniTicket,
  alumniTierPayload,
  listConfirmedAttendeesForEvent,
  findActiveInvite,
  getAlumniEligibility,
  assertAlumniBookingAllowed,
  markInviteRedeemed,
  buildInviteUrl,
  inviteEmailVariables,
  registrationCountsAsAlumniSource,
};
