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

/** Job title · company for email / cards (empty if neither set). */
function formatTitleCompany(jobTitle, company) {
  const title = String(jobTitle || '')
    .trim()
    .replace(/\s+/g, ' ');
  const co = String(company || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (title && co) return title + ' · ' + co;
  return title || co || '';
}

/**
 * e.g. "Catherine H. (Founder · Acme)" — privacy-safe short name + role line.
 */
function requesterEmailLabel(requester) {
  const name = shortDisplayName(requester && requester.name);
  const role = formatTitleCompany(
    requester && (requester.job_title || requester.jobTitle),
    requester && requester.company
  );
  return role ? name + ' (' + role + ')' : name;
}

/**
 * Shortlist / pending: first name + initial.
 * After both agree (accepted): first name only.
 */
function introDisplayName(fullName, status) {
  if (String(status || '') === 'accepted') return firstName(fullName);
  return shortDisplayName(fullName);
}

/** Soft member-facing status — never “declined”. */
function softIntroStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'accepted') return { key: 'connected', label: 'Connected' };
  if (s === 'pending') return { key: 'waiting', label: 'Waiting to hear back' };
  if (s === 'declined' || s === 'expired' || s === 'blocked') {
    return { key: 'closed', label: 'Didn’t come through' };
  }
  return { key: s || 'unknown', label: s || '' };
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

function isMissingIntroTableError(error) {
  const msg = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
  const code = String((error && error.code) || '');
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes("could not find the table 'public.hubert_intro_requests'") ||
    (msg.includes('hubert_intro_requests') && msg.includes('schema cache')) ||
    (msg.includes('relation') && msg.includes('hubert_intro_requests') && msg.includes('does not exist'))
  );
}

function missingIntroTableError() {
  const err = new Error(
    'Intro requests aren’t set up yet. Run migration 335_hubert_intro_requests.sql, then 337_reload_postgrest_schema_matchmaker.sql (or NOTIFY pgrst, \'reload schema\'), and try again.'
  );
  err.code = 'intro_migration_required';
  err.status = 503;
  return err;
}

async function expireStaleIntros(sb) {
  const now = new Date().toISOString();
  const { error } = await sb
    .from('hubert_intro_requests')
    .update({ status: 'expired', updated_at: now })
    .eq('status', 'pending')
    .lt('expires_at', now);
  if (error && isMissingIntroTableError(error)) throw missingIntroTableError();
}

async function assertIntroQuota(sb, requesterAttendeeId) {
  const { count, error } = await sb
    .from('hubert_intro_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requester_attendee_id', requesterAttendeeId)
    .gte('created_at', weekAgoIso())
    .neq('status', 'blocked');
  if (error) {
    if (isMissingIntroTableError(error)) throw missingIntroTableError();
    throw new Error(error.message);
  }
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
    .select('id, name, email, company, job_title, matchmaker_blurb')
    .eq('id', attendeeId)
    .maybeSingle();
  if (error) {
    // Older DBs may lack matchmaker_blurb — fall back without it.
    const msg = String((error && error.message) || '').toLowerCase();
    if (msg.includes('matchmaker_blurb') || error.code === 'PGRST204') {
      const retry = await sb
        .from('attendees')
        .select('id, name, email, company, job_title')
        .eq('id', attendeeId)
        .maybeSingle();
      if (retry.error) throw new Error(retry.error.message);
      if (!retry.data) {
        const err = new Error('attendee_not_found');
        err.code = 'attendee_not_found';
        throw err;
      }
      return retry.data;
    }
    throw new Error(error.message);
  }
  if (!data) {
    const err = new Error('attendee_not_found');
    err.code = 'attendee_not_found';
    throw err;
  }
  return data;
}

function publicIntroCard(row, opts) {
  const status = row.status;
  const soft = softIntroStatus(status);
  const requesterRaw = row.requester?.name || row.requester_name || '';
  const counterpartRaw =
    row.target_full_name ||
    row.target?.name ||
    row.target?.full_name ||
    row.target_name ||
    '';
  const requesterName = introDisplayName(requesterRaw, status);
  const counterpartName = row.target_display_name
    ? String(row.target_display_name)
    : introDisplayName(counterpartRaw, status);
  // Name shown to the signed-in member for this row.
  const otherName =
    opts?.direction === 'inbound'
      ? requesterName
      : counterpartName || introDisplayName(counterpartRaw, status);
  return {
    id: row.id,
    status,
    statusKey: soft.key,
    statusLabel: soft.label,
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
    displayName: otherName,
    connected: status === 'accepted',
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
  const shortName = shortDisplayName(requester.name);
  const titleCompany = formatTitleCompany(requester.job_title, requester.company);
  const requesterLabel = requesterEmailLabel(requester);
  const blurb = String(requester.matchmaker_blurb || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 420);
  const aboutBits = [];
  if (titleCompany) {
    aboutBits.push(shortName + ' is ' + titleCompany + '.');
  }
  if (blurb) aboutBits.push(blurb);
  const requester_about = aboutBits.length
    ? aboutBits.join(' ')
    : shortName + ' is a member on The Networker UK.';
  const eventContext = intro.event_title
    ? 'They mentioned you may both be around ' + intro.event_title + '.'
    : '';

  await sendTemplatedEmail({
    slug: 'hubert_intro_request',
    to: target.email,
    variables: {
      user_name: firstName(target.fullName),
      requester_name: shortName,
      requester_title_company: titleCompany,
      requester_label: requesterLabel,
      requester_about: requester_about,
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
  // Both have agreed — first names only from here.
  const aName = firstName(requester.name);
  const bName = firstName(target.fullName || target.displayName);
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
  if (openErr) {
    if (isMissingIntroTableError(openErr)) throw missingIntroTableError();
    throw new Error(openErr.message);
  }
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
  if (ins.error) {
    if (isMissingIntroTableError(ins.error)) throw missingIntroTableError();
    throw new Error(ins.error.message);
  }

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
  if (error) {
    if (isMissingIntroTableError(error)) throw missingIntroTableError();
    throw new Error(error.message);
  }
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
  const titleCompany = formatTitleCompany(requester.job_title, requester.company);
  return {
    id: intro.id,
    status: intro.status,
    topic: intro.topic,
    eventTitle: intro.event_title || null,
    requesterDisplayName: shortDisplayName(requester.name),
    requesterTitleCompany: titleCompany || null,
    requesterLabel: requesterEmailLabel(requester),
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

  let targetFullName = '';
  let targetDisplay = 'them';
  let targetForThread = {
    displayName: 'them',
    fullName: '',
    attendeeId: intro.target_attendee_id,
    seedId: intro.target_seed_id,
  };

  if (intro.target_attendee_id) {
    const t = await loadRequester(sb, intro.target_attendee_id);
    targetFullName = t.name || '';
    targetDisplay = firstName(t.name);
    targetForThread = {
      displayName: targetDisplay,
      fullName: targetFullName,
      attendeeId: t.id,
      seedId: null,
    };
  } else if (intro.target_seed_id) {
    const { data: seed } = await sb
      .from('hubert_match_seed')
      .select('id, full_name, status')
      .eq('id', intro.target_seed_id)
      .maybeSingle();
    targetFullName = seed?.full_name || '';
    targetDisplay = firstName(seed?.full_name);
    targetForThread = {
      displayName: targetDisplay,
      fullName: targetFullName,
      attendeeId: null,
      seedId: seed?.id || null,
    };
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
    // Soft card for the person who declined — asker never gets a decline email.
    return {
      alreadyResponded: false,
      intro: publicIntroCard(
        {
          ...(updated || { ...intro, status: 'declined', responded_at: now }),
          target_full_name: targetFullName,
          target_display_name: shortDisplayName(targetFullName),
        },
        {
          direction: 'inbound',
        }
      ),
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
      {
        ...accepted,
        thread_opened_at: now,
        target_full_name: targetFullName,
        target_display_name: targetDisplay,
      },
      { direction: 'inbound' }
    ),
  };
}

async function resolveCounterpartFullName(sb, row) {
  if (row.target_attendee_id) {
    const t = await loadRequester(sb, row.target_attendee_id).catch(() => null);
    return t?.name || '';
  }
  if (row.target_seed_id) {
    const { data: seed } = await sb
      .from('hubert_match_seed')
      .select('full_name')
      .eq('id', row.target_seed_id)
      .maybeSingle();
    return seed?.full_name || '';
  }
  return '';
}

async function listIntrosForSession(session) {
  if (!isSupabaseConfigured()) throw new Error('supabase_not_configured');
  const sb = getSupabaseAdmin();
  const attendeeId = await resolveAttendeeId(sb, session);
  if (!attendeeId) {
    return { connections: [], requests: [], outbound: [], inbound: [] };
  }

  try {
    await expireStaleIntros(sb);
  } catch (e) {
    if (e && e.code === 'intro_migration_required') {
      return { connections: [], requests: [], outbound: [], inbound: [], migrationRequired: true };
    }
    throw e;
  }

  const { data: outboundRows, error: outErr } = await sb
    .from('hubert_intro_requests')
    .select('*')
    .eq('requester_attendee_id', attendeeId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (outErr) {
    if (isMissingIntroTableError(outErr)) {
      return { connections: [], requests: [], outbound: [], inbound: [], migrationRequired: true };
    }
    throw new Error(outErr.message);
  }

  const { data: inboundRows, error: inErr } = await sb
    .from('hubert_intro_requests')
    .select('*')
    .eq('target_attendee_id', attendeeId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (inErr) {
    if (isMissingIntroTableError(inErr)) {
      return { connections: [], requests: [], outbound: [], inbound: [], migrationRequired: true };
    }
    throw new Error(inErr.message);
  }

  const outbound = [];
  for (const row of outboundRows || []) {
    const full = await resolveCounterpartFullName(sb, row);
    const display = introDisplayName(full || 'Someone', row.status);
    outbound.push(
      publicIntroCard(
        { ...row, target_full_name: full, target_display_name: display },
        { direction: 'outbound' }
      )
    );
  }

  const inbound = [];
  for (const row of inboundRows || []) {
    const r = await loadRequester(sb, row.requester_attendee_id).catch(() => null);
    inbound.push(
      publicIntroCard(
        {
          ...row,
          requester: r,
          target_full_name: r?.name || '',
          target_display_name: introDisplayName(r?.name || 'Someone', row.status),
        },
        { direction: 'inbound' }
      )
    );
  }

  // Connections = mutual yes only (first names). Declines stay out of the list.
  const connections = []
    .concat(outbound, inbound)
    .filter((row) => row.status === 'accepted')
    .sort((a, b) => String(b.acceptedAt || b.createdAt || '').localeCompare(String(a.acceptedAt || a.createdAt || '')));

  // Quiet “waiting” list for the asker — pending only, soft label. No declined rows.
  const requests = outbound.filter((row) => row.status === 'pending');

  return { connections, requests, outbound, inbound };
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

  const direction = intro.requester_attendee_id === attendeeId ? 'outbound' : 'inbound';
  const counterpartFull = await resolveCounterpartFullName(sb, intro);
  const requester = await loadRequester(sb, intro.requester_attendee_id).catch(() => null);

  return {
    intro: publicIntroCard(
      {
        ...intro,
        requester,
        target_full_name: counterpartFull,
        target_display_name: introDisplayName(counterpartFull || 'Someone', intro.status),
      },
      { direction }
    ),
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
  firstName,
  formatTitleCompany,
  requesterEmailLabel,
  introDisplayName,
  softIntroStatus,
  publicIntroCard,
  createIntroRequest,
  previewIntroFromToken,
  respondToIntro,
  listIntrosForSession,
  getIntroThread,
  postIntroMessage,
};
