const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

const COMPLAINT_CATEGORIES = new Set([
  'platform',
  'refund',
  'listing',
  'advertising',
  'data_protection',
  'payments',
  'accessibility',
  'other',
]);

const COMPLAINT_STATUSES = new Set([
  'open',
  'investigating',
  'awaiting_third_party',
  'resolved',
  'escalated',
  'closed',
]);

const COMPLAINT_OUTCOMES = new Set(['upheld', 'partly_upheld', 'not_upheld', 'referred']);

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

function queryFromRequest(req) {
  const q = { ...(req.query || {}) };
  if (req.url) {
    try {
      const url = new URL(req.url, 'https://internal.local');
      url.searchParams.forEach((value, key) => {
        if (q[key] == null || q[key] === '') q[key] = value;
      });
    } catch {
      /* ignore */
    }
  }
  return q;
}

function mapComplaint(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    complainantName: row.complainant_name || '',
    complainantEmail: row.complainant_email || '',
    category: row.category,
    subject: row.subject || '',
    body: row.body || '',
    relatedRegistrationId: row.related_registration_id,
    relatedEventId: row.related_event_id,
    relatedOpportunityId: row.related_opportunity_id,
    relatedReference: row.related_reference || '',
    acknowledgementSentAt: row.acknowledgement_sent_at,
    dueDate: row.due_date,
    status: row.status,
    outcome: row.outcome,
    assignedTo: row.assigned_to || '',
    notes: row.notes || '',
    resolutionSummary: row.resolution_summary || '',
    closedAt: row.closed_at,
    createdByEmail: row.created_by_email || '',
  };
}

function isMissingTableError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  return /could not find the table|schema cache|relation .* does not exist/.test(msg);
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    const query = queryFromRequest(req);
    const status = String(query.status || '').trim();
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 200);

    let q = sb
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status === 'open') {
      q = q.not('status', 'in', '("resolved","closed")');
    } else if (status && COMPLAINT_STATUSES.has(status)) {
      q = q.eq('status', status);
    }

    try {
      const { data, error } = await q;
      if (error) {
        if (isMissingTableError(error)) {
          return json(res, 200, {
            ok: true,
            configured: false,
            complaints: [],
            message: 'Run migration 138_complaints_register.sql in Supabase.',
          });
        }
        throw new Error(error.message);
      }
      return json(res, 200, {
        ok: true,
        complaints: (data || []).map(mapComplaint),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'complaints_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const complainantEmail = String(body.complainantEmail || body.complainant_email || '').trim();
    if (!complainantEmail) {
      return json(res, 400, { ok: false, error: 'missing_complainant_email' });
    }

    const category = String(body.category || 'other').trim();
    if (!COMPLAINT_CATEGORIES.has(category)) {
      return json(res, 400, { ok: false, error: 'invalid_category' });
    }

    const row = {
      complainant_name: String(body.complainantName || body.complainant_name || '').trim(),
      complainant_email: complainantEmail,
      category,
      subject: String(body.subject || '').trim(),
      body: String(body.body || '').trim(),
      related_registration_id: body.relatedRegistrationId || body.related_registration_id || null,
      related_event_id: body.relatedEventId || body.related_event_id || null,
      related_opportunity_id: body.relatedOpportunityId || body.related_opportunity_id || null,
      related_reference: String(body.relatedReference || body.related_reference || '').trim() || null,
      assigned_to: String(body.assignedTo || body.assigned_to || '').trim() || null,
      notes: String(body.notes || '').trim() || null,
      status: 'open',
      created_by_user_id: session.userId || null,
      created_by_email: session.email || null,
    };

    if (body.acknowledgementSent || body.acknowledgement_sent) {
      row.acknowledgement_sent_at = new Date().toISOString();
    }

    try {
      const { data, error } = await sb.from('complaints').insert(row).select('*').single();
      if (error) {
        if (isMissingTableError(error)) {
          return json(res, 503, {
            ok: false,
            error: 'complaints_table_missing',
            message: 'Run migration 138_complaints_register.sql in Supabase.',
          });
        }
        throw new Error(error.message);
      }
      return json(res, 201, { ok: true, complaint: mapComplaint(data) });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'complaint_create_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { ok: false, error: 'missing_id' });

    const patch = {};

    if (body.complainantName != null || body.complainant_name != null) {
      patch.complainant_name = String(body.complainantName ?? body.complainant_name).trim();
    }
    if (body.complainantEmail != null || body.complainant_email != null) {
      patch.complainant_email = String(body.complainantEmail ?? body.complainant_email).trim();
    }
    if (body.category != null) {
      const category = String(body.category).trim();
      if (!COMPLAINT_CATEGORIES.has(category)) {
        return json(res, 400, { ok: false, error: 'invalid_category' });
      }
      patch.category = category;
    }
    if (body.subject != null) patch.subject = String(body.subject).trim();
    if (body.body != null) patch.body = String(body.body).trim();
    if (body.relatedReference != null || body.related_reference != null) {
      patch.related_reference =
        String(body.relatedReference ?? body.related_reference).trim() || null;
    }
    if (body.assignedTo != null || body.assigned_to != null) {
      patch.assigned_to = String(body.assignedTo ?? body.assigned_to).trim() || null;
    }
    if (body.notes != null) patch.notes = String(body.notes).trim() || null;
    if (body.resolutionSummary != null || body.resolution_summary != null) {
      patch.resolution_summary = String(body.resolutionSummary ?? body.resolution_summary).trim() || null;
    }
    if (body.dueDate != null || body.due_date != null) {
      const due = String(body.dueDate ?? body.due_date).trim();
      patch.due_date = due || null;
    }

    if (body.status != null) {
      const status = String(body.status).trim();
      if (!COMPLAINT_STATUSES.has(status)) {
        return json(res, 400, { ok: false, error: 'invalid_status' });
      }
      patch.status = status;
    }

    if (body.outcome != null) {
      const outcome = String(body.outcome).trim();
      if (outcome && !COMPLAINT_OUTCOMES.has(outcome)) {
        return json(res, 400, { ok: false, error: 'invalid_outcome' });
      }
      patch.outcome = outcome || null;
    }

    if (body.acknowledgementSent === true || body.acknowledgement_sent === true) {
      patch.acknowledgement_sent_at = new Date().toISOString();
    }

    if (!Object.keys(patch).length) {
      return json(res, 400, { ok: false, error: 'no_fields_to_update' });
    }

    try {
      const { data, error } = await sb
        .from('complaints')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (!data) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, complaint: mapComplaint(data) });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'complaint_update_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
