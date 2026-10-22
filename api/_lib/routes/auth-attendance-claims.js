const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  createAttendanceClaim,
  listClaimsForAttendee,
  searchClaimablePastEvents,
  searchClaimableOrganisers,
  computeNetworkedScoreForAttendee,
} = require('../attendance-claims');
const { getSupabaseAdmin } = require('../supabase');
const { resolveAttendeeId } = require('../supabase-favourites');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function clientError(code) {
  const map = {
    missing_event_id: 'Choose an event to claim.',
    event_not_found: 'That event could not be found.',
    event_not_claimable: 'Only published past events can be claimed.',
    event_not_finished: 'You can claim attendance after the event has finished.',
    claim_window_expired: 'That event is too old to claim (within 90 days).',
    missing_organiser: 'This event has no organiser profile to confirm attendance.',
    cannot_claim_own_event: 'You cannot claim attendance at your own group’s event.',
    did_not_attend: 'This booking was marked as did not attend.',
    use_verified_review: 'You already have a Hub ticket for this event — leave a verified review instead.',
    review_already_submitted: 'You have already reviewed this event.',
    claim_already_pending: 'You already have an open claim for this event.',
    claim_already_confirmed: 'This attendance claim was already confirmed.',
    too_many_open_claims: 'You already have 3 open claims. Wait for organisers to respond.',
    claim_rate_limited: 'You can start up to 5 claims every 30 days.',
    claim_email_failed: 'We could not email the organiser. Try again shortly.',
    attendee_not_found: 'Create or finish your attendee profile first.',
    supabase_not_configured: 'Claims are temporarily unavailable.',
  };
  return map[code] || null;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://internal.local');
      const action = String(url.searchParams.get('action') || '').trim();

      if (action === 'search-organisers' || action === 'suggest-organisers') {
        const organisers = await searchClaimableOrganisers(session, {
          q: url.searchParams.get('q') || '',
        });
        return json(res, 200, {
          ok: true,
          organisers,
          suggested: !String(url.searchParams.get('q') || '').trim(),
        });
      }

      if (action === 'search') {
        const organiserId = url.searchParams.get('organiserId') || '';
        if (!organiserId) {
          return json(res, 200, {
            ok: true,
            events: [],
            message: 'Pick a group first, then choose an event.',
          });
        }
        const result = await searchClaimablePastEvents(session, {
          organiserId,
          date: url.searchParams.get('date') || url.searchParams.get('on') || '',
          q: url.searchParams.get('q') || '',
        });
        return json(res, 200, {
          ok: true,
          events: result.events || [],
          filteredByDate: !!result.filteredByDate,
          windowDays: result.windowDays || 90,
          blockedCount: result.blockedCount || 0,
        });
      }

      const [claims, networked] = await Promise.all([
        listClaimsForAttendee(session),
        (async () => {
          const sb = getSupabaseAdmin();
          const attendeeId = await resolveAttendeeId(sb, session);
          if (!attendeeId) return null;
          return computeNetworkedScoreForAttendee(sb, attendeeId);
        })(),
      ]);
      return json(res, 200, { ok: true, claims, networked });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const claim = await createAttendanceClaim(session, body);
      return json(res, 200, { ok: true, claim });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    const code = e.code || e.message || 'claim_failed';
    const message = clientError(code);
    if (message) {
      return json(res, 400, { ok: false, error: code, message });
    }
    return json(res, 500, { ok: false, error: 'claim_failed', message: e.message || String(e) });
  }
};
