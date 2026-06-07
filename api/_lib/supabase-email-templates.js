const { getSupabaseAdmin } = require('./supabase');

function rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    subject: row.subject || '',
    body_html: row.body_html || '',
    placeholders: Array.isArray(row.placeholders) ? row.placeholders : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listEmailTemplates() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_templates')
    .select('id, slug, name, description, subject, body_html, placeholders, created_at, updated_at')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToTemplate);
}

async function getEmailTemplateBySlug(slug) {
  const key = String(slug || '').trim();
  if (!key) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_templates')
    .select('id, slug, name, description, subject, body_html, placeholders, created_at, updated_at')
    .eq('slug', key)
    .maybeSingle();
  if (error) throw error;
  return rowToTemplate(data);
}

async function updateEmailTemplate(slug, patch) {
  const key = String(slug || '').trim();
  if (!key) throw new Error('missing_slug');

  const updates = { updated_at: new Date().toISOString() };
  if (patch.subject != null) updates.subject = String(patch.subject);
  if (patch.body_html != null) updates.body_html = String(patch.body_html);
  if (patch.name != null) updates.name = String(patch.name).trim() || key;
  if (patch.description != null) updates.description = String(patch.description);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('email_templates')
    .update(updates)
    .eq('slug', key)
    .select('id, slug, name, description, subject, body_html, placeholders, created_at, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToTemplate(data);
}

module.exports = {
  listEmailTemplates,
  getEmailTemplateBySlug,
  updateEmailTemplate,
};
