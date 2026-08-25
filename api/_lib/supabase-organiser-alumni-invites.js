const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { sendTemplatedEmail } = require('./send-template-email');
const { baseEmailVars } = require('./lifecycle-emails');
const { siteBase } = require('./hub-email-urls');
const { isUuid } = require('./uuid');
const {
  listConfirmedAttendeesForEvent,
  inviteEmailVariables,
  isAlumniTicket,
  registrationCountsAsAlumniSource,
} = require('./alumni-invites');

async function assertOrganiserOwnsEvent(session, eventId) {
  const access = await resolveOrganiserAccess(session);
  if (!access.role) {
    const err = new Error('not_authenticated');
    err.status = 401;
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, slug, organiser_id, alumni_fast_pass_enabled, alumni_source_event_id, starts_at, location_label, city')
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
  return { access, event: data };
}

async function listAlumniInviteStats(session, eventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  await assertOrganiserOwnsEvent(session, eventId);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('alumni_invites')
    .select('status')
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  const stats = { pending: 0, sent: 0, redeemed: 0, revoked: 0, expired: 0, total: 0 };
  (data || []).forEach((row) => {
    const status = String(row.status || '').trim();
    if (stats[status] != null) stats[status] += 1;
    stats.total += 1;
  });
  return stats;
}

async function listEligibleSourceEvents(session, targetEventId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const { event } = await assertOrganiserOwnsEvent(session, targetEventId);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, slug, starts_at, status')
    .eq('organiser_id', event.organiser_id)
    .neq('id', targetEventId)
    .order('starts_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const events = data || [];
  const countsByEvent = new Map();
  if (events.length) {
    const eventIds = events.map((row) => row.id).filter(Boolean);
    const pageSize = 500;
    const hardCap = 8000;
    for (let i = 0; i < eventIds.length; i += 80) {
      const chunk = eventIds.slice(i, i + 80);
      for (let from = 0; from < hardCap; from += pageSize) {
        const to = Math.min(from + pageSize - 1, hardCap - 1);
        const { data: regs, error: regErr } = await sb
          .from('registrations')
          .select(
            'event_id, application_status, payment_status, cancelled_at, attendees(email)'
          )
          .in('event_id', chunk)
          .is('cancelled_at', null)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (regErr) throw new Error(regErr.message);
        const batch = regs || [];
        batch.forEach((row) => {
          if (!registrationCountsAsAlumniSource(row)) return;
          const email = String(row.attendees?.email || '')
            .trim()
            .toLowerCase();
          if (!email || !row.event_id) return;
          if (!countsByEvent.has(row.event_id)) countsByEvent.set(row.event_id, new Set());
          countsByEvent.get(row.event_id).add(email);
        });
        if (batch.length < pageSize) break;
      }
    }
  }

  const results = [];
  for (const row of events) {
    const emails = countsByEvent.get(row.id);
    const confirmedAttendeeCount = emails ? emails.size : 0;
    if (!confirmedAttendeeCount) continue;
    results.push({
      id: row.id,
      title: row.title,
      slug: row.slug,
      startsAt: row.starts_at,
      status: row.status,
      confirmedAttendeeCount,
    });
  }
  return {
    targetEvent: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      alumniFastPassEnabled: Boolean(event.alumni_fast_pass_enabled),
      alumniSourceEventId: event.alumni_source_event_id || null,
    },
    sourceEvents: results,
  };
}

async function sendAlumniFastPassInvites(session, { targetEventId, sourceEventId, sendEmails = true }) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const targetId = String(targetEventId || '').trim();
  const sourceId = String(sourceEventId || '').trim();
  if (!isUuid(targetId) || !isUuid(sourceId)) {
    const err = new Error('invalid_event_id');
    err.status = 400;
    throw err;
  }

  const { event: targetEvent } = await assertOrganiserOwnsEvent(session, targetId);
  const sb = getSupabaseAdmin();

  const sourceRes = await sb
    .from('events')
    .select('id, title, slug, organiser_id, starts_at')
    .eq('id', sourceId)
    .maybeSingle();
  if (sourceRes.error) throw new Error(sourceRes.error.message);
  if (!sourceRes.data || sourceRes.data.organiser_id !== targetEvent.organiser_id) {
    const err = new Error('source_event_not_allowed');
    err.status = 400;
    throw err;
  }

  if (!targetEvent.alumni_fast_pass_enabled) {
    const err = new Error('alumni_fast_pass_not_enabled');
    err.status = 400;
    err.message = 'Enable Previous Attendees on the ticket setup page before sending invites.';
    throw err;
  }

  const ticketRes = await sb
    .from('tickets')
    .select('id, name, price, ticket_type')
    .eq('event_id', targetId)
    .limit(20);
  if (ticketRes.error) throw new Error(ticketRes.error.message);
  const alumniTicket = (ticketRes.data || []).find((t) => isAlumniTicket(t));
  if (!alumniTicket) {
    const err = new Error('alumni_tier_missing');
    err.status = 400;
    err.message = 'Add a previous attendee ticket tier before sending invites.';
    throw err;
  }

  const organiserRes = await sb
    .from('organisers')
    .select('id, name')
    .eq('id', targetEvent.organiser_id)
    .maybeSingle();
  if (organiserRes.error) throw new Error(organiserRes.error.message);

  const attendees = await listConfirmedAttendeesForEvent(sb, sourceId);
  if (!attendees.length) {
    const err = new Error('no_confirmed_attendees');
    err.status = 400;
    err.message = 'No confirmed attendees found on the source event.';
    throw err;
  }

  await sb
    .from('events')
    .update({ alumni_source_event_id: sourceId })
    .eq('id', targetId);

  const siteUrl = siteBase();
  const result = { created: 0, sent: 0, skipped: 0, errors: [] };

  for (const attendee of attendees) {
    const email = attendee.email;
    try {
      const existingRes = await sb
        .from('alumni_invites')
        .select('id, status')
        .eq('event_id', targetId)
        .eq('email', email)
        .maybeSingle();
      if (existingRes.error) throw new Error(existingRes.error.message);
      const existingStatus = String(existingRes.data?.status || '').trim();
      if (['sent', 'redeemed', 'revoked'].includes(existingStatus)) {
        result.skipped += 1;
        continue;
      }

      const upsertRes = await sb
        .from('alumni_invites')
        .upsert(
          {
            organiser_id: targetEvent.organiser_id,
            event_id: targetId,
            source_event_id: sourceId,
            email,
            attendee_id: attendee.attendeeId || null,
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

      const vars = inviteEmailVariables({
        siteUrl,
        invite,
        attendee,
        eventRow: targetEvent,
        sourceEventRow: sourceRes.data,
        organiserRow: organiserRes.data,
        alumniTicket,
      });

      await sendTemplatedEmail({
        slug: 'alumni_fast_pass_invite',
        to: email,
        variables: { ...baseEmailVars(siteUrl), ...vars },
      });

      await sb
        .from('alumni_invites')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invite.id);
      result.sent += 1;
    } catch (e) {
      result.errors.push({ email, error: e.message || String(e) });
    }
  }

  return {
    targetEventId: targetId,
    sourceEventId: sourceId,
    attendeeCount: attendees.length,
    ...result,
  };
}

module.exports = {
  listAlumniInviteStats,
  listEligibleSourceEvents,
  sendAlumniFastPassInvites,
};
