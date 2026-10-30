/**
 * Rosie/ops seed intro follow-ups.
 * Spec: exactly 1 polite reminder at day 5–7, then auto-pause in BOH if still unaccepted.
 */

const REMINDER_AFTER_DAYS = 5;
const PAUSE_AFTER_DAYS = 7;
const BATCH_LIMIT = 40;
const PAUSE_REASON = 'intro_no_response';

function daysAgoIso(days, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  return new Date(now - Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

function siteBase() {
  return require('./hub-email-urls').emailSiteBase(process.env.SITE_URL);
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

function requesterEmailLabel(requester) {
  const name = shortDisplayName(requester && requester.name);
  const role = formatTitleCompany(
    requester && (requester.job_title || requester.jobTitle),
    requester && requester.company
  );
  return role ? name + ' (' + role + ')' : name;
}

function isMissingTableError(error, tableName) {
  const msg = String((error && (error.message || error.details || error.hint)) || '').toLowerCase();
  const code = String((error && error.code) || '');
  const table = String(tableName || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes("could not find the table 'public." + table + "'") ||
    (msg.includes(table) && msg.includes('schema cache')) ||
    (msg.includes('relation') && msg.includes(table) && msg.includes('does not exist'))
  );
}

async function loadRequester(sb, attendeeId) {
  if (!attendeeId) return null;
  const { data, error } = await sb
    .from('attendees')
    .select('id, name, email, company, job_title')
    .eq('id', attendeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function sendSeedIntroReminderEmail(intro, requester, targetEmail, targetFullName) {
  const { createHubertIntroToken } = require('./hubert-intro-token');
  const { sendTemplatedEmail } = require('./send-template-email');
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
  const shortName = shortDisplayName(requester && requester.name);
  const titleCompany = formatTitleCompany(
    requester && requester.job_title,
    requester && requester.company
  );
  const requesterLabel = requesterEmailLabel(requester || {});
  const requester_about = titleCompany
    ? shortName + ' is ' + titleCompany + '.'
    : shortName + ' is a member on The Networker UK.';
  const eventContext = intro.event_title
    ? 'Shared event context: ' + intro.event_title + '.'
    : '';

  await sendTemplatedEmail({
    slug: 'hubert_intro_reminder',
    to: targetEmail,
    variables: {
      user_name: firstName(targetFullName),
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

/**
 * Send one reminder for pending seed intros ≥ REMINDER_AFTER_DAYS old.
 */
async function sendDueSeedIntroReminders(sb, opts) {
  const nowMs = opts && opts.nowMs != null ? Number(opts.nowMs) : Date.now();
  const limit = Math.min(100, Math.max(1, Number((opts && opts.limit) || BATCH_LIMIT)));
  const cutoff = daysAgoIso(REMINDER_AFTER_DAYS, nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const { data, error } = await sb
    .from('hubert_intro_requests')
    .select(
      'id, topic, event_title, emailed_at, reminder_sent_at, requester_attendee_id, target_seed_id, target_email, expires_at, status'
    )
    .eq('status', 'pending')
    .not('target_seed_id', 'is', null)
    .not('emailed_at', 'is', null)
    .is('reminder_sent_at', null)
    .lte('emailed_at', cutoff)
    .order('emailed_at', { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error, 'hubert_intro_requests')) {
      return { ok: true, skipped: true, reason: 'intro_table_missing', reminded: 0, failed: 0 };
    }
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  let reminded = 0;
  let failed = 0;
  const errors = [];

  for (const intro of rows) {
    try {
      if (intro.expires_at && new Date(intro.expires_at).getTime() <= nowMs) {
        continue;
      }
      const email = String(intro.target_email || '')
        .trim()
        .toLowerCase();
      if (!email) {
        failed += 1;
        errors.push({ id: intro.id, error: 'target_email_missing' });
        continue;
      }

      const requester = await loadRequester(sb, intro.requester_attendee_id);
      if (!requester) {
        failed += 1;
        errors.push({ id: intro.id, error: 'requester_missing' });
        continue;
      }

      let targetFullName = '';
      const { data: seed, error: seedErr } = await sb
        .from('hubert_match_seed')
        .select('id, full_name, status, reminder_sent_at')
        .eq('id', intro.target_seed_id)
        .maybeSingle();
      if (seedErr) {
        if (isMissingTableError(seedErr, 'hubert_match_seed')) {
          return { ok: true, skipped: true, reason: 'seed_table_missing', reminded, failed };
        }
        throw new Error(seedErr.message);
      }
      if (!seed || seed.status === 'do_not_contact') {
        continue;
      }
      targetFullName = seed.full_name || '';

      await sendSeedIntroReminderEmail(intro, requester, email, targetFullName);

      const { error: updErr } = await sb
        .from('hubert_intro_requests')
        .update({ reminder_sent_at: nowIso, updated_at: nowIso })
        .eq('id', intro.id)
        .eq('status', 'pending')
        .is('reminder_sent_at', null);
      if (updErr) throw new Error(updErr.message);

      if (!seed.reminder_sent_at) {
        await sb
          .from('hubert_match_seed')
          .update({ reminder_sent_at: nowIso, updated_at: nowIso })
          .eq('id', seed.id);
      }

      reminded += 1;
    } catch (e) {
      failed += 1;
      errors.push({ id: intro.id, error: e && e.message ? e.message : String(e) });
      console.error(
        '[hubert-seed-followups] reminder failed',
        intro && intro.id,
        e && e.message ? e.message : e
      );
    }
  }

  return { ok: true, reminded, failed, scanned: rows.length, errors: errors.slice(0, 10) };
}

/**
 * Pause active seed contacts still sitting on unanswered intros ≥ PAUSE_AFTER_DAYS,
 * after a reminder has been sent (or the intro is old enough that reminder already ran).
 */
async function pauseUnresponsiveSeedIntros(sb, opts) {
  const nowMs = opts && opts.nowMs != null ? Number(opts.nowMs) : Date.now();
  const limit = Math.min(100, Math.max(1, Number((opts && opts.limit) || BATCH_LIMIT)));
  const cutoff = daysAgoIso(PAUSE_AFTER_DAYS, nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const { data, error } = await sb
    .from('hubert_intro_requests')
    .select('id, target_seed_id, emailed_at, reminder_sent_at, status')
    .eq('status', 'pending')
    .not('target_seed_id', 'is', null)
    .not('emailed_at', 'is', null)
    .not('reminder_sent_at', 'is', null)
    .lte('emailed_at', cutoff)
    .order('emailed_at', { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error, 'hubert_intro_requests')) {
      return { ok: true, skipped: true, reason: 'intro_table_missing', paused: 0, failed: 0 };
    }
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  const seedIds = [];
  const seen = new Set();
  for (const row of rows) {
    const id = row && row.target_seed_id ? String(row.target_seed_id) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    seedIds.push(id);
  }

  let paused = 0;
  let failed = 0;
  const errors = [];

  for (const seedId of seedIds) {
    try {
      const { data: updated, error: updErr } = await sb
        .from('hubert_match_seed')
        .update({
          status: 'paused',
          paused_at: nowIso,
          pause_reason: PAUSE_REASON,
          updated_at: nowIso,
        })
        .eq('id', seedId)
        .eq('status', 'active')
        .select('id')
        .maybeSingle();
      if (updErr) {
        if (isMissingTableError(updErr, 'hubert_match_seed')) {
          return { ok: true, skipped: true, reason: 'seed_table_missing', paused, failed };
        }
        throw new Error(updErr.message);
      }
      if (updated && updated.id) paused += 1;
    } catch (e) {
      failed += 1;
      errors.push({ id: seedId, error: e && e.message ? e.message : String(e) });
      console.error(
        '[hubert-seed-followups] pause failed',
        seedId,
        e && e.message ? e.message : e
      );
    }
  }

  return {
    ok: true,
    paused,
    failed,
    scanned: rows.length,
    seedCandidates: seedIds.length,
    errors: errors.slice(0, 10),
  };
}

async function processSeedIntroFollowups(sb, opts) {
  const reminders = await sendDueSeedIntroReminders(sb, opts);
  const pauses = await pauseUnresponsiveSeedIntros(sb, opts);
  return {
    ok: true,
    reminders,
    pauses,
    reminderAfterDays: REMINDER_AFTER_DAYS,
    pauseAfterDays: PAUSE_AFTER_DAYS,
  };
}

module.exports = {
  REMINDER_AFTER_DAYS,
  PAUSE_AFTER_DAYS,
  PAUSE_REASON,
  BATCH_LIMIT,
  daysAgoIso,
  sendDueSeedIntroReminders,
  pauseUnresponsiveSeedIntros,
  processSeedIntroFollowups,
  sendSeedIntroReminderEmail,
};
