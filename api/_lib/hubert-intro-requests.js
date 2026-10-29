/**
 * Hubert Matchmaker intro requests — double opt-in, no contact share.
 */
const { createHubertIntroToken, verifyHubertIntroToken, DEFAULT_TTL_DAYS } = require('./hubert-intro-token');
const { isUuid } = require('./uuid');

const INTROS_PER_WEEK = 5;
const TOPIC_MIN_LEN = 25;
const RESPONSE_TTL_DAYS = DEFAULT_TTL_DAYS;
const GENERIC_TOPICS = new Set(['hi', 'hello', 'hey', 'networking', 'sales', 'connect', 'connection', 'meet']);

function getSupabaseAdmin() {
  return require('./supabase').getSupabaseAdmin();
}

function isSupabaseConfigured() {
  return require('./supabase').isSupabaseConfigured();
}

function resolveAttendeeId(...args) {
  return require('./attendee-id').resolveAttendeeId(...args);
}

function sendTemplatedEmail(...args) {
  return require('./send-template-email').sendTemplatedEmail(...args);
}

function siteBase() {
  return require('./hub-email-urls').emailSiteBase(process.env.SITE_URL);
}

function daysFromNow(days) {
  return new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
}

function weekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function shortDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'a Networker';
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
}

function firstName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || 'there';
}

function normalizeTopic(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateTopic(topic) {
  const t = normalizeTopic(topic);
  if (t.length < TOPIC_MIN_LEN) {
    const err = new Error('topic_too_short');
    err.code = 'topic_too_short';
    err.message = 'Say a bit more about what you’d like to discuss (at least 25 characters).';
    throw err;
  }
  const lower = t.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (GENERIC_TOPICS.has(lower)) {
    const err = new Error('topic_too_generic');
    err.code = 'topic_too_generic';
    err.message = 'Add a clearer topic — something more specific than a one-word ask.';
    throw err;
  }
  return t;
}

function parseTargetId(raw) {
  const id = String(raw || '').trim();
  const m = /^(member|seed):([0-9a-f-]{36})$/i.exec(id);
  if (!m) return null;
  return { kind: m[1].toLowerCase(), uuid: m[2].toLowerCase() };
}

async function expireStaleIntros(sb) {
  const now = new Date().toISOString();
  await sb
    .from('hubert_intro_requests')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'pending')
    .lt('expires_at', now);
}

async function assertIntroQuota(sb, requesterAttendeeId) {
  const { count, error } = await sb
    .from('hubert_intro_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requester_attendee_id', requesterAttendeeId)
    .gte('created_at', weekAgoIso())
    .neq('status', 'blocked');
  if (error) throw new Error(error.message);
  if ((count || 0) >= INTROS_PER_WEEK) {
    const err = new Error('intro_quota_exceeded');
    err.code = 'intro_quota_exceeded';
    err.message = 'You’ve used this week’s intro requests (5). Try again next week.';
    throw err;
  }
}

async function loadTarget(sb, target) {
  if (target.kind === 'member') {
    const { data, error } = await sb
      .from('attendees')
      .select('id, name, email, company, job_title, discoverable_at')
      .eq('id', target.uuid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const err = new Error('target_not_found');
      err.code = 'target_not_found';
      throw err;
    }
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      const err = new Error('target_email_missing');
      err.code = 'target_email_missing';
      throw err;
    }
    return {
      kind: 'member',
      attendeeId: data.id,
      seedId: null,
      email,
      fullName: data.name || 'Member',
      role: data.job_title || '',
      company: data.company || '',
      displayName: shortDisplayName(data.name),
    };
  }

  const { data, error } = await sb
    .from('hubert_match_seed')
    .select('id, full_name, email, company, job_title, status')
    .eq('id', target.uuid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== 'active') {
    const err = new Error('target_not_found');
    err.code = 'target_not_found';
    throw err;
  }
  const email = String(data.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    const err = new Error('target_email_missing');
    err.code = 'target_email_missing';
    throw err;
  }
  return {
    kind: 'seed',
    attendeeId: null,
    seedId: data.id,
    email,
    fullName: data.full_name || 'Contact',
    role: data.job_title || '',
    company: data.company || '',
    displayName: shortDisplayName(data.full_name),
  };
}

async function loadRequester(sb, attendeeId) {
  const { data, error } = await sb
    .from('attendees')
    .select('id, name, email, company, job_title')
    .eq('id', attendeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('attendee_not_found');
    err.code = 'attendee_not_found';
    throw err;
  }
  return data;
}

function publicIntroCard(row, opts) {
  const requesterName = shortDisplayName(row.requester?.name || row.requester_name);
  const counterpartName =
    row.target_display_name ||
    shortDisplayName(row.target?.name || row.target?.full_name || row.target_name);
  return {
    id: row.id,
    status: row.status,
    topic: row.topic,
    source: row.source,
    createdAt: row.created_at,
    emailedAt: row.emailed_at || null,
    respondedAt: row.responded_at || null,
    acceptedAt: row.accepted_at || null,
    eventTitle: row.event_title || null,
    eventId: row.event_id || null,
    direction: opts?.direction || null,
    requesterDisplayName: requesterName,
    counterpartDisplayName: counterpartName,
    threadOpened: Boolean(row.thread_opened_at),
  };
}

async function sendIntroRequestEmail(intro, requester, target) {
  const siteUrl = siteBase();
  const token = createHubertIntroToken({ introId: intro.id });
  const acceptUrl =
    siteUrl +
    '/account/hubert-intro.html?token=' +
    encodeURIComponent(token) +
    '&decision=accept';
  const declineUrl =
    siteUrl +
    '/account/hubert-intro.html?token=' +
    encodeURIComponent(token) +
    '&decision=decline';
  const eventContext = intro.event_title
    ? 'They mentioned you may both be around ' + intro.event_title + '.'
    : '';

  await sendTemplatedEmail({
    slug: 'hubert_intro_request',
    to: target.email,
    variables: {
      user_name: firstName(target.fullName),
      requester_name: shortDisplayName(requester.name),
      topic: intro.topic,
      event_context: eventContext,
      accept_url: acceptUrl,
      decline_url: declineUrl,
      dashboard_url: siteUrl + '/account/#meet',
    },
  });
}

async function sendIntroAcceptedEmail(intro, requester, counterpartDisplayName) {
  const to = String(requester?.email || '')
    .trim()
    .toLowerCase();
  if (!to) return;
  const siteUrl = siteBase();
  await sendTemplatedEmail({
    slug: 'hubert_intro_accepted',
    to,
    variables: {
      user_name: firstName(requester.name),
      counterpart_name: counterpartDisplayName,
      topic: intro.topic,
      thread_url: siteUrl + '/account/#meet?intro=' + encodeURIComponent(intro.id),
      dashboard_url: siteUrl + '/account/#meet',
    },
  });
}

async function openThread(sb, intro, requester, target) {
  const now = new Date().toISOString();
  const aName = shortDisplayName(requester.name);
  const bName = target.displayName;
  const eventBit = intro.event_title ? ' Shared context: ' + intro.event_title + '.' : '';
  const opener =
    'I’ve introduced ' +
    aName +
    ' and ' +
    bName +
    '. Topic: “' +
    intro.topic +
    '”.' +
    eventBit +
    ' Contact details stay private — continue here on the Hub.';

  await sb.from('hubert_intro_messages').insert({
    intro_request_id: intro.id,
    sender_attendee_id: null,
    sender_kind: 'hubert',
    body: opener,
  });

  await sb
    .from('hubert_intro_requests')
    .update({ thread_opened_at: now, updated_at: now })
    .eq('id', intro.id);
}

async function createIntroRequest(session, input) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    const err = new Error('attendee_not_found');
    err.code = 'attendee_not_found';
    throw err;
  }

  const topic = validateTopic(input?.topic || input?.message || '');
  const target = parseTargetId(input?.targetId || input?.target_id || input?.matchId);
  if (!target || !isUuid(target.uuid)) {
    const err = new Error('invalid_target');
    err.code = 'invalid_target';
    throw err;
  }

  if (target.kind === 'member' && target.uuid === attendeeId) {
    const err = new Error('cannot_intro_self');
    err.code = 'cannot_intro_self';
    throw err;
  }

  await expireStaleIntros(sb);
  await assertIntroQuota(sb, attendeeId);

  const requester = await loadRequester(sb, attendeeId);
  const loadedTarget = await loadTarget(sb, target);

  let openQ = sb
    .from('hubert_intro_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requester_attendee_id', attendeeId)
    .eq('status', 'pending');
  if (loadedTarget.kind === 'member') {
    openQ = openQ.eq('target_attendee_id', loadedTarget.attendeeId);
  } else {
    openQ = openQ.eq('target_seed_id', loadedTarget.seedId);
  }
  const { count: openCount, error: openErr } = await openQ;
  if (openErr) throw new Error(openErr.message);
  if ((openCount || 0) > 0) {
    const err = new Error('intro_already_pending');
    err.code = 'intro_already_pending';
    err.message = 'You already have a pending intro with this person.';
    throw err;
  }

  const source = String(input?.source || 'search')
    .trim()
    .toLowerCase();
  const allowedSource = ['search', 'nominate', 'overview', 'staff'].includes(source) ? source : 'search';
  const eventId = isUuid(input?.eventId || input?.event_id) ? String(input.eventId || input.event_id) : null;
  const eventTitle = String(input?.eventTitle || input?.event_title || '')
    .trim()
    .slice(0, 200) || null;

  const expiresAt = daysFromNow(RESPONSE_TTL_DAYS).toISOString();
  const ins = await sb
    .from('hubert_intro_requests')
    .insert({
      requester_attendee_id: attendeeId,
      target_attendee_id: loadedTarget.attendeeId,
      target_seed_id: loadedTarget.seedId,
      target_email: loadedTarget.email,
      status: 'pending',
      topic,
      source: allowedSource,
      event_id: eventId,
      event_title: eventTitle,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (ins.error) throw new Error(ins.error.message);

  const intro = ins.data;
  try {
    await sendIntroRequestEmail(intro, requester, loadedTarget);
    await sb
      .from('hubert_intro_requests')
      .update({ emailed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', intro.id);
  } catch (emailErr) {
    await sb.from('hubert_intro_requests').delete().eq('id', intro.id);
    const err = new Error(emailErr.message || 'intro_email_failed');
    err.code = 'intro_email_failed';
    throw err;
  }

  return publicIntroCard(
    {
      ...intro,
      emailed_at: new Date().toISOString(),
      requester: requester,
      target_display_name: loadedTarget.displayName,
    },
    { direction: 'outbound' }
  );
}

async function loadIntroById(sb, introId) {
  const { data, error } = await sb.from('hubert_intro_requests').select('*').eq('id', introId).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function previewIntroFromToken(token) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const payload = verifyHubertIntroToken(token);
  if (!payload) {
    const err = new Error('invalid_or_expired_token');
    err.code = 'invalid_or_expired_token';
    throw err;
  }
  const sb = getSupabaseAdmin();
  await expireStaleIntros(sb);
  const intro = await loadIntroById(sb, payload.introId);
  if (!intro) {
    const err = new Error('intro_not_found');
    err.code = 'intro_not_found';
    throw err;
  }
  const requester = await loadRequester(sb, intro.requester_attendee_id);
  return {
    id: intro.id,
    status: intro.status,
    topic: intro.topic,
    eventTitle: intro.event_title || null,
    requesterDisplayName: shortDisplayName(requester.name),
    expiresAt: intro.expires_at,
  };
}

async function respondToIntro(options) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const decision = String(options?.decision || '')
    .trim()
    .toLowerCase();
  const accept =
    decision === 'accept' || decision === 'yes' || decision === 'confirm';
  const decline =
    decision === 'decline' || decision === 'no' || decision === 'deny';
  if (!accept && !decline) {
    const err = new Error('invalid_decision');
    err.code = 'invalid_decision';
    throw err;
  }

  let introId = String(options?.introId || options?.intro_id || '').trim();
  if (options?.token) {
    const payload = verifyHubertIntroToken(options.token);
    if (!payload) {
      const err = new Error('invalid_or_expired_token');
      err.code = 'invalid_or_expired_token';
      throw err;
    }
    introId = payload.introId;
  }
  if (!isUuid(introId)) {
    const err = new Error('missing_intro_id');
    err.code = 'missing_intro_id';
    throw err;
  }

  await expireStaleIntros(sb);
  const intro = await loadIntroById(sb, introId);
  if (!intro) {
    const err = new Error('intro_not_found');
    err.code = 'intro_not_found';
    throw err;
  }

  if (intro.status === 'accepted' || intro.status === 'declined') {
    return {
      alreadyResponded: true,
      intro: publicIntroCard(intro, { direction: 'inbound' }),
    };
  }
  if (intro.status !== 'pending') {
    const err = new Error('intro_not_pending');
    err.code = 'intro_not_pending';
    throw err;
  }

  // Optional session check: if logged in as a member target, must match.
  if (options?.session) {
    const sessionAttendeeId = await resolveAttendeeId(sb, options.session);
    if (intro.target_attendee_id && sessionAttendeeId && sessionAttendeeId !== intro.target_attendee_id) {
      // Allow token-only path even if someone else is logged in; prefer match when both present.
      if (!options.token) {
        const err = new Error('forbidden');
        err.code = 'forbidden';
        throw err;
      }
    }
  }

  const now = new Date().toISOString();
  const requester = await loadRequester(sb, intro.requester_attendee_id);

  let targetDisplay = 'them';
  let targetForThread = {
    displayName: 'them',
    attendeeId: intro.target_attendee_id,
    seedId: intro.target_seed_id,
  };

  if (intro.target_attendee_id) {
    const t = await loadRequester(sb, intro.target_attendee_id);
    targetDisplay = shortDisplayName(t.name);
    targetForThread = { displayName: targetDisplay, attendeeId: t.id, seedId: null };
  } else if (intro.target_seed_id) {
    const { data: seed } = await sb
      .from('hubert_match_seed')
      .select('id, full_name, status')
      .eq('id', intro.target_seed_id)
      .maybeSingle();
    targetDisplay = shortDisplayName(seed?.full_name);
    targetForThread = { displayName: targetDisplay, attendeeId: null, seedId: seed?.id || null };
  }

  if (decline) {
    const { data: updated, error } = await sb
      .from('hubert_intro_requests')
      .update({
        status: 'declined',
        responded_at: now,
        updated_at: now,
        decline_reason: String(options?.reason || '').trim().slice(0, 200) || null,
      })
      .eq('id', intro.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      alreadyResponded: false,
      intro: publicIntroCard(updated || { ...intro, status: 'declined', responded_at: now }, {
        direction: 'inbound',
      }),
    };
  }

  const { data: updated, error } = await sb
    .from('hubert_intro_requests')
    .update({
      status: 'accepted',
      responded_at: now,
      accepted_at: now,
      updated_at: now,
    })
    .eq('id', intro.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);

  const accepted = updated || { ...intro, status: 'accepted', responded_at: now, accepted_at: now };

  if (intro.target_seed_id) {
    await sb
      .from('hubert_match_seed')
      .update({
        status: 'converted',
        updated_at: now,
        pause_reason: null,
      })
      .eq('id', intro.target_seed_id)
      .eq('status', 'active');
  }

  await openThread(sb, accepted, requester, targetForThread);
  try {
    await sendIntroAcceptedEmail(accepted, requester, targetDisplay);
  } catch (e) {
    console.error('[hubert-intro] accepted email failed', e && e.message ? e.message : e);
  }

  return {
    alreadyResponded: false,
    intro: publicIntroCard(
      { ...accepted, thread_opened_at: now, target_display_name: targetDisplay },
      { direction: 'inbound' }
    ),
  };
}

async function listIntrosForSession(session) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) return { outbound: [], inbound: [] };

  await expireStaleIntros(sb);

  const { data: outboundRows, error: outErr } = await sb
    .from('hubert_intro_requests')
    .select('*')
    .eq('requester_attendee_id', attendeeId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (outErr) throw new Error(outErr.message);

  const { data: inboundRows, error: inErr } = await sb
    .from('hubert_intro_requests')
    .select('*')
    .eq('target_attendee_id', attendeeId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (inErr) throw new Error(inErr.message);

  const outbound = [];
  for (const row of outboundRows || []) {
    let counterpart = 'Someone';
    if (row.target_attendee_id) {
      const t = await loadRequester(sb, row.target_attendee_id).catch(() => null);
      counterpart = shortDisplayName(t?.name);
    } else if (row.target_seed_id) {
      const { data: seed } = await sb
        .from('hubert_match_seed')
        .select('full_name')
        .eq('id', row.target_seed_id)
        .maybeSingle();
      counterpart = shortDisplayName(seed?.full_name);
    }
    outbound.push(
      publicIntroCard({ ...row, target_display_name: counterpart }, { direction: 'outbound' })
    );
  }

  const inbound = [];
  for (const row of inboundRows || []) {
    const r = await loadRequester(sb, row.requester_attendee_id).catch(() => null);
    inbound.push(
      publicIntroCard(
        { ...row, requester: r, target_display_name: shortDisplayName(r?.name) },
        { direction: 'inbound' }
      )
    );
  }

  return { outbound, inbound };
}

async function assertCanAccessThread(sb, intro, attendeeId) {
  if (!attendeeId) {
    const err = new Error('forbidden');
    err.code = 'forbidden';
    throw err;
  }
  if (intro.requester_attendee_id === attendeeId) return 'requester';
  if (intro.target_attendee_id && intro.target_attendee_id === attendeeId) return 'target';
  const err = new Error('forbidden');
  err.code = 'forbidden';
  throw err;
}

async function getIntroThread(session, introId) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!isUuid(introId)) {
    const err = new Error('missing_intro_id');
    err.code = 'missing_intro_id';
    throw err;
  }
  const intro = await loadIntroById(sb, introId);
  if (!intro) {
    const err = new Error('intro_not_found');
    err.code = 'intro_not_found';
    throw err;
  }
  if (intro.status !== 'accepted') {
    const err = new Error('thread_not_open');
    err.code = 'thread_not_open';
    throw err;
  }
  await assertCanAccessThread(sb, intro, attendeeId);

  const { data: messages, error } = await sb
    .from('hubert_intro_messages')
    .select('id, created_at, sender_attendee_id, sender_kind, body')
    .eq('intro_request_id', intro.id)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  return {
    intro: publicIntroCard(intro, {
      direction: intro.requester_attendee_id === attendeeId ? 'outbound' : 'inbound',
    }),
    messages: (messages || []).map((m) => ({
      id: m.id,
      createdAt: m.created_at,
      senderKind: m.sender_kind,
      mine: m.sender_attendee_id === attendeeId,
      body: m.body,
    })),
  };
}

async function postIntroMessage(session, introId, bodyRaw) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  const body = String(bodyRaw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (body.length < 1 || body.length > 1000) {
    const err = new Error('invalid_message');
    err.code = 'invalid_message';
    throw err;
  }
  // Soft block obvious contact dumps
  if (/@|linkedin\.com|whatsapp|\+?\d[\d\s()-]{7,}/i.test(body)) {
    const err = new Error('no_contact_details');
    err.code = 'no_contact_details';
    err.message = 'Keep contact details off this thread — Hubert keeps intros on the Hub.';
    throw err;
  }

  const intro = await loadIntroById(sb, introId);
  if (!intro || intro.status !== 'accepted') {
    const err = new Error('thread_not_open');
    err.code = 'thread_not_open';
    throw err;
  }
  await assertCanAccessThread(sb, intro, attendeeId);

  const { data, error } = await sb
    .from('hubert_intro_messages')
    .insert({
      intro_request_id: intro.id,
      sender_attendee_id: attendeeId,
      sender_kind: 'member',
      body,
    })
    .select('id, created_at, sender_attendee_id, sender_kind, body')
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    createdAt: data.created_at,
    senderKind: data.sender_kind,
    mine: true,
    body: data.body,
  };
}

module.exports = {
  INTROS_PER_WEEK,
  TOPIC_MIN_LEN,
  validateTopic,
  parseTargetId,
  shortDisplayName,
  createIntroRequest,
  previewIntroFromToken,
  respondToIntro,
  listIntrosForSession,
  getIntroThread,
  postIntroMessage,
};
