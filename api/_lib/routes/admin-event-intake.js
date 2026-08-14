/**
 * Admin — event intake submissions from /add-your-event.
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

function mapRow(row) {
  return {
    id: row.id,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone || null,
    groupName: row.group_name,
    organiserWebsiteUrl: row.organiser_website_url || null,
    eventTitle: row.event_title,
    eventDates: row.event_dates,
    startTime: row.start_time || null,
    endTime: row.end_time || null,
    format: row.format || 'In person',
    venue: row.venue || null,
    addressLine1: row.address_line1 || null,
    city: row.city || null,
    postcode: row.postcode || null,
    meetingLink: row.meeting_link || null,
    attendanceDoor: row.attendance_door || 'general',
    payHow: row.pay_how || null,
    maxPlaces: row.max_places || null,
    freeTrialVisits: row.free_trial_visits || 'no',
    freeTrialDetails: row.free_trial_details || null,
    pricing: row.pricing || 'Free',
    ticketDetails: row.ticket_details || null,
    description: row.description || null,
    photoUrl: row.photo_url || null,
    notes: row.notes || null,
    status: row.status || 'open',
    source: row.source || 'add_your_event',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
  };
}

const INTAKE_SELECT =
  'id, contact_name, email, phone, group_name, organiser_website_url, event_title, event_dates, start_time, end_time, format, venue, address_line1, city, postcode, meeting_link, attendance_door, pay_how, max_places, free_trial_visits, free_trial_details, pricing, ticket_details, description, photo_url, notes, status, source, created_at, resolved_at, resolved_by';
const INTAKE_SELECT_LEGACY = INTAKE_SELECT.replace('pay_how, max_places, ', 'pay_how, ');

async function listEventIntake(limit, status) {
  const sb = getSupabaseAdmin();
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const statusFilter = String(status || '').trim().toLowerCase();

  async function run(selectCols) {
    let query = sb
      .from('event_intake_submissions')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .limit(max);
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    return query;
  }

  let res = await run(INTAKE_SELECT);
  if (res.error && /max_places/i.test(res.error.message || '')) {
    res = await run(INTAKE_SELECT_LEGACY);
  }
  if (res.error) {
    if (/event_intake_submissions/i.test(res.error.message || '')) {
      const err = new Error('event_intake_table_missing');
      err.code = 'event_intake_table_missing';
      throw err;
    }
    throw new Error(res.error.message);
  }

  const submissions = (res.data || []).map(mapRow);
  const openCount = submissions.filter((row) => row.status === 'open').length;

  return {
    ok: true,
    configured: true,
    total: submissions.length,
    openCount,
    submissions,
  };
}

async function updateEventIntakeStatus(id, status, session) {
  const allowed = { open: true, done: true, spam: true };
  const next = String(status || '').trim().toLowerCase();
  if (!allowed[next]) {
    const err = new Error('invalid_status');
    err.code = 'invalid_status';
    throw err;
  }

  const sb = getSupabaseAdmin();
  const patch = {
    status: next,
    resolved_at: next === 'open' ? null : new Date().toISOString(),
    resolved_by:
      next === 'open'
        ? null
        : String((session && (session.email || session.userEmail || session.sub)) || 'admin').trim(),
  };

  let { data, error } = await sb
    .from('event_intake_submissions')
    .update(patch)
    .eq('id', id)
    .select(INTAKE_SELECT)
    .single();

  if (error && /max_places/i.test(error.message || '')) {
    const retry = await sb
      .from('event_intake_submissions')
      .update(patch)
      .eq('id', id)
      .select(INTAKE_SELECT_LEGACY)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  return { ok: true, submission: mapRow(data) };
}

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    if (req.method === 'GET') {
      const overview = await listEventIntake(req.query && req.query.limit, req.query && req.query.status);
      return json(res, 200, overview);
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = parseBody(req);
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
      const result = await updateEventIntakeStatus(id, body.status, session);
      return json(res, 200, result);
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    if (e.code === 'event_intake_table_missing') {
      return json(res, 503, {
        ok: false,
        error: 'event_intake_table_missing',
        message: 'Run migrations 243_event_intake_submissions.sql and 249_event_intake_ticket_flow.sql in Supabase.',
      });
    }
    if (e.code === 'invalid_status') {
      return json(res, 400, { ok: false, error: 'invalid_status', message: 'Status must be open, done, or spam.' });
    }
    return json(res, 500, { ok: false, error: 'event_intake_failed', message: e.message });
  }
};
