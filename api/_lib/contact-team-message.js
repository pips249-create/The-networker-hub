/**
 * Contact page — message Rosie & Catherine via Resend.
 * Always delivers to the public support inbox (not env overrides).
 */
const { sendViaResend } = require('./send-template-email');
const { SUPPORT_EMAIL } = require('./hub-brand');

const TEAM_INBOX = String(SUPPORT_EMAIL || 'hi@thenetworkeruk.com')
  .trim()
  .toLowerCase();

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

async function submitContactTeamMessage(body) {
  const input = normalizeInput(body);
  const check = validateInput(input);
  if (!check.ok) return check;
  if (check.honeypot) {
    return { ok: true, message: 'Thanks — we have your message.' };
  }

  await sendViaResend({
    to: TEAM_INBOX,
    subject: 'Contact from ' + input.name,
    html: buildStaffEmailHtml(input),
    replyTo: input.email,
    skipAllowlist: true,
    tags: [{ name: 'category', value: 'contact_team' }],
  });

  return {
    ok: true,
    message: 'Thanks — Rosie and Catherine will pick this up during office hours.',
  };
}

module.exports = {
  submitContactTeamMessage,
  TEAM_INBOX,
};
