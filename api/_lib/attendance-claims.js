/**
 * Attendance claims: attendee claims → organiser Yes/No → organiser-confirmed review unlock.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { resolveAttendeeId } = require('./supabase-favourites');
const { eventHasEnded, isEligibleRegistration, findRegistrationForReview } = require('./supabase-reviews');
const { createAttendanceClaimToken, verifyAttendanceClaimToken, DEFAULT_TTL_DAYS } = require('./attendance-claim-token');
const {
  ORGANISER_CONFIRMED_WEIGHT,
  MAX_ORGANISER_CONFIRMED_SHARE,
  provenanceWeight,
  computeWeightedReviewStats,
} = require('./attendance-claim-weights');
const { sendTemplatedEmail } = require('./send-template-email');
const { emailSiteBase } = require('./hub-email-urls');
const { resolveOrganiserAccess } = require('./supabase-organiser-access');
const { isUuid } = require('./uuid');
const { reviewerDisplayName } = require('./reviewer-display-name');

const CLAIM_WINDOW_DAYS = 90;
const RESPONSE_TTL_DAYS = DEFAULT_TTL_DAYS;
const REVIEW_UNLOCK_DAYS = 7;
const MAX_OPEN_CLAIMS = 3;
const MAX_CLAIMS_PER_30_DAYS = 5;
const NETWORKED_NOMINATION_MIN = 3;

function siteBase() {
  return emailSiteBase(process.env.SITE_URL);
}

function daysFromNow(days) {
  return new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
}

function addDaysIso(from, days) {
  const base = from ? new Date(from) : new Date();
  const ms = base.getTime() + Number(days) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function findConfirmedClaimForReview(sb, attendeeId, eventId) {
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('attendance_claims')
    .select('id, status, review_unlocked_until, review_id, organiser_id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .maybeSingle();
  if (error) {
    if (/attendance_claims|relation|does not exist/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }
  if (!data?.id) return null;
  if (data.review_id) return { ...data, expired: true, reason: 'already_reviewed' };
  if (!data.review_unlocked_until || data.review_unlocked_until < nowIso) {
    return { ...data, expired: true, reason: 'review_window_expired' };
  }
  return { ...data, expired: false };
}

function mapClaimRow(row) {
  const ev = row.events || {};
  const org = row.organisers || {};
  const att = row.attendees || {};
  return {
    id: row.id,
    status: row.status,
    eventId: row.event_id || ev.id || null,
    eventTitle: String(ev.title || 'Event').trim(),
    eventDate: ev.starts_at || ev.ends_at || null,
    eventSlug: ev.slug || null,
    imageUrl: String(ev.image_url || '').trim() || null,
    organiserId: row.organiser_id || org.id || null,
    organiserName: String(org.name || '').trim() || 'Organiser',
    organiserSlug: org.slug || null,
    organiserLogo: String(org.photo_url || '').trim() || null,
    attendeeId: row.attendee_id || null,
    attendeeName: reviewerDisplayName(att) || String(att.name || 'Attendee').trim(),
    attendeeEmail: String(att.email || '').trim() || null,
    claimedAt: row.claimed_at || row.created_at || null,
    expiresAt: row.expires_at || null,
    respondedAt: row.responded_at || null,
    reviewUnlockedUntil: row.review_unlocked_until || null,
    reviewId: row.review_id || null,
    canReview:
      row.status === 'confirmed' &&
      !row.review_id &&
      row.review_unlocked_until &&
      row.review_unlocked_until > new Date().toISOString(),
    source: 'attendance_claim',
  };
}

async function expireStaleClaims(sb) {
  const nowIso = new Date().toISOString();
  await sb
    .from('attendance_claims')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('status', 'pending')
    .lt('expires_at', nowIso);
}

async function assertCanCreateClaim(sb, attendeeId, eventId) {
  const { data: eventRow, error: evErr } = await sb
    .from('events')
    .select(
      'id, title, slug, starts_at, ends_at, organiser_id, status, listing_status, image_url, organisers ( id, name, slug, photo_url, contact_email, email )'
    )
    .eq('id', eventId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!eventRow?.id) {
    const err = new Error('event_not_found');
    err.code = 'event_not_found';
    throw err;
  }

  const eventStatus = String(eventRow.status || '')
    .trim()
    .toLowerCase();
  if (eventStatus !== 'published') {
    const err = new Error('event_not_claimable');
    err.code = 'event_not_claimable';
    throw err;
  }
  if (!eventHasEnded(eventRow)) {
    const err = new Error('event_not_finished');
    err.code = 'event_not_finished';
    throw err;
  }

  const endRaw = eventRow.ends_at || eventRow.starts_at;
  const endMs = new Date(endRaw).getTime();
  if (!Number.isNaN(endMs)) {
    const ageDays = (Date.now() - endMs) / (24 * 60 * 60 * 1000);
    if (ageDays > CLAIM_WINDOW_DAYS) {
      const err = new Error('claim_window_expired');
      err.code = 'claim_window_expired';
      throw err;
    }
  }

  const organiserId = eventRow.organiser_id || eventRow.organisers?.id || null;
  if (!organiserId) {
    const err = new Error('missing_organiser');
    err.code = 'missing_organiser';
    throw err;
  }

  const { data: attendee } = await sb
    .from('attendees')
    .select('id, name, email, supabase_user_id')
    .eq('id', attendeeId)
    .maybeSingle();

  // Block claiming own group (organiser account linked to same email / user).
  const orgEmail = String(
    eventRow.organisers?.contact_email || eventRow.organisers?.email || ''
  )
    .trim()
    .toLowerCase();
  const attEmail = String(attendee?.email || '')
    .trim()
    .toLowerCase();
  if (orgEmail && attEmail && orgEmail === attEmail) {
    const err = new Error('cannot_claim_own_event');
    err.code = 'cannot_claim_own_event';
    throw err;
  }

  const registration = await findRegistrationForReview(sb, attendeeId, eventId);
  if (registration && registration.no_show_at) {
    const err = new Error('did_not_attend');
    err.code = 'did_not_attend';
    throw err;
  }
  if (isEligibleRegistration(registration)) {
    const err = new Error('use_verified_review');
    err.code = 'use_verified_review';
    throw err;
  }

  const { data: existingReview } = await sb
    .from('reviews')
    .select('id')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (existingReview?.id) {
    const err = new Error('review_already_submitted');
    err.code = 'review_already_submitted';
    throw err;
  }

  const { data: existingClaim } = await sb
    .from('attendance_claims')
    .select('id, status')
    .eq('attendee_id', attendeeId)
    .eq('event_id', eventId)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();
  if (existingClaim?.id) {
    const err = new Error(
      existingClaim.status === 'confirmed' ? 'claim_already_confirmed' : 'claim_already_pending'
    );
    err.code = err.message;
    throw err;
  }

  const { count: openCount, error: openErr } = await sb
    .from('attendance_claims')
    .select('id', { count: 'exact', head: true })
    .eq('attendee_id', attendeeId)
    .eq('status', 'pending');
  if (openErr) throw new Error(openErr.message);
  if ((openCount || 0) >= MAX_OPEN_CLAIMS) {
    const err = new Error('too_many_open_claims');
    err.code = 'too_many_open_claims';
    throw err;
  }

  const since = addDaysIso(null, -30);
  const { count: recentCount, error: recentErr } = await sb
    .from('attendance_claims')
    .select('id', { count: 'exact', head: true })
    .eq('attendee_id', attendeeId)
    .gte('created_at', since);
  if (recentErr) throw new Error(recentErr.message);
  if ((recentCount || 0) >= MAX_CLAIMS_PER_30_DAYS) {
    const err = new Error('claim_rate_limited');
    err.code = 'claim_rate_limited';
    throw err;
  }

  return { eventRow, organiserId, attendee };
}

async function sendClaimRequestEmail(claim, eventRow, attendee, organiser) {
  const siteUrl = siteBase();
  const token = createAttendanceClaimToken({
    claimId: claim.id,
    organiserId: claim.organiser_id,
  });
  const confirmUrl =
    siteUrl +
    '/organiser/confirm-attendance.html?token=' +
    encodeURIComponent(token) +
    '&decision=yes';
  const denyUrl =
    siteUrl +
    '/organiser/confirm-attendance.html?token=' +
    encodeURIComponent(token) +
    '&decision=no';
  const dashboardUrl = siteUrl + '/organiser/#events-reviews';
  const attendeeName = reviewerDisplayName(attendee) || String(attendee?.name || 'An attendee').trim();
  const organiserName = String(organiser?.name || eventRow.organisers?.name || 'there').trim();
  const to = String(organiser?.contact_email || organiser?.email || eventRow.organisers?.contact_email || eventRow.organisers?.email || '')
    .trim()
    .toLowerCase();
  if (!to) throw new Error('organiser_email_missing');

  const eventDate = eventRow.starts_at
    ? new Date(eventRow.starts_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  await sendTemplatedEmail({
    slug: 'attendance_claim_request',
    to,
    variables: {
      user_name: organiserName,
      attendee_name: attendeeName,
      attendee_email: String(attendee?.email || '').trim(),
      event_name: String(eventRow.title || 'your event').trim(),
      event_date: eventDate,
      organiser_name: organiserName,
      confirm_url: confirmUrl,
      deny_url: denyUrl,
      dashboard_url: dashboardUrl,
    },
  });
}

async function sendClaimConfirmedReviewEmail(claim, eventRow, attendee, organiser) {
  const siteUrl = siteBase();
  const to = String(attendee?.email || '')
    .trim()
    .toLowerCase();
  if (!to) return;
  const reviewUrl =
    siteUrl +
    '/account/?route=past&claimReview=' +
    encodeURIComponent(claim.id) +
    '&eventId=' +
    encodeURIComponent(claim.event_id);
  const organiserName = String(organiser?.name || 'the organiser').trim();
  const eventDate = eventRow?.starts_at
    ? new Date(eventRow.starts_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  await sendTemplatedEmail({
    slug: 'attendance_claim_confirmed_review',
    to,
    variables: {
      user_name: reviewerDisplayName(attendee) || String(attendee?.name || 'there').trim(),
      attendee_name: reviewerDisplayName(attendee) || String(attendee?.name || '').trim(),
      event_name: String(eventRow?.title || 'the event').trim(),
      event_date: eventDate,
      organiser_name: organiserName,
      review_url: reviewUrl,
      dashboard_url: siteUrl + '/account/?route=past',
    },
  });
}

async function createAttendanceClaim(session, input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    const err = new Error('attendee_not_found');
    err.code = 'attendee_not_found';
    throw err;
  }

  const eventId = String(input?.eventId || input?.event_id || '').trim();
  if (!isUuid(eventId)) {
    const err = new Error('missing_event_id');
    err.code = 'missing_event_id';
    throw err;
  }

  await expireStaleClaims(sb);
  const { eventRow, organiserId, attendee } = await assertCanCreateClaim(sb, attendeeId, eventId);

  const expiresAt = daysFromNow(RESPONSE_TTL_DAYS).toISOString();
  const ins = await sb
    .from('attendance_claims')
    .insert({
      attendee_id: attendeeId,
      event_id: eventId,
      organiser_id: organiserId,
      status: 'pending',
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (ins.error) throw new Error(ins.error.message);

  const claim = ins.data;
  try {
    await sendClaimRequestEmail(claim, eventRow, attendee, eventRow.organisers);
    await sb
      .from('attendance_claims')
      .update({ organiser_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', claim.id);
  } catch (emailErr) {
    await sb.from('attendance_claims').delete().eq('id', claim.id);
    const err = new Error(emailErr.message || 'claim_email_failed');
    err.code = 'claim_email_failed';
    throw err;
  }

  return mapClaimRow({
    ...claim,
    events: eventRow,
    organisers: eventRow.organisers,
    attendees: attendee,
  });
}

async function respondToAttendanceClaim(options) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const decision = String(options?.decision || '')
    .trim()
    .toLowerCase();
  if (decision !== 'yes' && decision !== 'no' && decision !== 'confirm' && decision !== 'deny') {
    const err = new Error('invalid_decision');
    err.code = 'invalid_decision';
    throw err;
  }
  const confirm = decision === 'yes' || decision === 'confirm';

  let claimId = String(options?.claimId || options?.claim_id || '').trim();
  let organiserIdFromToken = null;

  if (options?.token) {
    const payload = verifyAttendanceClaimToken(options.token);
    if (!payload) {
      const err = new Error('invalid_or_expired_token');
      err.code = 'invalid_or_expired_token';
      throw err;
    }
    claimId = payload.claimId;
    organiserIdFromToken = payload.organiserId;
  }

  if (!isUuid(claimId)) {
    const err = new Error('missing_claim_id');
    err.code = 'missing_claim_id';
    throw err;
  }

  await expireStaleClaims(sb);

  const { data: claim, error } = await sb
    .from('attendance_claims')
    .select(
      '*, events ( id, title, slug, starts_at, ends_at, image_url, organiser_id ), organisers ( id, name, slug, photo_url, contact_email, email ), attendees ( id, name, email, public_review_name )'
    )
    .eq('id', claimId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!claim?.id) {
    const err = new Error('claim_not_found');
    err.code = 'claim_not_found';
    throw err;
  }

  if (organiserIdFromToken && String(claim.organiser_id) !== organiserIdFromToken) {
    const err = new Error('invalid_or_expired_token');
    err.code = 'invalid_or_expired_token';
    throw err;
  }

  // Session-based respond: must own the organiser group.
  if (options?.session && !options?.token) {
    const access = await resolveOrganiserAccess(options.session);
    const allowed = new Set(access.groupIds || []);
    if (!allowed.has(String(claim.organiser_id))) {
      const err = new Error('not_allowed');
      err.code = 'not_allowed';
      throw err;
    }
  }

  if (claim.status === 'confirmed' || claim.status === 'denied') {
    return { claim: mapClaimRow(claim), alreadyResponded: true };
  }
  if (claim.status === 'expired' || claim.status === 'cancelled') {
    const err = new Error('claim_not_pending');
    err.code = 'claim_not_pending';
    throw err;
  }
  if (claim.expires_at && claim.expires_at < new Date().toISOString()) {
    await sb
      .from('attendance_claims')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', claim.id);
    const err = new Error('claim_expired');
    err.code = 'claim_expired';
    throw err;
  }

  const nowIso = new Date().toISOString();
  const patch = {
    status: confirm ? 'confirmed' : 'denied',
    responded_at: nowIso,
    updated_at: nowIso,
    responded_by_user_id: options?.session?.userId || options?.session?.sub || null,
  };
  if (confirm) {
    patch.review_unlocked_until = daysFromNow(REVIEW_UNLOCK_DAYS).toISOString();
  }

  const { data: updated, error: upErr } = await sb
    .from('attendance_claims')
    .update(patch)
    .eq('id', claim.id)
    .eq('status', 'pending')
    .select(
      '*, events ( id, title, slug, starts_at, ends_at, image_url ), organisers ( id, name, slug, photo_url ), attendees ( id, name, email, public_review_name )'
    )
    .maybeSingle();
  if (upErr) throw new Error(upErr.message);
  if (!updated?.id) {
    const err = new Error('claim_not_pending');
    err.code = 'claim_not_pending';
    throw err;
  }

  if (confirm) {
    try {
      await sendClaimConfirmedReviewEmail(
        updated,
        updated.events || claim.events,
        updated.attendees || claim.attendees,
        updated.organisers || claim.organisers
      );
      await sb
        .from('attendance_claims')
        .update({
          attendee_review_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', updated.id);
    } catch {
      // Non-fatal: unlock still stands; attendee can review from dashboard.
    }
  }

  return { claim: mapClaimRow(updated), alreadyResponded: false };
}

async function listClaimsForAttendee(session) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];
  await expireStaleClaims(sb);
  const { data, error } = await sb
    .from('attendance_claims')
    .select(
      '*, events ( id, title, slug, starts_at, ends_at, image_url ), organisers ( id, name, slug, photo_url )'
    )
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (/attendance_claims|relation|does not exist/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }
  return (data || []).map(mapClaimRow);
}

async function listPendingClaimsForOrganiser(session) {
  if (!isSupabaseConfigured()) return [];
  const access = await resolveOrganiserAccess(session);
  const ids = access.groupIds || [];
  if (!ids.length && !access.isAdmin) return [];
  const sb = getSupabaseAdmin();
  await expireStaleClaims(sb);
  let query = sb
    .from('attendance_claims')
    .select(
      '*, events ( id, title, slug, starts_at, ends_at, image_url ), organisers ( id, name, slug, photo_url ), attendees ( id, name, email, public_review_name )'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!access.isAdmin) {
    if (ids.length === 1) query = query.eq('organiser_id', ids[0]);
    else query = query.in('organiser_id', ids);
  }
  const { data, error } = await query;
  if (error) {
    if (/attendance_claims|relation|does not exist/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }
  return (data || []).map(mapClaimRow);
}

function mapClaimOrganiserRow(row, matchHint) {
  return {
    id: row.id,
    name: String(row.name || '').trim(),
    slug: row.slug || null,
    logo: String(row.photo_url || '').trim() || null,
    matchHint: matchHint || null,
  };
}

async function searchClaimableOrganisers(session, input) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();

  const q = String(input?.q || '')
    .trim()
    .toLowerCase()
    .replace(/[%_,.()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (q.length < 2) return [];

  const { applyPublicOrganiserBrowseFilter, isPublicOrganiser } = require('./supabase-organisers-browse');
  const byId = new Map();

  // 1) Match organiser / group name (and slug).
  let nameQuery = sb
    .from('organisers')
    .select('id, name, slug, photo_url, listing_status, verification_status')
    .order('name', { ascending: true })
    .limit(40);
  nameQuery = applyPublicOrganiserBrowseFilter(nameQuery);
  nameQuery = nameQuery.ilike('name', `%${q}%`);
  const nameRes = await nameQuery;
  if (nameRes.error) throw new Error(nameRes.error.message);
  (nameRes.data || []).forEach((row) => {
    if (!row?.id || !String(row.name || '').trim()) return;
    byId.set(row.id, mapClaimOrganiserRow(row, 'Group name match'));
  });

  // 2) Match past published event titles → surface that event's organiser.
  //    People often type the event name (e.g. "The Networker Hub Example"), not the group name.
  const nowIso = new Date().toISOString();
  const oldest = addDaysIso(null, -CLAIM_WINDOW_DAYS);
  const eventRes = await sb
    .from('events')
    .select(
      'id, title, organiser_id, starts_at, organisers ( id, name, slug, photo_url, listing_status, verification_status )'
    )
    .eq('status', 'published')
    .not('organiser_id', 'is', null)
    .lt('starts_at', nowIso)
    .gte('starts_at', oldest)
    .ilike('title', `%${q}%`)
    .order('starts_at', { ascending: false })
    .limit(40);
  if (eventRes.error) throw new Error(eventRes.error.message);

  (eventRes.data || []).forEach((ev) => {
    const org = ev.organisers;
    const oid = ev.organiser_id || org?.id;
    if (!oid || byId.has(oid)) return;
    if (org?.id) {
      if (!isPublicOrganiser(org) && String(org.listing_status || '').toLowerCase() !== 'published') {
        // Still allow if they have a published past event matching the search.
      }
      const title = String(ev.title || '').trim();
      byId.set(oid, mapClaimOrganiserRow(org, title ? `Event: ${title}` : 'Past event match'));
      return;
    }
  });

  // Fetch any organiser ids we only know from events without nested join.
  const missingIds = (eventRes.data || [])
    .map((ev) => ev.organiser_id)
    .filter((id) => id && !byId.has(id));
  if (missingIds.length) {
    const unique = [...new Set(missingIds)].slice(0, 20);
    const orgRes = await sb
      .from('organisers')
      .select('id, name, slug, photo_url, listing_status, verification_status')
      .in('id', unique);
    if (orgRes.error) throw new Error(orgRes.error.message);
    (orgRes.data || []).forEach((row) => {
      if (!row?.id || byId.has(row.id)) return;
      const sample = (eventRes.data || []).find((ev) => ev.organiser_id === row.id);
      const title = String(sample?.title || '').trim();
      byId.set(row.id, mapClaimOrganiserRow(row, title ? `Event: ${title}` : 'Past event match'));
    });
  }

  return [...byId.values()]
    .filter((row) => row.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20);
}

async function searchClaimablePastEvents(session, input) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return [];

  const organiserId = String(input?.organiserId || input?.organiser_id || '').trim();
  const q = String(input?.q || '')
    .trim()
    .toLowerCase();
  // Group-first: require an organiser before listing events.
  if (!isUuid(organiserId)) return [];

  const nowIso = new Date().toISOString();
  const oldest = addDaysIso(null, -CLAIM_WINDOW_DAYS);

  let query = sb
    .from('events')
    .select(
      'id, title, slug, starts_at, ends_at, image_url, status, organiser_id, organisers ( id, name, slug, photo_url )'
    )
    .eq('status', 'published')
    .eq('organiser_id', organiserId)
    .lt('starts_at', nowIso)
    .gte('starts_at', oldest)
    .order('starts_at', { ascending: false })
    .limit(60);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = data || [];
  if (q) {
    rows = rows.filter((row) => {
      const title = String(row.title || '').toLowerCase();
      return title.includes(q);
    });
  }

  // Exclude events already claimed/reviewed or with eligible registration.
  const eventIds = rows.map((r) => r.id);
  if (!eventIds.length) return [];

  const [claimsRes, reviewsRes, regsRes] = await Promise.all([
    sb
      .from('attendance_claims')
      .select('event_id, status')
      .eq('attendee_id', attendeeId)
      .in('event_id', eventIds)
      .in('status', ['pending', 'confirmed']),
    sb.from('reviews').select('event_id').eq('attendee_id', attendeeId).in('event_id', eventIds),
    sb
      .from('registrations')
      .select('event_id, payment_status, application_status, no_show_at')
      .eq('attendee_id', attendeeId)
      .in('event_id', eventIds)
      .neq('payment_status', 'Refunded'),
  ]);

  const blocked = new Set();
  (claimsRes.data || []).forEach((c) => blocked.add(c.event_id));
  (reviewsRes.data || []).forEach((r) => blocked.add(r.event_id));
  (regsRes.data || []).forEach((r) => {
    if (isEligibleRegistration(r)) blocked.add(r.event_id);
  });

  return rows
    .filter((row) => !blocked.has(row.id) && eventHasEnded(row))
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      title: String(row.title || 'Event').trim(),
      slug: row.slug || null,
      date: row.starts_at || null,
      imageUrl: String(row.image_url || '').trim() || null,
      organiserId: row.organiser_id,
      organiserName: String(row.organisers?.name || '').trim(),
      organiserSlug: row.organisers?.slug || null,
      organiserLogo: String(row.organisers?.photo_url || '').trim() || null,
    }));
}

async function computeNetworkedScoreForAttendee(sb, attendeeId) {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const [regsRes, claimsRes] = await Promise.all([
    sb
      .from('registrations')
      .select(
        'id, event_id, payment_status, application_status, no_show_at, cancelled_at, events ( id, starts_at, ends_at, organiser_id )'
      )
      .eq('attendee_id', attendeeId)
      .in('payment_status', ['Paid', 'Free'])
      .is('cancelled_at', null)
      .is('no_show_at', null),
    sb
      .from('attendance_claims')
      .select('id, organiser_id, event_id, status, responded_at, claimed_at')
      .eq('attendee_id', attendeeId)
      .eq('status', 'confirmed')
      .gte('responded_at', periodStart),
  ]);

  const verifiedOrgs = new Set();
  let verifiedCount = 0;
  (regsRes.data || []).forEach((row) => {
    if (!isEligibleRegistration(row)) return;
    if (!eventHasEnded(row.events)) return;
    const startMs = new Date(row.events?.starts_at || row.events?.ends_at || 0).getTime();
    if (!Number.isFinite(startMs) || startMs < new Date(periodStart).getTime()) return;
    verifiedCount += 1;
    if (row.events?.organiser_id) verifiedOrgs.add(row.events.organiser_id);
  });

  let confirmedCount = 0;
  const confirmedOrgs = new Set();
  (claimsRes.data || []).forEach((row) => {
    confirmedCount += 1;
    if (row.organiser_id) confirmedOrgs.add(row.organiser_id);
  });

  const distinctOrganisers = new Set([...verifiedOrgs, ...confirmedOrgs]).size;
  const score = Number((verifiedCount + ORGANISER_CONFIRMED_WEIGHT * confirmedCount).toFixed(2));

  return {
    periodLabel,
    verifiedCount,
    confirmedCount,
    score,
    distinctOrganisers,
    nominationMin: NETWORKED_NOMINATION_MIN,
    nominated: score >= NETWORKED_NOMINATION_MIN,
  };
}

async function loadWeightedReviewStatsByOrganiser(sb, organiserIds) {
  const ids = (organiserIds || []).filter(Boolean);
  const out = new Map();
  if (!ids.length) return out;

  const chunkSize = 80;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    let { data, error } = await sb
      .from('reviews')
      .select('organiser_id, rating, provenance')
      .in('organiser_id', chunk);
    if (error && /provenance|column/i.test(error.message || '')) {
      const retry = await sb.from('reviews').select('organiser_id, rating').in('organiser_id', chunk);
      data = (retry.data || []).map((r) => ({ ...r, provenance: 'verified' }));
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const byOrg = new Map();
    (data || []).forEach((row) => {
      const oid = row.organiser_id;
      if (!byOrg.has(oid)) byOrg.set(oid, []);
      byOrg.get(oid).push(row);
    });
    byOrg.forEach((reviews, oid) => {
      out.set(oid, computeWeightedReviewStats(reviews));
    });
  }
  return out;
}

module.exports = {
  CLAIM_WINDOW_DAYS,
  RESPONSE_TTL_DAYS,
  REVIEW_UNLOCK_DAYS,
  MAX_OPEN_CLAIMS,
  MAX_CLAIMS_PER_30_DAYS,
  ORGANISER_CONFIRMED_WEIGHT,
  MAX_ORGANISER_CONFIRMED_SHARE,
  NETWORKED_NOMINATION_MIN,
  provenanceWeight,
  computeWeightedReviewStats,
  findConfirmedClaimForReview,
  createAttendanceClaim,
  respondToAttendanceClaim,
  listClaimsForAttendee,
  listPendingClaimsForOrganiser,
  searchClaimablePastEvents,
  searchClaimableOrganisers,
  computeNetworkedScoreForAttendee,
  loadWeightedReviewStatsByOrganiser,
  mapClaimRow,
  expireStaleClaims,
};
