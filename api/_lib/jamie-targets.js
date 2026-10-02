/**
 * Jamie's October–2 November targets for Command Centre.
 * Visible to Catherine and Jamie. Counts come from her CRM meetings,
 * organiser claims she was last to work, and events she adds (including series dates).
 */
const { shownByFromEmail } = require('./organiser-sales-outreach');

const PERIOD_START = '2026-10-01';
const PERIOD_END = '2026-11-02';
const PERIOD_START_ISO = '2026-09-30T23:00:00.000Z';
const PERIOD_END_EXCLUSIVE_ISO = '2026-11-03T00:00:00.000Z';
const LOOKBACK_DAYS = 90;
const LOOKBACK_START = '2026-07-03';
const LOOKBACK_START_ISO = '2026-07-02T23:00:00.000Z';

const TARGETS = {
  meetings: 4,
  claimedPages: 25,
  events: 275,
};

const REFERRAL_MEETING_WEIGHT = 0.25;
const REFERRED_NOTE = 'Referred to Jamie';

const STAFF = new Set(['Catherine', 'Rosie', 'Jamie']);
const CREDIT_ACTIONS = new Set(['event_created', 'admin_claim_invite', 'admin_ownership_transfer']);
const PITCH_DECK_MEETING = /^Meeting — (Updated )?Tailored pitch deck\b/i;

function canSeeJamieTargets(email) {
  const who = shownByFromEmail(email);
  return who === 'Catherine' || who === 'Jamie';
}

function canReferMeetingToJamie(email) {
  return shownByFromEmail(email) === 'Catherine';
}

function isJamieStaff(emailOrShownBy) {
  const raw = String(emailOrShownBy || '').trim();
  if (raw === 'Jamie') return true;
  return shownByFromEmail(raw) === 'Jamie';
}

function staffNameFromEmail(email) {
  const who = shownByFromEmail(email);
  return STAFF.has(who) ? who : '';
}

function progressSnapshot(actual, target) {
  const done = Math.max(0, Number(actual) || 0);
  const goal = Math.max(1, Number(target) || 1);
  return {
    actual: done,
    target: goal,
    remaining: Math.max(0, goal - done),
    progressPct: Math.min(100, Math.round((done / goal) * 100)),
    complete: done >= goal,
  };
}

function inclusiveDaySpan(startDate, endDate) {
  const ms = Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z');
  return Math.round(ms / 86400000) + 1;
}

function londonToday(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now || new Date());
}

function periodMeta(now) {
  const today = londonToday(now);
  const daysTotal = inclusiveDaySpan(PERIOD_START, PERIOD_END);
  let daysElapsed = 0;
  if (today >= PERIOD_START && today <= PERIOD_END) {
    daysElapsed = inclusiveDaySpan(PERIOD_START, today);
  } else if (today > PERIOD_END) {
    daysElapsed = daysTotal;
  }
  return {
    label: '1 October – 2 November 2026',
    start: PERIOD_START,
    end: PERIOD_END,
    daysTotal,
    daysElapsed,
    daysRemaining: Math.max(0, daysTotal - daysElapsed),
  };
}

function formatWhen(iso, dateOnly) {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + 'T12:00:00Z');
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/London',
    }).format(d);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(d);
}

function meetingTouchBody(line) {
  return String(line || '')
    .trim()
    .replace(/^\d{4}-\d{2}-\d{2}:\s*/, '');
}

function isBookedMeetingNotes(notes) {
  return String(notes || '')
    .split(/\n/)
    .some((line) => {
      const body = meetingTouchBody(line);
      if (!body || PITCH_DECK_MEETING.test(body)) return false;
      return body === 'Meeting' || /^Meeting — /.test(body) || /^Meeting - /.test(body);
    });
}

function isReferredMeetingNotes(notes) {
  return String(notes || '')
    .split(/\n/)
    .some((line) => {
      const body = meetingTouchBody(line);
      return (
        body === REFERRED_NOTE ||
        body.startsWith(REFERRED_NOTE + ' — ') ||
        body.startsWith(REFERRED_NOTE + ' - ')
      );
    });
}

function referredMeetingDetail(notes) {
  const lines = String(notes || '').split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const body = meetingTouchBody(lines[i]);
    if (body === REFERRED_NOTE) return '';
    if (body.startsWith(REFERRED_NOTE + ' — ') || body.startsWith(REFERRED_NOTE + ' - ')) {
      return body.slice(REFERRED_NOTE.length + 3).trim();
    }
  }
  return '';
}

function isCatherineReferral(row) {
  if (!row || !isReferredMeetingNotes(row.notes)) return false;
  return row.shown_by === 'Catherine' || staffNameFromEmail(row.created_by_email) === 'Catherine';
}

function meetingNoteDetail(notes) {
  const lines = String(notes || '').split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const body = meetingTouchBody(lines[i]);
    if (!body || PITCH_DECK_MEETING.test(body)) continue;
    if (body === 'Meeting') return '';
    const dash = body.indexOf(' — ');
    if (body.startsWith('Meeting — ') || body.startsWith('Meeting - ')) {
      return body.slice(dash >= 0 ? dash + 3 : 10).trim();
    }
  }
  return '';
}

function inPeriodIso(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= Date.parse(PERIOD_START_ISO) && t < Date.parse(PERIOD_END_EXCLUSIVE_ISO);
}

function inPeriodDate(dateStr) {
  const day = String(dateStr || '').slice(0, 10);
  return day >= PERIOD_START && day <= PERIOD_END;
}

function touchInstant(raw) {
  const s = String(raw || '').trim();
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T12:00:00.000Z');
  return Date.parse(s);
}

/**
 * Last Catherine / Rosie / Jamie touch for this organiser in the 90 days
 * before the claim (plus one day of grace).
 */
function lastStaffBeforeClaim(touches, organiserId, claimedAt) {
  const claimMs = Date.parse(claimedAt);
  if (!Number.isFinite(claimMs)) return null;
  const start = claimMs - LOOKBACK_DAYS * 86400000;
  const end = claimMs + 86400000;
  const id = String(organiserId || '');
  let best = null;
  (touches || []).forEach((touch) => {
    if (!touch || String(touch.organiserId || '') !== id) return;
    if (!STAFF.has(touch.staff)) return;
    const at = touchInstant(touch.at);
    if (!Number.isFinite(at) || at < start || at > end) return;
    if (!best || at >= best.atMs) {
      best = { staff: touch.staff, email: touch.email || '', atMs: at };
    }
  });
  return best;
}

function demoStaff(row) {
  const shown = String(row && row.shown_by ? row.shown_by : '').trim();
  if (STAFF.has(shown)) return shown;
  return staffNameFromEmail(row && row.created_by_email);
}

function buildJamieTargetsReport(input) {
  const source = input || {};
  const now = source.now || new Date();
  const activityRows = Array.isArray(source.activityRows) ? source.activityRows : [];
  const demos = Array.isArray(source.demos) ? source.demos : [];
  const organisers = Array.isArray(source.organisers) ? source.organisers : [];

  const touches = [];
  const eventIds = new Set();
  const activity = [];
  let referredMeetings = 0;

  activityRows.forEach((row) => {
    const staff = staffNameFromEmail(row.actor_email);
    if (!staff) return;
    const action = String(row.action || '');
    const organiserId = row.organiser_id || (row.metadata && row.metadata.organiserId) || null;
    if (CREDIT_ACTIONS.has(action) && organiserId && staff) {
      touches.push({
        organiserId,
        staff,
        email: row.actor_email || '',
        at: row.created_at,
      });
    }
    if (action !== 'event_created' || staff !== 'Jamie') return;
    if (!inPeriodIso(row.created_at)) return;
    const entityId = String(row.entity_id || '');
    if (!entityId || eventIds.has(entityId)) return;
    eventIds.add(entityId);
    activity.push({
      at: row.created_at,
      kind: 'event',
      kindLabel: 'Event',
      whenLabel: formatWhen(row.created_at, false),
      summary: String(row.summary || 'Added event').trim(),
      organiserId: organiserId || '',
    });
  });

  demos.forEach((row) => {
    const staff = demoStaff(row);
    if (!staff) return;
    if (row.organiser_id) {
      touches.push({
        organiserId: row.organiser_id,
        staff,
        email: row.created_by_email || '',
        at: row.shown_at || row.updated_at || row.created_at,
      });
    }
    if (isCatherineReferral(row) && inPeriodDate(row.shown_at || row.created_at)) {
      referredMeetings += 1;
      const name = String(row.organiser_name || 'Group').trim() || 'Group';
      const detail = referredMeetingDetail(row.notes);
      activity.push({
        at: /^\d{4}-\d{2}-\d{2}$/.test(String(row.shown_at || ''))
          ? String(row.shown_at) + 'T12:00:00.000Z'
          : row.shown_at || row.created_at,
        kind: 'referral',
        kindLabel: 'Referred meeting',
        whenLabel: formatWhen(row.shown_at || row.created_at, true),
        summary: 'Referred to Jamie · ' + name + (detail ? ' — ' + detail : '') + ' (0.25)',
        organiserId: row.organiser_id || '',
      });
    }
    if (staff !== 'Jamie') return;
    if (!inPeriodDate(row.shown_at || row.created_at)) return;
    if (!isBookedMeetingNotes(row.notes)) return;
    const name = String(row.organiser_name || 'Group').trim() || 'Group';
    const detail = meetingNoteDetail(row.notes);
    activity.push({
      at: /^\d{4}-\d{2}-\d{2}$/.test(String(row.shown_at || ''))
        ? String(row.shown_at) + 'T12:00:00.000Z'
        : row.shown_at || row.created_at,
      kind: 'meeting',
      kindLabel: 'Meeting',
      whenLabel: formatWhen(row.shown_at || row.created_at, true),
      summary: 'Booked meeting · ' + name + (detail ? ' — ' + detail : ''),
      organiserId: row.organiser_id || '',
    });
  });

  const claimIds = new Set();
  organisers.forEach((row) => {
    const claimedAt = row.ownership_claimed_at || row.ownershipClaimedAt;
    if (!row || !row.id || claimIds.has(row.id)) return;
    if (!inPeriodIso(claimedAt)) return;
    const credit = lastStaffBeforeClaim(touches, row.id, claimedAt);
    if (!credit || credit.staff !== 'Jamie') return;
    const name = String(row.name || 'Group').trim() || 'Group';
    claimIds.add(row.id);
    activity.push({
      at: claimedAt,
      kind: 'claim',
      kindLabel: 'Claimed page',
      whenLabel: formatWhen(claimedAt, false),
      summary: 'Page claimed · ' + name,
      organiserId: row.id || '',
    });
  });

  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const meetings = activity.filter((item) => item.kind === 'meeting');
  const referredPoints = Math.round(referredMeetings * REFERRAL_MEETING_WEIGHT * 100) / 100;
  const meetingPoints = Math.round((meetings.length + referredPoints) * 100) / 100;
  const meetingHint =
    meetings.length +
    ' booked by Jamie and ' +
    referredMeetings +
    ' referred by Catherine (' +
    referredPoints +
    '). A meeting Jamie logs counts as 1. A meeting Catherine refers to her counts as 0.25. Pitch-deck saves do not count.';
  return {
    period: periodMeta(now),
    metrics: {
      meetings: {
        ...progressSnapshot(meetingPoints, TARGETS.meetings),
        label: 'Booked meetings',
        booked: meetings.length,
        referred: referredMeetings,
        referredPoints,
        hint: meetingHint,
      },
      claimedPages: {
        ...progressSnapshot(claimIds.size, TARGETS.claimedPages),
        label: 'Claimed organiser pages',
        hint: 'A page counts when it is claimed in this period and Jamie was the last team member to contact that group — a sales-kit log, a claim invite she sent, or an event she added.',
      },
      events: {
        ...progressSnapshot(eventIds.size, TARGETS.events),
        label: 'Events added',
        hint: 'Each date Jamie adds is logged as activity and counted here, including every date in a series.',
      },
    },
    activity: activity.slice(0, 40),
  };
}

async function selectPages(buildQuery) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; from < 4000; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function getJamieTargets(sb) {
  const jamieEvents = await selectPages(() =>
    sb
      .from('entity_activity_log')
      .select('id, created_at, actor_email, entity_id, organiser_id, action, summary, metadata')
      .eq('action', 'event_created')
      .or('actor_email.ilike.jamie@%,actor_email.ilike.jamie.%')
      .gte('created_at', LOOKBACK_START_ISO)
      .lt('created_at', PERIOD_END_EXCLUSIVE_ISO)
      .order('created_at', { ascending: false })
  );
  const staffTouches = await selectPages(() =>
    sb
      .from('entity_activity_log')
      .select('id, created_at, actor_email, entity_id, organiser_id, action, summary, metadata')
      .in('action', ['admin_claim_invite', 'admin_ownership_transfer'])
      .gte('created_at', LOOKBACK_START_ISO)
      .lt('created_at', PERIOD_END_EXCLUSIVE_ISO)
      .order('created_at', { ascending: false })
  );
  const activityRows = jamieEvents.concat(staffTouches);

  const demos = await selectPages(() =>
    sb
      .from('organiser_sales_demos')
      .select('id, shown_at, shown_by, organiser_name, organiser_id, notes, created_by_email, created_at, updated_at')
      .gte('shown_at', LOOKBACK_START)
      .lte('shown_at', PERIOD_END)
      .order('shown_at', { ascending: false })
  );

  const organisers = await selectPages(() =>
    sb
      .from('organisers')
      .select('id, name, ownership_claimed_at')
      .eq('ownership_claim_status', 'claimed')
      .gte('ownership_claimed_at', PERIOD_START_ISO)
      .lt('ownership_claimed_at', PERIOD_END_EXCLUSIVE_ISO)
  );

  return buildJamieTargetsReport({ activityRows, demos, organisers, now: new Date() });
}

async function noteOrganiserPageClaimed(session, organiserRow) {
  try {
    const { isSupabaseConfigured, getSupabaseAdmin } = require('./supabase');
    const { logEntityActivity } = require('./entity-activity-log');
    if (!isSupabaseConfigured() || !organiserRow || !organiserRow.id) return;
    const sb = getSupabaseAdmin();
    const claimedAt = organiserRow.ownership_claimed_at || new Date().toISOString();
    const [demos, activityRows] = await Promise.all([
      sb
        .from('organiser_sales_demos')
        .select('shown_by, shown_at, organiser_id, created_by_email, created_at, updated_at')
        .eq('organiser_id', organiserRow.id)
        .order('shown_at', { ascending: false })
        .limit(20),
      sb
        .from('entity_activity_log')
        .select('actor_email, created_at, organiser_id, action')
        .eq('organiser_id', organiserRow.id)
        .in('action', ['event_created', 'admin_claim_invite', 'admin_ownership_transfer'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    const touches = [];
    ((activityRows && activityRows.data) || []).forEach((row) => {
      const staff = staffNameFromEmail(row.actor_email);
      if (!staff || !row.organiser_id) return;
      touches.push({ organiserId: row.organiser_id, staff, email: row.actor_email || '', at: row.created_at });
    });
    ((demos && demos.data) || []).forEach((row) => {
      const staff = demoStaff(row);
      if (!staff || !row.organiser_id) return;
      touches.push({
        organiserId: row.organiser_id,
        staff,
        email: row.created_by_email || '',
        at: row.shown_at || row.updated_at || row.created_at,
      });
    });
    const credit = lastStaffBeforeClaim(touches, organiserRow.id, claimedAt);
    const name = String(organiserRow.name || '').trim();
    await logEntityActivity({
      actor_user_id: session && (session.sub || session.userId) ? session.sub || session.userId : null,
      actor_email: session && session.email ? session.email : null,
      actor_role: 'owner',
      entity_type: 'organiser',
      entity_id: organiserRow.id,
      organiser_id: organiserRow.id,
      action: 'organiser_page_claimed',
      summary: 'Organiser page claimed' + (name ? ': ' + name.slice(0, 80) : ''),
      metadata: {
        creditedStaff: credit ? credit.staff : null,
        creditedEmail: credit ? credit.email || null : null,
      },
    });
  } catch (e) {
    console.warn('[jamie-targets] claim note', e && e.message ? e.message : e);
  }
}

function referralNotes(detail) {
  const note = String(detail || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
  if (!note) return REFERRED_NOTE;
  return REFERRED_NOTE + ' — ' + note;
}

async function addReferredMeeting(sb, session, input) {
  const fields = input || {};
  const organiserName = String(fields.organiserName || fields.organiser_name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
  if (!organiserName) {
    const err = new Error('Add the group or contact name.');
    err.status = 400;
    err.code = 'missing_name';
    throw err;
  }
  const email = String((session && session.email) || '')
    .trim()
    .toLowerCase();
  const organiserEmail = String(fields.organiserEmail || fields.organiser_email || '')
    .trim()
    .toLowerCase();
  const organiserId = String(fields.organiserId || fields.organiser_id || '').trim() || null;
  const row = {
    shown_at: londonToday(),
    shown_by: 'Catherine',
    organiser_name: organiserName,
    organiser_email: organiserEmail || null,
    organiser_id: organiserId,
    outcome: 'follow_up',
    notes: referralNotes(fields.note || fields.notes),
    source: 'manual',
    created_by_email: email || null,
  };
  let insertRes = await sb.from('organiser_sales_demos').insert(row).select('id').maybeSingle();
  if (insertRes.error && /source/i.test(String(insertRes.error.message || ''))) {
    const legacy = { ...row };
    delete legacy.source;
    insertRes = await sb.from('organiser_sales_demos').insert(legacy).select('id').maybeSingle();
  }
  if (insertRes.error) throw new Error(insertRes.error.message);
  return { id: insertRes.data && insertRes.data.id, organiserName, notes: row.notes };
}

module.exports = {
  PERIOD_START,
  PERIOD_END,
  TARGETS,
  REFERRAL_MEETING_WEIGHT,
  canSeeJamieTargets,
  canReferMeetingToJamie,
  isBookedMeetingNotes,
  isReferredMeetingNotes,
  lastStaffBeforeClaim,
  progressSnapshot,
  periodMeta,
  buildJamieTargetsReport,
  getJamieTargets,
  addReferredMeeting,
  noteOrganiserPageClaimed,
};
