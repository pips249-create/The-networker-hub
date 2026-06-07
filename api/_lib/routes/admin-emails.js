const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  listEmailTemplates,
  getEmailTemplateBySlug,
  updateEmailTemplate,
} = require('../supabase-email-templates');
const { buildEmailFromTemplate, sendTemplatedEmail } = require('../send-template-email');

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

function slugFromRequest(req) {
  if (req.query && req.query.slug) return String(req.query.slug).trim();
  try {
    const url = new URL(req.url, 'https://internal.local');
    return String(url.searchParams.get('slug') || '').trim();
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method === 'GET') {
    try {
      const slug = slugFromRequest(req);
      if (slug) {
        const template = await getEmailTemplateBySlug(slug);
        if (!template) return json(res, 404, { ok: false, error: 'template_not_found' });
        return json(res, 200, { ok: true, template });
      }
      const templates = await listEmailTemplates();
      return json(res, 200, { ok: true, templates });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'email_templates_load_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const slug = String(body.slug || slugFromRequest(req)).trim();
    if (!slug) return json(res, 400, { ok: false, error: 'missing_slug' });

    const subject = body.subject != null ? String(body.subject) : null;
    const bodyHtml = body.body_html != null ? String(body.body_html) : null;
    if (subject == null && bodyHtml == null) {
      return json(res, 400, { ok: false, error: 'nothing_to_update' });
    }

    try {
      const template = await updateEmailTemplate(slug, {
        subject,
        body_html: bodyHtml,
        name: body.name,
        description: body.description,
      });
      if (!template) return json(res, 404, { ok: false, error: 'template_not_found' });
      return json(res, 200, { ok: true, template });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'email_template_save_failed', message: e.message });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const action = String(body.action || 'test').trim();

    if (action === 'preview') {
      const slug = String(body.slug || '').trim();
      if (!slug) return json(res, 400, { ok: false, error: 'missing_slug' });
      try {
        const built = await buildEmailFromTemplate(slug, body.variables || {});
        return json(res, 200, {
          ok: true,
          slug,
          subject: built.subject,
          html: built.html,
          placeholders: built.template.placeholders,
        });
      } catch (e) {
        const code = e.code || 'preview_failed';
        const status = code === 'template_not_found' ? 404 : 500;
        return json(res, status, { ok: false, error: code, message: e.message });
      }
    }

    if (action === 'test') {
      const slug = String(body.slug || '').trim();
      const to = String(body.to || session.email || '').trim();
      if (!slug) return json(res, 400, { ok: false, error: 'missing_slug' });
      if (!to) return json(res, 400, { ok: false, error: 'missing_recipient' });

      try {
        const result = await sendTemplatedEmail({
          slug,
          to,
          variables: body.variables || {},
        });
        return json(res, 200, { ok: true, sent: true, ...result });
      } catch (e) {
        const code = e.code || 'send_failed';
        let status = 500;
        if (code === 'template_not_found') status = 404;
        if (code === 'resend_not_configured' || code === 'missing_recipient') status = 503;
        return json(res, status, { ok: false, error: code, message: e.message });
      }
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
