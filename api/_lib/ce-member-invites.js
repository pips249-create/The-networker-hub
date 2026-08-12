/**
 * Category Exclusivity — Membership list people can book without applying.
 * Organisers invite members; open applications stay for everyone else.
 */
const { siteBase, logoNavUrl, logoFooterUrl } = require('./hub-email-urls');
const { formatEventDateTime } = require('./favourite-sales-emails');
const { isCategoryExclusivityEvent } = require('./category-exclusivity');
const { getActiveRosterMembership } = require('./organiser-member-roster');
const { assertApplicationSeatAvailable } = require('./application-capacity');

const INVITE_STATUSES_ACTIVE = ['pending', 'sent'];

async function findActiveCeMemberInvite(sb, { eventId, email, token }) {
  if (token) {
    const { data, error } = await sb
      .from('ce_member_invites')
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
    .from('ce_member_invites')
    .select('*')
    .eq('event_id', eventId)
    .ilike('email', normalized)
    .in('status', INVITE_STATUSES_ACTIVE)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/**
 * Active Membership list member for this CE event organiser may book without applying.
 * Optional invite token is not required when signed in with the roster email.
 */
async function getCeMemberBookingEligibility(sb, { event, organiserId, email, attendeeId, userId, token }) {
  if (!isCategoryExclusivityEvent(event)) {
    return { eligible: false, reason: 'not_ce_event', invite: null };
  }
  const orgId = String(organiserId || event?.organiser_id || event?.organiserId || '').trim();
  if (!orgId) {
    return { eligible: false, reason: 'missing_organiser', invite: null };
  }

  const invite = await findActiveCeMemberInvite(sb, {
    eventId: event?.id || event?.event_id,
    email,
    token,
  });

  const membership = await getActiveRosterMembership(sb, {
    organiserId: orgId,
    email,
    attendeeId,
    userId: userId || attendeeId,
  });

  if (!membership.active) {
    if (invite) {
      return { eligible: false, reason: 'membership_inactive', invite };
    }
    return { eligible: false, reason: 'not_member', invite: null };
  }

  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (invite && normalized && String(invite.email || '').toLowerCase() !== normalized) {
    return { eligible: false, reason: 'email_mismatch', invite: null };
  }

  return {
    eligible: true,
    reason: invite ? 'invited_member' : 'roster_member',
    invite: invite || null,
    inviteToken: invite?.invite_token || null,
    rosterRow: membership.row || null,
  };
}

async function assertCeMemberBookingAllowed(sb, opts) {
  const eligibility = await getCeMemberBookingEligibility(sb, opts);
  if (!eligibility.eligible) {
    const err = new Error(eligibility.reason || 'ce_member_not_eligible');
    err.status = 403;
    err.code = eligibility.reason || 'ce_member_not_eligible';
    err.eligibility = eligibility;
    throw err;
  }
  return eligibility;
}

async function markCeMemberInviteRedeemed(sb, { inviteId, registrationId }) {
  if (!inviteId) return;
  const { error } = await sb
    .from('ce_member_invites')
    .update({
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      registration_id: registrationId || null,
    })
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}

function buildCeMemberInviteUrl(siteUrl, eventSlug, token) {
  const base = String(siteUrl || siteBase()).replace(/\/$/, '');
  const slug = String(eventSlug || '').trim();
  const qs = token ? 'ce_member_token=' + encodeURIComponent(String(token).trim()) : '';
  if (slug) {
    return base + '/events/' + encodeURIComponent(slug) + (qs ? '?' + qs : '');
  }
  return base + '/events/' + (qs ? '?' + qs : '');
}

function ceMemberInviteEmailVariables({
  siteUrl,
  invite,
  member,
  eventRow,
  organiserRow,
  ticket,
}) {
  const site = String(siteUrl || siteBase()).replace(/\/$/, '');
  const { event_date, event_time } = formatEventDateTime(eventRow?.starts_at);
  const priceNum = Number(ticket?.price) || 0;
  const ticketPrice = priceNum > 0 ? '£' + priceNum.toFixed(2) : 'Free';
  const eventUrl = (() => {
    const slug = String(eventRow?.slug || '').trim();
    if (slug) return site + '/events/' + encodeURIComponent(slug);
    const id = String(eventRow?.id || '').trim();
    if (id) return site + '/events/event?id=' + encodeURIComponent(id);
    return site + '/events/';
  })();
  const inviteUrl = buildCeMemberInviteUrl(site, eventRow?.slug, invite?.invite_token);
  return {
    site_url: site,
    logo_url: logoNavUrl(site),
    logo_footer_url: logoFooterUrl(site),
    privacy_url: site + '/legal-policies#privacy',
    terms_url: site + '/legal-policies#terms',
    contact_url: site + '/contact',
    user_name: String(member?.name || '').trim() || 'there',
    organiser_name: String(organiserRow?.name || 'your networking group').trim(),
    event_name: String(eventRow?.title || 'your event').trim(),
    event_date: event_date || '',
    event_time: event_time || '',
    event_location: String(eventRow?.location_label || eventRow?.city || '').trim(),
    event_url: eventUrl,
    ticket_price: ticketPrice,
    invite_url: inviteUrl,
    cta_label: priceNum > 0 ? 'Book as a member' : 'Confirm your place',
  };
}

async function loadCeApplicationTicket(sb, eventId) {
  const { data, error } = await sb
    .from('tickets')
    .select('id, name, price, quantity, ticket_type, visibility, status')
    .eq('event_id', eventId)
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const application = rows.find((t) =>
    /application/i.test(String(t.ticket_type || t.name || ''))
  );
  return application || rows[0] || null;
}

/**
 * Ticket shown in member invite emails / used for seat checks.
 * Prefer the Members only rate when the CE event has one; otherwise the application seat.
 */
async function loadCeMemberInviteTicket(sb, eventId) {
  const { data, error } = await sb
    .from('tickets')
    .select('id, name, price, quantity, ticket_type, visibility, status')
    .eq('event_id', eventId)
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((t) => {
    const st = String(t.status || '').trim().toLowerCase();
    return !st || st === 'active' || st === 'published';
  });
  const membersOnly = rows.find((t) => {
    const vis = String(t.visibility || '').trim().toLowerCase();
    return vis === 'members_only';
  });
  if (membersOnly) return membersOnly;
  const application = rows.find((t) =>
    /application/i.test(String(t.ticket_type || t.name || ''))
  );
  return application || rows[0] || null;
}

async function assertCeMemberSeatAvailable(sb, ticketRow, { excludeRegistrationId } = {}) {
  if (!ticketRow) return;
  await assertApplicationSeatAvailable(sb, ticketRow, { excludeRegistrationId });
}

module.exports = {
  INVITE_STATUSES_ACTIVE,
  findActiveCeMemberInvite,
  getCeMemberBookingEligibility,
  assertCeMemberBookingAllowed,
  markCeMemberInviteRedeemed,
  buildCeMemberInviteUrl,
  ceMemberInviteEmailVariables,
  loadCeApplicationTicket,
  loadCeMemberInviteTicket,
  assertCeMemberSeatAvailable,
};
