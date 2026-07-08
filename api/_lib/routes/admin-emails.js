const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  listEmailTemplates,
  getEmailTemplateBySlug,
  updateEmailTemplate,
} = require('../supabase-email-templates');
const {
  listEmailTestRecipients,
  isEmailTestRecipientAllowed,
  addEmailTestRecipient,
  removeEmailTestRecipient,
} = require('../supabase-email-test-recipients');
const { buildEmailFromTemplate, sendTemplatedEmail } = require('../send-template-email');
const { mergeEmailPreviewVariables } = require('../email-preview-variables');
const { getEmailSponsorVars } = require('../email-sponsor-sections');
const { emailConfigStatus } = require('../email-config');

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
      const listTestRecipients =
        req.query && String(req.query.test_recipients || '').trim() === '1';
      if (listTestRecipients) {
        const testRecipients = await listEmailTestRecipients();
        return json(res, 200, { ok: true, testRecipients });
      }
      if (slug) {
        const template = await getEmailTemplateBySlug(slug);
        if (!template) return json(res, 404, { ok: false, error: 'template_not_found' });
        return json(res, 200, { ok: true, template });
      }
      const templates = await listEmailTemplates();
      let testRecipients = [];
      let testRecipientsWarning = '';
      try {
        testRecipients = await listEmailTestRecipients();
      } catch (e) {
        if (/email_test_recipients/i.test(e.message || '')) {
          testRecipientsWarning =
            'Safe test list table not found — run migrations 051 and 052 in Supabase.';
        } else {
          throw e;
        }
      }
      return json(res, 200, {
        ok: true,
        templates,
        testRecipients,
        testRecipientsWarning,
        emailSendingConfigured: emailConfigStatus().emailSendingConfigured,
      });
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
        const variables = mergeEmailPreviewVariables(slug, body.variables || {});
        const built = await buildEmailFromTemplate(slug, variables, {
          subject: body.subject,
          body_html: body.body_html,
        });
        return json(res, 200, {
          ok: true,
          slug,
          subject: built.subject,
          html: built.html,
          placeholders: built.template.placeholders,
          template_source: built.templateSource,
        });
      } catch (e) {
        const code = e.code || 'preview_failed';
        const status = code === 'template_not_found' ? 404 : 500;
        return json(res, status, { ok: false, error: code, message: e.message });
      }
    }

    if (action === 'add_test_recipient') {
      const email = String(body.email || '').trim();
      const label = body.label != null ? String(body.label).trim() : '';
      if (!email) return json(res, 400, { ok: false, error: 'missing_email' });
      try {
        const recipient = await addEmailTestRecipient({
          email,
          label,
          addedBy: session.email || '',
        });
        return json(res, 200, { ok: true, recipient });
      } catch (e) {
        const code = e.code || 'add_test_recipient_failed';
        const status = code === 'invalid_email' || code === 'email_already_listed' ? 400 : 500;
        return json(res, status, { ok: false, error: code, message: e.message });
      }
    }

    if (action === 'remove_test_recipient') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
      try {
        await removeEmailTestRecipient(id);
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, 500, { ok: false, error: 'remove_test_recipient_failed', message: e.message });
      }
    }

    if (action === 'test') {
      const slug = String(body.slug || '').trim();
      const to = String(body.to || session.email || '')
        .trim()
        .toLowerCase();
      if (!slug) return json(res, 400, { ok: false, error: 'missing_slug' });
      if (!to) return json(res, 400, { ok: false, error: 'missing_recipient' });

      try {
        let allowed = false;
        try {
          allowed = await isEmailTestRecipientAllowed(to);
        } catch (e) {
          if (/email_test_recipients/i.test(e.message || '')) {
            return json(res, 503, {
              ok: false,
              error: 'test_recipients_table_missing',
              message:
                'Safe test list is not set up yet. Run migrations 051_email_test_recipients.sql and 052_email_test_recipients_seed.sql in Supabase.',
            });
          }
          throw e;
        }
        if (!allowed) {
          return json(res, 403, {
            ok: false,
            error: 'recipient_not_allowed',
            message:
              'This address is not on the safe test list. Add it under Safe test recipients first.',
          });
        }
        const previewVars = mergeEmailPreviewVariables(slug, body.variables || {});
        const sponsorVars = await getEmailSponsorVars(slug);
        if (String(sponsorVars.sponsor_row || '').trim()) {
          previewVars.sponsor_row = sponsorVars.sponsor_row;
          previewVars.sponsor_section = sponsorVars.sponsor_row;
        }
        if (String(sponsorVars.mini_sponsors_row || '').trim()) {
          previewVars.mini_sponsors_row = sponsorVars.mini_sponsors_row;
        }
        const result = await sendTemplatedEmail({
          slug,
          to,
          variables: previewVars,
          skipEmailCheck: true,
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
