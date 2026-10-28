/**
 * Hubert Matchmaker — back-of-house shortlist (max 5).
 * Never returns email, phone, or LinkedIn.
 */
const MAX_SHORTLIST = 5;
const MIN_QUERY_LEN = 3;

function shortDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'Member';
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
}

function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#&\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 24);
}

function haystackFor(person) {
  return [
    person.fullName,
    person.company,
    person.jobTitle,
    person.industry,
    person.professionalRole,
    person.blurb,
    ...(Array.isArray(person.lookingToMeet) ? person.lookingToMeet : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreAgainstQuery(person, tokens) {
  if (!tokens.length) return 0;
  const hay = haystackFor(person);
  if (!hay) return 0;
  let score = 0;
  tokens.forEach((t) => {
    if (hay.includes(t)) score += 3;
    // Light partial: token as whole word-ish
    if (new RegExp('(?:^|\\s)' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay)) score += 1;
  });
  return score;
}

/**
 * Event boost tiers (spec): same event > other upcoming > none
 */
function eventBoost(person, requesterEventIds) {
  const ids = Array.isArray(requesterEventIds) ? requesterEventIds : [];
  const theirs = person.nextEvent && person.nextEvent.eventId ? String(person.nextEvent.eventId) : '';
  if (theirs && ids.includes(theirs)) return 40;
  if (person.nextEvent && person.nextEvent.title) return 15;
  return 0;
}

function rankCandidates(candidates, query, requesterEventIds) {
  const tokens = tokenize(query);
  return (candidates || [])
    .map((person) => {
      const textScore = scoreAgainstQuery(person, tokens);
      const boost = eventBoost(person, requesterEventIds);
      const total = textScore + boost;
      return { person, textScore, boost, total };
    })
    .filter((row) => row.textScore > 0 || row.boost >= 15)
    .sort((a, b) => b.total - a.total || b.boost - a.boost || String(a.person.displayName).localeCompare(String(b.person.displayName)))
    .slice(0, MAX_SHORTLIST)
    .map((row) => ({
      id: row.person.id,
      kind: row.person.kind,
      displayName: row.person.displayName,
      role: row.person.role || '',
      company: row.person.company || '',
      why: row.person.why || buildWhy(row),
      nextEvent: row.person.nextEvent
        ? {
            title: row.person.nextEvent.title,
            dateLabel: row.person.nextEvent.dateLabel || '',
            // eventId kept server-side for later intro context; omit from client if preferred —
            // include for ticket-upsell attribution later; safe (not PII contact).
            eventId: row.person.nextEvent.eventId || '',
          }
        : null,
      onHub: Boolean(row.person.onHub),
      score: row.total,
    }));
}

function buildWhy(row) {
  if (row.boost >= 40) return 'You’ll both be at the same upcoming event';
  if (row.boost >= 15) return 'Has an upcoming event on the Hub';
  if (row.textScore > 0) return 'Matches what you asked Hubert for';
  return '';
}

function formatDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function mapSeedRow(row) {
  return {
    id: 'seed:' + row.id,
    kind: 'seed',
    fullName: row.full_name,
    displayName: shortDisplayName(row.full_name),
    role: row.professional_role || row.job_title || '',
    company: row.company || '',
    jobTitle: row.job_title || '',
    industry: row.industry || '',
    professionalRole: row.professional_role || '',
    lookingToMeet: Array.isArray(row.looking_to_meet) ? row.looking_to_meet : [],
    blurb: row.blurb || '',
    nextEvent: null,
    onHub: false,
    why: 'Hubert can invite them to join',
  };
}

function mapMemberRow(row, nextEvent) {
  return {
    id: 'member:' + row.id,
    kind: 'member',
    fullName: row.name,
    displayName: shortDisplayName(row.name),
    role: row.professional_role || row.job_title || '',
    company: row.company || '',
    jobTitle: row.job_title || '',
    industry: row.business_sector || '',
    professionalRole: row.professional_role || '',
    lookingToMeet: Array.isArray(row.looking_to_meet) ? row.looking_to_meet : [],
    blurb: row.matchmaker_blurb || '',
    nextEvent: nextEvent || null,
    onHub: true,
    why: 'On the Hub',
  };
}

async function loadRequesterUpcomingEventIds(sb, attendeeId) {
  if (!attendeeId) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('registrations')
    .select('event_id, events!inner(id, starts_at)')
    .eq('attendee_id', attendeeId)
    .is('cancelled_at', null)
    .gte('events.starts_at', nowIso)
    .limit(30);
  if (error) return [];
  return (data || [])
    .map((r) => String(r.event_id || (r.events && r.events.id) || '').trim())
    .filter(Boolean);
}

async function loadNextEventsByAttendeeIds(sb, attendeeIds) {
  const map = new Map();
  const ids = (attendeeIds || []).filter(Boolean);
  if (!ids.length) return map;
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('registrations')
    .select('attendee_id, event_id, events!inner(id, title, starts_at)')
    .in('attendee_id', ids)
    .is('cancelled_at', null)
    .gte('events.starts_at', nowIso)
    .order('starts_at', { ascending: true, foreignTable: 'events' })
    .limit(500);
  if (error) return map;
  (data || []).forEach((row) => {
    const aid = row.attendee_id;
    if (!aid || map.has(aid)) return;
    const ev = row.events || {};
    map.set(aid, {
      eventId: String(row.event_id || ev.id || ''),
      title: ev.title || 'Upcoming event',
      dateLabel: formatDateLabel(ev.starts_at),
    });
  });
  return map;
}

async function searchMatchmaker(opts) {
  const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'supabase_not_configured', matches: [] };
  }
  const query = String(opts.query || '').trim();
  if (query.length < MIN_QUERY_LEN) {
    return { ok: false, error: 'query_too_short', message: 'Tell Hubert a bit more about who you want to meet.', matches: [] };
  }

  const sb = getSupabaseAdmin();
  const excludeAttendeeId = opts.excludeAttendeeId || null;
  const requesterEventIds = await loadRequesterUpcomingEventIds(sb, excludeAttendeeId);

  const candidates = [];

  // Active seed contacts
  try {
    const seedRes = await sb
      .from('hubert_match_seed')
      .select(
        'id, full_name, company, job_title, industry, professional_role, looking_to_meet, blurb, status'
      )
      .eq('status', 'active')
      .limit(200);
    if (!seedRes.error) {
      (seedRes.data || []).forEach((row) => candidates.push(mapSeedRow(row)));
    }
  } catch {
    /* seed table may be missing pre-migration */
  }

  // Discoverable members
  try {
    let memberQuery = sb
      .from('attendees')
      .select(
        'id, name, company, job_title, business_sector, professional_role, looking_to_meet, matchmaker_blurb, discoverable_at'
      )
      .not('discoverable_at', 'is', null)
      .limit(200);
    if (excludeAttendeeId) memberQuery = memberQuery.neq('id', excludeAttendeeId);
    const memberRes = await memberQuery;
    if (!memberRes.error) {
      const rows = memberRes.data || [];
      const nextMap = await loadNextEventsByAttendeeIds(
        sb,
        rows.map((r) => r.id)
      );
      rows.forEach((row) => {
        if (!row.name) return;
        candidates.push(mapMemberRow(row, nextMap.get(row.id) || null));
      });
    }
  } catch {
    /* discoverable columns may be missing pre-migration */
  }

  const matches = rankCandidates(candidates, query, requesterEventIds);
  return {
    ok: true,
    query,
    matches,
    meta: {
      max: MAX_SHORTLIST,
      candidateCount: candidates.length,
      requesterUpcomingEvents: requesterEventIds.length,
    },
  };
}

module.exports = {
  MAX_SHORTLIST,
  MIN_QUERY_LEN,
  shortDisplayName,
  tokenize,
  scoreAgainstQuery,
  eventBoost,
  rankCandidates,
  mapSeedRow,
  mapMemberRow,
  searchMatchmaker,
};
