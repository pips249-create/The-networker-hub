/**
 * Submit advertising enquiries from /advertising — store + notify Rosie.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendViaResend } = require('./send-template-email');

const ROSIE_EMAIL = String(process.env.ADVERTISING_ENQUIRY_EMAIL || 'rosie@thenetworkerhub.com')
  .trim()
  .toLowerCase();

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
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

function normalizeEnquiryInput(body) {
  body = body || {};
  return {
    companyName: String(body.company || body.companyName || body.company_name || '').trim(),
    contactName: String(body.name || body.contactName || body.contact_name || '').trim(),
    email: normalizeEmail(body.email),
    section: String(body.section || '').trim(),
    packageName: String(body.package || body.packageName || body.package_name || '').trim(),
    budget: String(body.budget || '').trim() || null,
    message: String(body.message || '').trim() || null,
    website: String(body.website || '').trim(),
  };
}

function validateEnquiry(input) {
  if (input.website) {
    return { ok: true, honeypot: true };
  }
  if (!input.companyName) return { ok: false, error: 'missing_company', message: 'Enter your company name.' };
  if (!input.contactName) return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  if (!isValidEmail(input.email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid work email address.' };
  }
  if (!input.section) return { ok: false, error: 'missing_section', message: 'Choose a section.' };
  if (!input.packageName) return { ok: false, error: 'missing_package', message: 'Choose a package.' };
  return { ok: true };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">Advertising enquiry</h2>' +
    '<p style="margin:0 0 16px;"><strong>' +
    escHtml(input.packageName) +
    '</strong> · ' +
    escHtml(input.section) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:520px;">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Company</td><td><strong>' +
    escHtml(input.companyName) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Contact</td><td>' +
    escHtml(input.contactName) +
    '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:' +
    escHtml(input.email) +
    '">' +
    escHtml(input.email) +
    '</a></td></tr>' +
    (input.budget
      ? '<tr><td style="padding:4px 12px 4px 0;color:#666;">Budget</td><td>' +
        escHtml(input.budget) +
        '</td></tr>'
      : '') +
    '</table>' +
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
    escHtml(input.contactName) +
    ',</p>' +
    '<p style="margin:0 0 12px;">Thanks for your enquiry about <strong>' +
    escHtml(input.packageName) +
    '</strong> on The Networker Hub (' +
    escHtml(input.section) +
    ' section).</p>' +
    '<p style="margin:0 0 12px;">Rosie will review your details and reply within <strong>one business day</strong> with availability, next steps, and anything we need for creative.</p>' +
    '<p style="margin:0;">The Networker Hub<br><a href="https://www.thenetworkerhub.com/advertising">thenetworkerhub.com/advertising</a></p>' +
    '</div>'
  );
}

async function submitAdvertisingEnquiry(body) {
  const input = normalizeEnquiryInput(body);
  const validation = validateEnquiry(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.honeypot) {
    return {
      ok: true,
      message: 'Thanks — Rosie will reply within one business day.',
    };
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('advertising_enquiries')
    .insert({
      company_name: input.companyName,
      contact_name: input.contactName,
      email: input.email,
      section: input.section,
      package_name: input.packageName,
      budget: input.budget,
      message: input.message,
    })
    .select('id, created_at')
    .single();

  if (error) {
    if (/advertising_enquiries/i.test(error.message || '')) {
      const err = new Error('Enquiry storage is not configured yet — email rosie@thenetworkerhub.com directly.');
      err.code = 'not_configured';
      throw err;
    }
    throw new Error(error.message || 'Could not save enquiry');
  }

  const subject = 'Advertising enquiry — ' + input.packageName + ' (' + input.section + ')';

  try {
    await sendViaResend({
      to: ROSIE_EMAIL,
      subject,
      html: buildStaffEmailHtml(input),
      replyTo: input.email,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[advertising-enquiry-staff-email]', e.message || e);
  }

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your advertising enquiry — The Networker Hub',
      html: buildConfirmationEmailHtml(input),
      replyTo: ROSIE_EMAIL,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[advertising-enquiry-confirm-email]', e.message || e);
  }

  return {
    ok: true,
    id: data && data.id,
    message: 'Thanks — Rosie will reply within one business day with availability and next steps.',
  };
}

module.exports = {
  submitAdvertisingEnquiry,
  normalizeEnquiryInput,
};
