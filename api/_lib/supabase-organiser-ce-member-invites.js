const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { sendTemplatedEmail } = require('./send-template-email');
const { baseEmailVars } = require('./lifecycle-emails');
const { siteBase } = require('./hub-email-urls');
const { isUuid } = require('./uuid');
const { isCategoryExclusivityEvent } = require('./category-exclusivity');
const { listRosterForOrganiser } = require('./organiser-member-roster');
const {
  ceMemberInviteEmailVariables,
  loadCeMemberInviteTicket,
} = require('./ce-member-invites');

async function assertOrganiserOwnsCeEvent(session, eventId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.role) {
    const err = new Error('not_authenticated');
    err.status = 401;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select(
      'id, title, slug, organiser_id, attendance_mode, status, approval_status, starts_at, location_label, city'
    )
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('event_not_found');
    err.status = 404;
    throw err;
  }
  const allowed = new Set(access.groupIds || []);
  if (!allowed.has(data.organiser_id)) {
    const err = new Error('not_allowed');
    err.status = 403;
    throw err;
  }
  if (!isCategoryExclusivityEvent(data)) {
    const err = new Error('not_category_exclusivity');
    err.status = 400;
    err.message = 'Invite members is only available on Category Exclusivity events.';
    throw err;
  }
  return { access, event: data, sb };
}

async function listCeMemberInviteStats(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const { sb } = await assertOrganiserOwnsCeEvent(session, eventId);
  const { data, error } = await sb.from('ce_member_invites').select('status').eq('event_id', eventId);
  if (error) throw new Error(error.message);
  const stats = { pending: 0, sent: 0, redeemed: 0, revoked: 0, expired: 0, total: 0 };
  (data || []).forEach((row) => {
    const status = String(row.status || '').trim();
    if (stats[status] != null) stats[status] += 1;
    stats.total += 1;
  });
  return stats;
}

async function previewCeMemberInvites(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const { event, sb } = await assertOrganiserOwnsCeEvent(session, eventId);
  const members = await listRosterForOrganiser(event.organiser_id, { status: 'active' });
  const activeMembers = (members || []).filter((m) => m.membershipActive && m.email);
  const ticket = await loadCeMemberInviteTicket(sb, eventId);
  const stats = await listCeMemberInviteStats(session, eventId);
  return {
    targetEvent: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      status: event.status,
      attendanceMode: event.attendance_mode,
      startsAt: event.starts_at,
    },
    activeMemberCount: activeMembers.length,
    ticket: ticket
      ? {
          id: ticket.id,
          name: ticket.name,
          price: ticket.price,
          quantity: ticket.quantity,
          visibility: ticket.visibility || null,
        }
      : null,
    stats,
  };
}

async function sendCeMemberInvites(session, { eventId, sendEmails = true }) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const id = String(eventId || '').trim();
  if (!isUuid(id)) {
    const err = new Error('invalid_event_id');
    err.status = 400;
    throw err;
  }

  const { event, sb } = await assertOrganiserOwnsCeEvent(session, id);

  if (String(event.status || '').trim() !== 'published') {
    const err = new Error('event_not_published');
    err.status = 400;
    err.message = 'Publish the event before inviting members.';
    throw err;
  }

  const ticket = await loadCeMemberInviteTicket(sb, id);
  if (!ticket) {
    const err = new Error('ce_ticket_missing');
    err.status = 400;
    err.message = 'Set up Category Exclusivity tickets before inviting members.';
    throw err;
  }

  const organiserRes = await sb
    .from('organisers')
    .select('id, name')
    .eq('id', event.organiser_id)
    .maybeSingle();
  if (organiserRes.error) throw new Error(organiserRes.error.message);

  const members = await listRosterForOrganiser(event.organiser_id, { status: 'active' });
  const activeMembers = (members || []).filter((m) => m.membershipActive && m.email);
  if (!activeMembers.length) {
    return {
      eventId: id,
      eligible: 0,
      created: 0,
      sent: 0,
      skipped: 0,
      errors: [],
    };
  }

  const siteUrl = siteBase();
  const result = { eligible: activeMembers.length, created: 0, sent: 0, skipped: 0, errors: [] };

  for (const member of activeMembers) {
    const email = String(member.email || '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    try {
      const existingRes = await sb
        .from('ce_member_invites')
        .select('id, status')
        .eq('event_id', id)
        .eq('email', email)
        .maybeSingle();
      if (existingRes.error) throw new Error(existingRes.error.message);
      const existingStatus = String(existingRes.data?.status || '').trim();
      if (['sent', 'redeemed', 'revoked'].includes(existingStatus)) {
        result.skipped += 1;
        continue;
      }

      const upsertRes = await sb
        .from('ce_member_invites')
        .upsert(
          {
            organiser_id: event.organiser_id,
            event_id: id,
            roster_member_id: member.id || null,
            email,
            attendee_id: member.attendeeId || null,
            invited_by: session.sub || null,
            status: 'pending',
          },
          { onConflict: 'event_id,email', ignoreDuplicates: false }
        )
        .select('*')
        .single();
      if (upsertRes.error) throw new Error(upsertRes.error.message);
      const invite = upsertRes.data;
      result.created += 1;

      if (!sendEmails) continue;

      const vars = ceMemberInviteEmailVariables({
        siteUrl,
        invite,
        member,
        eventRow: event,
        organiserRow: organiserRes.data,
        ticket,
      });

      await sendTemplatedEmail({
        slug: 'ce_member_invite',
        to: email,
        variables: { ...baseEmailVars(siteUrl), ...vars },
      });

      await sb
        .from('ce_member_invites')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invite.id);
      result.sent += 1;
    } catch (e) {
      result.errors.push({ email, error: e.message || String(e) });
    }
  }

  return { eventId: id, ...result };
}

async function sendCeMemberInvitesForEvents(session, { eventIds, sendEmails = true }) {
  const ids = Array.from(
    new Set(
      (Array.isArray(eventIds) ? eventIds : [])
        .map((id) => String(id || '').trim())
        .filter((id) => isUuid(id))
    )
  );
  if (!ids.length) {
    const err = new Error('missing_event_id');
    err.status = 400;
    throw err;
  }

  const combined = {
    eventIds: ids,
    eligible: 0,
    created: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    byEvent: [],
  };

  for (const eventId of ids) {
    const result = await sendCeMemberInvites(session, { eventId, sendEmails });
    if (!combined.eligible) combined.eligible = result.eligible || 0;
    combined.created += result.created || 0;
    combined.sent += result.sent || 0;
    combined.skipped += result.skipped || 0;
    if (Array.isArray(result.errors) && result.errors.length) {
      combined.errors.push(
        ...result.errors.map((row) => ({
          ...row,
          eventId,
        }))
      );
    }
    combined.byEvent.push(result);
  }

  return combined;
}

module.exports = {
  listCeMemberInviteStats,
  previewCeMemberInvites,
  sendCeMemberInvites,
  sendCeMemberInvitesForEvents,
};
