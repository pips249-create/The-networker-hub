/**
 * Partner Programme enquire / apply form — email partnerships@.
 */
const { sendViaResend } = require('./send-template-email');

const PARTNERSHIPS_EMAIL = String(
  process.env.PARTNERSHIPS_EMAIL || 'partnerships@thenetworkeruk.com'
)
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
    organisation: String(body.organisation || body.company || body.companyName || '').trim(),
    audience: String(body.audience || body.how || '').trim(),
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
  if (!input.audience || input.audience.length < 10) {
    return {
      ok: false,
      error: 'missing_audience',
      message: 'Tell us briefly who you can introduce (at least a short sentence).',
    };
  }
  if (input.audience.length > 2000) {
    return {
      ok: false,
      error: 'audience_too_long',
      message: 'Keep your audience description under 2000 characters.',
    };
  }
  if (input.message && input.message.length > 4000) {
    return {
      ok: false,
      error: 'message_too_long',
      message: 'Keep your message under 4000 characters.',
    };
  }
  return { ok: true };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">Partner Programme enquiry</h2>' +
    '<table style="border-collapse:collapse;width:100%;max-width:520px;">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>' +
    escHtml(input.name) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:' +
    escHtml(input.email) +
    '">' +
    escHtml(input.email) +
    '</a></td></tr>' +
    (input.organisation
      ? '<tr><td style="padding:4px 12px 4px 0;color:#666;">Organisation</td><td>' +
        escHtml(input.organisation) +
        '</td></tr>'
      : '') +
    '</table>' +
    '<p style="margin:16px 0 0;"><strong>Who they can introduce</strong><br>' +
    escHtml(input.audience).replace(/\n/g, '<br>') +
    '</p>' +
    (input.message
      ? '<p style="margin:16px 0 0;"><strong>Message</strong><br>' +
        escHtml(input.message).replace(/\n/g, '<br>') +
        '</p>'
      : '') +
    '</div>'
  );
}

function buildConfirmationEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.55;color:#2d2636;max-width:560px;">' +
    '<p style="margin:0 0 12px;">Hi ' +
    escHtml(input.name) +
    ',</p>' +
    '<p style="margin:0 0 12px;">Thanks for your interest in The Networker UK Partner Programme. We review applications carefully and will reply from <strong>partnerships@thenetworkeruk.com</strong> if we can move forward.</p>' +
    '<p style="margin:0 0 12px;">In the meantime, you can browse our live advertising rate card at <a href="https://www.thenetworkeruk.com/advertising">thenetworkeruk.com/advertising</a>.</p>' +
    '<p style="margin:0;">The Networker UK<br><a href="https://www.thenetworkeruk.com/partners">thenetworkeruk.com/partners</a></p>' +
    '</div>'
  );
}

async function submitPartnerEnquire(body) {
  const input = normalizeInput(body);
  const check = validateInput(input);
  if (!check.ok) return check;
  if (check.honeypot) {
    return {
      ok: true,
      message: 'Thanks — we have your enquiry and will reply if we can take this forward.',
    };
  }

  await sendViaResend({
    to: PARTNERSHIPS_EMAIL,
    subject: 'Partner Programme enquiry — ' + input.name,
    html: buildStaffEmailHtml(input),
    replyTo: input.email,
    skipAllowlist: true,
    tags: [{ name: 'category', value: 'partner_enquire' }],
  });

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your Partner Programme enquiry — The Networker UK',
      html: buildConfirmationEmailHtml(input),
      replyTo: PARTNERSHIPS_EMAIL,
      skipAllowlist: true,
      tags: [{ name: 'category', value: 'partner_enquire_confirm' }],
    });
  } catch (e) {
    console.error('[partner-enquire-confirm-email]', e && e.message ? e.message : e);
  }

  return {
    ok: true,
    message: 'Thanks — we have your enquiry and will reply if we can take this forward.',
  };
}

module.exports = {
  submitPartnerEnquire,
  PARTNERSHIPS_EMAIL,
};
