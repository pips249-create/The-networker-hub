/**
 * Pip's activity for Command Centre. Visible only to Catherine.
 * Same window as Jamie's targets: 1 October–2 November 2026.
 */
const { shownByFromEmail } = require('./organiser-sales-outreach');
const {
  PERIOD_START,
  PERIOD_END,
  PERIOD_START_ISO,
  PERIOD_END_EXCLUSIVE_ISO,
  isBookedMeetingNotes,
  creditListedEvents,
} = require('./jamie-targets');

const PITCH_DECK_MEETING = /^Meeting — (Updated )?Tailored pitch deck\b/i;
const TOUCHES = ['Attempted call', 'Called', 'Emailed', 'Meeting', 'LinkedIn'];
const REFERRED_NOTE = 'Referred to Jamie';

function canSeePipsActivity(email) {
  return shownByFromEmail(email) === 'Catherine';
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

function inPeriodIso(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= Date.parse(PERIOD_START_ISO) && t < Date.parse(PERIOD_END_EXCLUSIVE_ISO);
}

function inPeriodDate(dateStr) {
  const day = String(dateStr || '').slice(0, 10);
  return day >= PERIOD_START && day <= PERIOD_END;
}

function noteLines(notes) {
  return String(notes || '')
    .split(/\n/)
    .map((line) =>
      String(line || '')
        .trim()
        .replace(/^\d{4}-\d{2}-\d{2}:\s*/, '')
    )
    .filter(Boolean);
}

function isReferredMeetingNotes(notes) {
  return noteLines(notes).some(
    (body) =>
      body === REFERRED_NOTE ||
      body.startsWith(REFERRED_NOTE + ' — ') ||
      body.startsWith(REFERRED_NOTE + ' - ')
  );
}

function touchFromNotes(notes) {
  const lines = noteLines(notes);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const body = lines[i];
    for (let t = 0; t < TOUCHES.length; t += 1) {
      const touch = TOUCHES[t];
      if (body === touch || body.startsWith(touch + ' — ') || body.startsWith(touch + ' - ')) {
        if (PITCH_DECK_MEETING.test(body)) return '';
        const dash = body.indexOf(' — ');
        const alt = body.indexOf(' - ');
        const cut = dash >= 0 ? dash : alt;
        const detail = cut >= 0 ? body.slice(cut + 3).trim() : '';
        return { touch, detail };
      }
    }
  }
  return null;
}

function demoActivity(row) {
  const name = String(row.organiser_name || 'Group').trim() || 'Group';
  const at = /^\d{4}-\d{2}-\d{2}$/.test(String(row.shown_at || ''))
    ? String(row.shown_at) + 'T12:00:00.000Z'
    : row.shown_at || row.created_at;
  const whenLabel = formatWhen(row.shown_at || row.created_at, true);
  const organiserId = row.organiser_id || '';

  if (isReferredMeetingNotes(row.notes)) {
    const detail = noteLines(row.notes)
      .filter((line) => line.indexOf(REFERRED_NOTE) === 0)
      .map((line) => line.replace(/^Referred to Jamie\s+[—-]\s*/, '').trim())
      .filter((line) => line && line !== REFERRED_NOTE)
      .pop();
    return {
      at,
      kind: 'referral',
      kindLabel: 'Referred meeting',
      whenLabel,
      summary: 'Referred to Jamie · ' + name + (detail ? ' — ' + detail : ''),
      organiserId,
    };
  }

  if (isBookedMeetingNotes(row.notes)) {
    const parsed = touchFromNotes(row.notes);
    const detail = parsed && parsed.touch === 'Meeting' ? parsed.detail : '';
    return {
      at,
      kind: 'meeting',
      kindLabel: 'Meeting',
      whenLabel,
      summary: 'Meeting · ' + name + (detail ? ' — ' + detail : ''),
      organiserId,
    };
  }

  const lines = noteLines(row.notes);
  const latest = lines[lines.length - 1] || 'Logged outreach';
  const pitch = lines.some((line) => PITCH_DECK_MEETING.test(line));
  return {
    at,
    kind: pitch ? 'pitch' : 'outreach',
    kindLabel: pitch ? 'Pitch deck' : 'CRM',
    whenLabel,
    summary: latest + (latest.indexOf(name) === -1 ? ' · ' + name : ''),
    organiserId,
  };
}

function logActivity(row) {
  const action = String(row.action || '');
  const at = row.created_at;
  const organiserId = row.organiser_id || '';
  const summary = String(row.summary || action).trim();
  if (action === 'event_created') {
    return {
      at,
      kind: 'event',
      kindLabel: 'Event',
      whenLabel: formatWhen(at, false),
      summary,
      organiserId,
    };
  }
  if (action === 'admin_claim_invite') {
    return {
      at,
      kind: 'invite',
      kindLabel: 'Claim invite',
      whenLabel: formatWhen(at, false),
      summary,
      organiserId,
    };
  }
  if (action === 'admin_ownership_transfer') {
    return {
      at,
      kind: 'transfer',
      kindLabel: 'Ownership',
      whenLabel: formatWhen(at, false),
      summary,
      organiserId,
    };
  }
  return null;
}

function buildPipActivityReport(input) {
  const source = input || {};
  const activityRows = Array.isArray(source.activityRows) ? source.activityRows : [];
  const demos = Array.isArray(source.demos) ? source.demos : [];
  const activity = [];
  const eventIds = new Set();

  activityRows.forEach((row) => {
    if (shownByFromEmail(row.actor_email) !== 'Catherine') return;
    if (!inPeriodIso(row.created_at)) return;
    if (String(row.action || '') === 'event_created') {
      const entityId = String(row.entity_id || '');
      if (!entityId || eventIds.has(entityId)) return;
      eventIds.add(entityId);
    }
    const item = logActivity(row);
    if (item) activity.push(item);
  });

  (Array.isArray(source.listedEvents) ? source.listedEvents : []).forEach((eventRow) => {
    const entityId = String(eventRow && (eventRow.id || eventRow.entity_id) || '');
    if (!entityId || eventIds.has(entityId)) return;
    const created = eventRow.created_at || eventRow.createdAt;
    if (!inPeriodIso(created)) return;
    eventIds.add(entityId);
    const title = String(eventRow.title || '').trim();
    activity.push({
      at: created,
      kind: 'event',
      kindLabel: 'Event',
      whenLabel: formatWhen(created, false),
      summary: eventRow.summary
        ? String(eventRow.summary)
        : 'Added event' + (title ? ': ' + title : ''),
      organiserId: eventRow.organiser_id || eventRow.organiserId || '',
    });
  });

  demos.forEach((row) => {
    if (String(row.shown_by || '') !== 'Catherine') return;
    if (!inPeriodDate(row.shown_at || row.created_at)) return;
    activity.push(demoActivity(row));
  });

  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const count = (kind) => activity.filter((item) => item.kind === kind).length;

  return {
    period: {
      label: '1 October – 2 November 2026',
      start: PERIOD_START,
      end: PERIOD_END,
    },
    counts: {
      events: eventIds.size,
      meetings: count('meeting'),
      referrals: count('referral'),
      outreach: count('outreach') + count('pitch'),
    },
    activity: activity.slice(0, 80),
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

async function getPipsActivity(sb) {
  const activityRows = await selectPages(() =>
    sb
      .from('entity_activity_log')
      .select('id, created_at, actor_email, entity_id, organiser_id, action, summary')
      .in('action', ['event_created', 'admin_claim_invite', 'admin_ownership_transfer'])
      .or(
        'actor_email.ilike.catherine@*,actor_email.ilike.pips249@gmail.com,actor_email.ilike.hancher249@gmail.com'
      )
      .gte('created_at', PERIOD_START_ISO)
      .lt('created_at', PERIOD_END_EXCLUSIVE_ISO)
      .order('created_at', { ascending: false })
  );

  const demos = await selectPages(() =>
    sb
      .from('organiser_sales_demos')
      .select('id, shown_at, shown_by, organiser_name, organiser_id, notes, created_by_email, created_at')
      .eq('shown_by', 'Catherine')
      .gte('shown_at', PERIOD_START)
      .lte('shown_at', PERIOD_END)
      .order('shown_at', { ascending: false })
  );

  const listedOrganiserIds = [
    ...new Set(
      demos
        .filter((row) => row.organiser_id && /Listed an event/i.test(String(row.notes || '')))
        .map((row) => String(row.organiser_id))
    ),
  ];
  const listedRows = [];
  for (let i = 0; i < listedOrganiserIds.length; i += 80) {
    const chunk = listedOrganiserIds.slice(i, i + 80);
    const batch = await selectPages(() =>
      sb
        .from('events')
        .select('id, title, organiser_id, created_at, starts_at')
        .in('organiser_id', chunk)
        .gte('created_at', PERIOD_START_ISO)
        .lt('created_at', PERIOD_END_EXCLUSIVE_ISO)
    );
    listedRows.push(...batch);
  }

  return buildPipActivityReport({
    activityRows,
    demos,
    listedEvents: creditListedEvents(demos, listedRows, 'Catherine'),
  });
}

module.exports = {
  canSeePipsActivity,
  buildPipActivityReport,
  getPipsActivity,
};
