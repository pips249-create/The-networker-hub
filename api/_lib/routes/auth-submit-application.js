const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { createApplicationFromSubmission } = require('../supabase-application-submissions');

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

function statusForError(code) {
  if (code === 'not_authenticated') return 401;
  if (
    code === 'invalid_event_id' ||
    code === 'invalid_ticket_id' ||
    code === 'missing_industry' ||
    code === 'missing_job_title' ||
    code === 'missing_email'
  ) {
    return 400;
  }
  if (code === 'event_not_found' || code === 'ticket_not_found') return 404;
  if (
    code === 'event_not_published' ||
    code === 'not_application_ticket' ||
    code === 'applications_not_open' ||
    code === 'applications_closed' ||
    code === 'applications_full' ||
    code === 'already_applied'
  ) {
    return 400;
  }
  return 500;
}

function messageForError(code) {
  const messages = {
    not_authenticated: 'Please sign in to apply.',
    missing_email: 'We could not find your account email.',
    missing_industry: 'Please tell us what industry you are in.',
    missing_job_title: 'Please tell us your job title.',
    event_not_found: 'This event could not be found.',
    ticket_not_found: 'This ticket could not be found.',
    event_not_published: 'Applications are not open for this event.',
    not_application_ticket: 'This event does not accept applications.',
    applications_not_open: 'Applications are not open yet for this event.',
    applications_closed: 'Applications have closed for this event.',
    applications_full: 'All places have been taken for this event.',
    already_applied: 'You have already applied for this event.',
  };
  return messages[code] || 'Could not submit your application. Please try again.';
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }
  if (!session) {
    return json(res, 401, { ok: false, error: 'not_authenticated', message: messageForError('not_authenticated') });
  }

  try {
    const body = parseBody(req);
    const email = String(session.email || body.email || '')
      .trim()
      .toLowerCase();
    let name = String(session.name || body.name || '').trim();
    if (!name && email) {
      const local = email.split('@')[0] || '';
      name = local.replace(/[._-]+/g, ' ').trim() || 'Guest';
    }

    const result = await createApplicationFromSubmission({
      email,
      name,
      userId: session.sub || null,
      eventId: body.eventId || body.event_id,
      ticketId: body.ticketId || body.ticket_id,
      industry: body.industry || body.screening_answer_industry,
      jobTitle: body.jobTitle || body.job_title || body.screening_answer_job_title,
    });

    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    const code = e.code || e.message || 'application_failed';
    return json(res, statusForError(code), {
      ok: false,
      error: code,
      message: messageForError(code),
    });
  }
};
