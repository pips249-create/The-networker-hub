/**
 * Hubert Matchmaker — private seed contacts (admin / Rosie).
 */

const STATUSES = new Set(['active', 'paused', 'converted', 'do_not_contact']);
const MAX_BLURB = 800;
const MAX_NOTES = 1000;

function supabaseApi() {
  return require('./supabase');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

function cleanText(value, max) {
  const s = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s.slice(0, max);
}

function cleanEmail(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s.slice(0, 320);
}

function cleanLookingToMeet(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const t = cleanText(item, 80);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  });
  return out.slice(0, 12);
}

function cleanLinkedIn(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s) && /linkedin\.com/i.test(s)) return 'https://' + s.replace(/^\/+/, '');
  if (s && !/^https?:\/\//i.test(s)) return null;
  return s.slice(0, 500);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email || '',
    company: row.company || '',
    jobTitle: row.job_title || '',
    industry: row.industry || '',
    professionalRole: row.professional_role || '',
    lookingToMeet: Array.isArray(row.looking_to_meet) ? row.looking_to_meet : [],
    linkedinUrl: row.linkedin_url || '',
    blurb: row.blurb || '',
    source: row.source || 'rosie',
    status: row.status || 'active',
    reminderSentAt: row.reminder_sent_at || null,
    pausedAt: row.paused_at || null,
    pauseReason: row.pause_reason || '',
    convertedAttendeeId: row.converted_attendee_id || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSeedInput(body, opts) {
  const partial = Boolean(opts && opts.partial);
  const errors = {};
  const fields = {};

  if (!partial || body.fullName != null || body.name != null) {
    const fullName = cleanText(body.fullName != null ? body.fullName : body.name, 120);
    if (!fullName) errors.fullName = 'required';
    else fields.full_name = fullName;
  }

  if (!partial || body.email != null) {
    const email = cleanEmail(body.email);
    if (email === null) errors.email = 'invalid';
    else fields.email = email || null;
  }

  if (!partial || body.company != null) fields.company = cleanText(body.company, 160) || null;
  if (!partial || body.jobTitle != null || body.job_title != null) {
    fields.job_title = cleanText(body.jobTitle != null ? body.jobTitle : body.job_title, 120) || null;
  }
  if (!partial || body.industry != null) fields.industry = cleanText(body.industry, 120) || null;
  if (!partial || body.professionalRole != null || body.professional_role != null) {
    fields.professional_role =
      cleanText(
        body.professionalRole != null ? body.professionalRole : body.professional_role,
        80
      ) || null;
  }
  if (!partial || body.lookingToMeet != null || body.looking_to_meet != null) {
    fields.looking_to_meet = cleanLookingToMeet(
      body.lookingToMeet != null ? body.lookingToMeet : body.looking_to_meet
    );
  }
  if (!partial || body.linkedinUrl != null || body.linkedin_url != null) {
    const li = cleanLinkedIn(body.linkedinUrl != null ? body.linkedinUrl : body.linkedin_url);
    if (li === null) errors.linkedinUrl = 'invalid';
    else fields.linkedin_url = li || null;
  }
  if (!partial || body.blurb != null) fields.blurb = cleanText(body.blurb, MAX_BLURB) || null;
  if (!partial || body.notes != null) fields.notes = cleanText(body.notes, MAX_NOTES) || null;
  if (!partial || body.source != null) fields.source = cleanText(body.source, 40) || 'rosie';
  if (!partial || body.status != null) {
    const status = String(body.status || '').trim().toLowerCase();
    if (!STATUSES.has(status)) errors.status = 'invalid';
    else {
      fields.status = status;
      if (status === 'paused' || status === 'do_not_contact') {
        fields.paused_at = new Date().toISOString();
        if (body.pauseReason != null || body.pause_reason != null) {
          fields.pause_reason =
            cleanText(body.pauseReason != null ? body.pauseReason : body.pause_reason, 200) || null;
        }
      }
      if (status === 'active') {
        fields.paused_at = null;
        fields.pause_reason = null;
      }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, fields };
}

async function listSeedContacts(opts) {
  const { getSupabaseAdmin, isSupabaseConfigured } = supabaseApi();
  if (!isSupabaseConfigured()) return { configured: false, contacts: [], totals: {} };
  const sb = getSupabaseAdmin();
  const status = opts && opts.status ? String(opts.status).trim().toLowerCase() : '';
  const q = opts && opts.q ? String(opts.q).trim() : '';
  const limit = Math.min(500, Math.max(1, parseInt(opts && opts.limit, 10) || 200));

  let query = sb
    .from('hubert_match_seed')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (status && STATUSES.has(status)) query = query.eq('status', status);
  if (q) {
    const like = '%' + q.replace(/%/g, '') + '%';
    query = query.or(
      ['full_name.ilike.' + like, 'email.ilike.' + like, 'company.ilike.' + like, 'industry.ilike.' + like].join(
        ','
      )
    );
  }

  const { data, error } = await query;
  if (error) {
    if (/hubert_match_seed/i.test(error.message || '')) {
      const err = new Error('seed_table_missing');
      err.code = 'seed_table_missing';
      throw err;
    }
    throw new Error(error.message);
  }

  const contacts = (data || []).map(mapRow);
  const totals = { total: contacts.length, active: 0, paused: 0, converted: 0, do_not_contact: 0 };
  contacts.forEach((c) => {
    if (totals[c.status] != null) totals[c.status] += 1;
  });

  return { configured: true, contacts, totals };
}

async function createSeedContact(fields, userId) {
  const { getSupabaseAdmin } = supabaseApi();
  const sb = getSupabaseAdmin();
  const payload = {
    ...fields,
    created_by_user_id: userId && isUuid(userId) ? userId : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('hubert_match_seed').insert(payload).select('*').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      const err = new Error('email_exists');
      err.status = 409;
      throw err;
    }
    throw new Error(error.message);
  }
  return mapRow(data);
}

async function updateSeedContact(id, fields) {
  if (!isUuid(id)) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }
  const { getSupabaseAdmin } = supabaseApi();
  const sb = getSupabaseAdmin();
  const payload = { ...fields, updated_at: new Date().toISOString() };
  const { data, error } = await sb
    .from('hubert_match_seed')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      const err = new Error('email_exists');
      err.status = 409;
      throw err;
    }
    throw new Error(error.message);
  }
  if (!data) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  return mapRow(data);
}

async function deleteSeedContact(id) {
  if (!isUuid(id)) {
    const err = new Error('invalid_id');
    err.status = 400;
    throw err;
  }
  const { getSupabaseAdmin } = supabaseApi();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('hubert_match_seed').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  return data.id;
}

module.exports = {
  STATUSES,
  isUuid,
  normalizeSeedInput,
  listSeedContacts,
  createSeedContact,
  updateSeedContact,
  deleteSeedContact,
  mapRow,
};
