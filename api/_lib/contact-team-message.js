/**
 * Contact page — message Rosie & Catherine via Resend.
 *
 * Delivery:
 * - CONTACT_TEAM_EMAIL (comma-separated) overrides recipients when set
 * - otherwise SUPPORT_EMAIL env / brand support inbox, plus Catherine & Rosie
 *   so messages are not lost if hi@ is not forwarded yet
 * - also sends a short confirmation to the submitter
 */
const { sendViaResend } = require('./send-template-email');
const { SUPPORT_EMAIL } = require('./hub-brand');
const { supportEmail } = require('./hub-email-urls');

const DEFAULT_TEAM_FALLBACKS = [
  'catherine@thenetworkeruk.com',
  'rosie@thenetworkeruk.com',
];

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseRecipientList(raw) {
  return String(raw || '')
    .split(/[,;]+/)
    .map(normalizeEmail)
    .filter(isValidEmail);
}

function uniqueEmails(emails) {
  const seen = new Set();
  const out = [];
  (emails || []).forEach(function (email) {
    const key = normalizeEmail(email);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

/**
 * Who receives contact-form staff notifications.
 * Prefer CONTACT_TEAM_EMAIL when set; otherwise support inbox + directors.
 */
function resolveTeamRecipients() {
  const fromEnv = parseRecipientList(process.env.CONTACT_TEAM_EMAIL);
  if (fromEnv.length) return fromEnv;

  const primary = normalizeEmail(supportEmail() || SUPPORT_EMAIL || 'hi@thenetworkeruk.com');
  return uniqueEmails([primary].concat(DEFAULT_TEAM_FALLBACKS));
}

function normalizeInput(body) {
  body = body || {};
  return {
    name: String(body.name || body.contactName || '').trim(),
    email: normalizeEmail(body.email),
    message: String(body.message || '').trim(),
    website: String(body.website || body.company_url || '').trim(),
  };
}

function validateInput(input) {
  if (input.website) {
    return { ok: true, honeypot: true };
  }
  if (!input.name) {
    return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  }
  if (!isValidEmail(input.email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }
  if (!input.message || input.message.length < 5) {
    return { ok: false, error: 'missing_message', message: 'Enter a short message for the team.' };
  }
  if (input.message.length > 4000) {
    return { ok: false, error: 'message_too_long', message: 'Keep your message under 4000 characters.' };
  }
  return { ok: true };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">Contact form message</h2>' +
    '<table style="border-collapse:collapse;width:100%;max-width:520px;">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>' +
    escHtml(input.name) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:' +
    escHtml(input.email) +
    '">' +
    escHtml(input.email) +
    '</a></td></tr>' +
    '</table>' +
    '<p style="margin:16px 0 0;"><strong>Message</strong><br>' +
    escHtml(input.message).replace(/\n/g, '<br>') +
    '</p>' +
    '</div>'
  );
}

function buildConfirmationEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;">' +
    '<p style="margin:0 0 12px;">Hi ' +
    escHtml(input.name) +
    ',</p>' +
    '<p style="margin:0 0 12px;">Thanks for contacting The Networker UK. Rosie and Catherine have your message and will pick it up during office hours (Mon–Fri, 9am–5pm UK).</p>' +
    '<p style="margin:0 0 12px;">If it is urgent, reply to this email or write to <a href="mailto:hi@thenetworkeruk.com">hi@thenetworkeruk.com</a>.</p>' +
    '<p style="margin:0;">The Networker UK<br><a href="https://www.thenetworkeruk.com/contact">thenetworkeruk.com/contact</a></p>' +
    '</div>'
  );
}

async function sendStaffNotifications(input, recipients) {
  const subject = 'Contact from ' + input.name;
  const html = buildStaffEmailHtml(input);
  const results = [];

  for (let i = 0; i < recipients.length; i += 1) {
    const to = recipients[i];
    try {
      await sendViaResend({
        to,
        subject,
        html,
        replyTo: input.email,
        skipAllowlist: true,
        tags: [{ name: 'category', value: 'contact_team' }],
      });
      results.push({ to, ok: true });
    } catch (e) {
      console.error('[contact-team-message-staff]', to, e && e.message ? e.message : e);
      results.push({ to, ok: false, error: e && e.message ? e.message : 'send_failed' });
    }
  }

  return results;
}

async function submitContactTeamMessage(body) {
  const input = normalizeInput(body);
  const check = validateInput(input);
  if (!check.ok) return check;
  if (check.honeypot) {
    return { ok: true, message: 'Thanks — we have your message.' };
  }

  const recipients = resolveTeamRecipients();
  if (!recipients.length) {
    const err = new Error('Contact team inbox is not configured.');
    err.code = 'contact_inbox_missing';
    throw err;
  }

  const staffResults = await sendStaffNotifications(input, recipients);
  const delivered = staffResults.some(function (row) {
    return row.ok;
  });
  if (!delivered) {
    const err = new Error('Could not deliver your message to the team.');
    err.code = 'contact_delivery_failed';
    throw err;
  }

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your message — The Networker UK',
      html: buildConfirmationEmailHtml(input),
      replyTo: recipients[0],
      skipAllowlist: true,
      tags: [{ name: 'category', value: 'contact_team_confirm' }],
    });
  } catch (e) {
    console.error('[contact-team-message-confirm]', e && e.message ? e.message : e);
  }

  return {
    ok: true,
    message: 'Thanks — Rosie and Catherine will pick this up during office hours.',
  };
}

module.exports = {
  submitContactTeamMessage,
  resolveTeamRecipients,
  TEAM_INBOX: normalizeEmail(SUPPORT_EMAIL || 'hi@thenetworkeruk.com'),
};
