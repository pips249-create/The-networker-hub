const { getSupabaseAdmin } = require('./supabase');

function rowToRecipient(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: String(row.email || '').trim().toLowerCase(),
    label: row.label || '',
    added_by: row.added_by || '',
    created_at: row.created_at,
  };
}

async function listEmailTestRecipients() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_test_recipients')
    .select('id, email, label, added_by, created_at')
    .order('email', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToRecipient);
}

async function isEmailTestRecipientAllowed(email) {
  const key = String(email || '')
    .trim()
    .toLowerCase();
  if (!key) return false;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_test_recipients')
    .select('id')
    .ilike('email', key)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function addEmailTestRecipient({ email, label, addedBy }) {
  const key = String(email || '')
    .trim()
    .toLowerCase();
  if (!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    const err = new Error('invalid_email');
    err.code = 'invalid_email';
    throw err;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_test_recipients')
    .insert({
      email: key,
      label: label ? String(label).trim() : null,
      added_by: addedBy ? String(addedBy).trim() : null,
    })
    .select('id, email, label, added_by, created_at')
    .single();
  if (error) {
    if (error.code === '23505') {
      const dup = new Error('email_already_listed');
      dup.code = 'email_already_listed';
      throw dup;
    }
    throw error;
  }
  return rowToRecipient(data);
}

async function removeEmailTestRecipient(id) {
  const key = String(id || '').trim();
  if (!key) throw new Error('missing_id');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('email_test_recipients').delete().eq('id', key);
  if (error) throw error;
  return { ok: true };
}

module.exports = {
  listEmailTestRecipients,
  isEmailTestRecipientAllowed,
  addEmailTestRecipient,
  removeEmailTestRecipient,
};
