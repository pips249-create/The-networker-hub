const { getEmailTemplateBySlug } = require('./supabase-email-templates');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function replacePlaceholders(text, variables) {
  const vars = variables && typeof variables === 'object' ? variables : {};
  return String(text || '').replace(PLACEHOLDER_RE, function (match, key) {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const val = vars[key];
    if (val == null) return '';
    return String(val);
  });
}

async function buildEmailFromTemplate(slug, variables) {
  const template = await getEmailTemplateBySlug(slug);
  if (!template) {
    const err = new Error('template_not_found');
    err.code = 'template_not_found';
    throw err;
  }

  const merged = {
    site_url: process.env.SITE_URL || 'https://the-networker-hub.vercel.app',
    ...variables,
  };

  return {
    template,
    subject: replacePlaceholders(template.subject, merged),
    html: replacePlaceholders(template.body_html, merged),
  };
}

async function sendViaResend({ to, subject, html }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    const err = new Error('resend_not_configured');
    err.code = 'resend_not_configured';
    throw err;
  }

  const recipient = String(to || '')
    .trim()
    .toLowerCase();
  if (!recipient) {
    const err = new Error('missing_recipient');
    err.code = 'missing_recipient';
    throw err;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'The Networker Hub <onboarding@resend.dev>',
      to: [recipient],
      subject,
      html,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const err = new Error(
      (payload && (payload.message || payload.error)) || 'resend_send_failed'
    );
    err.code = 'resend_send_failed';
    err.details = payload;
    throw err;
  }

  return { ok: true, id: payload && payload.id, to: recipient };
}

/**
 * Fetch a template by slug, merge {{placeholders}}, and send via Resend.
 *
 * @param {object} opts
 * @param {string} opts.slug - email_templates.slug
 * @param {string} opts.to - recipient email
 * @param {object} [opts.variables] - e.g. { user_name, event_name, amount_paid }
 */
async function sendTemplatedEmail({ slug, to, variables }) {
  const built = await buildEmailFromTemplate(slug, variables);
  const result = await sendViaResend({
    to,
    subject: built.subject,
    html: built.html,
  });
  return { ...result, subject: built.subject, slug: built.template.slug };
}

module.exports = {
  replacePlaceholders,
  buildEmailFromTemplate,
  sendTemplatedEmail,
};
