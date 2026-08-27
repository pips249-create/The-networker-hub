/**
 * Networking group / training org intake from international map (building markets).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { sendViaResend } = require('./send-template-email');
const { supportEmail } = require('./hub-email-urls');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ORG_TYPES = new Set(['networking_group', 'training', 'both']);

function staffInbox() {
  const configured = String(process.env.EVENT_INTAKE_EMAIL || '').trim();
  if (configured) return configured.toLowerCase();
  return supportEmail();
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return (
    '<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;">' +
    escHtml(label) +
    '</td><td style="padding:4px 0;vertical-align:top;">' +
    escHtml(v).replace(/\n/g, '<br>') +
    '</td></tr>'
  );
}

function orgTypeLabel(value) {
  if (value === 'training') return 'Training organisation';
  if (value === 'both') return 'Networking group & training';
  return 'Networking group';
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizePhone(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ') || null;
}

function normalizeCountryCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function normalizeOrgType(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return VALID_ORG_TYPES.has(value) ? value : 'networking_group';
}

function normalizeInput(payload) {
  payload = payload || {};
  const allowedSources = new Set([
    'international_map',
    'market_preview_ie',
    'market_preview_us',
  ]);
  const sourceRaw = String(payload.source || '')
    .trim()
    .toLowerCase()
    .slice(0, 64);
  return {
    contactName: String(payload.name || payload.contactName || payload.contact_name || '').trim(),
    email: normalizeEmail(payload.email),
    phone: normalizePhone(payload.phone || payload.telephone || payload.mobile),
    groupName: String(payload.group || payload.groupName || payload.group_name || '').trim(),
    websiteUrl: String(payload.website || payload.websiteUrl || payload.website_url || '').trim() || null,
    orgType: normalizeOrgType(payload.orgType || payload.org_type || payload.type),
    description: String(payload.description || payload.message || payload.notes || '').trim() || null,
    countryCode: normalizeCountryCode(payload.countryCode || payload.country_code),
    countryName: String(payload.countryName || payload.country_name || '').trim().slice(0, 120),
    website: String(payload.website_hp || '').trim(),
    source: allowedSources.has(sourceRaw) ? sourceRaw : 'international_map',
  };
}

function validateInput(input) {
  if (input.website) {
    return { ok: true, honeypot: true };
  }
  if (!input.contactName) {
    return { ok: false, error: 'missing_name', message: 'Enter your name.' };
  }
  if (!input.email || input.email.length > 254 || !EMAIL_RE.test(input.email)) {
    return { ok: false, error: 'invalid_email', message: 'Enter a valid email address.' };
  }
  if (!input.groupName) {
    return { ok: false, error: 'missing_group', message: 'Enter your group or organisation name.' };
  }
  if (!input.countryCode || input.countryCode.length !== 2) {
    return { ok: false, error: 'invalid_country', message: 'Choose a country.' };
  }
  if (!input.countryName) {
    return { ok: false, error: 'invalid_country', message: 'Choose a country.' };
  }
  if (input.websiteUrl) {
    try {
      const url = new URL(input.websiteUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          ok: false,
          error: 'invalid_website',
          message: 'Enter a valid website URL (https://…).',
        };
      }
    } catch {
      return {
        ok: false,
        error: 'invalid_website',
        message: 'Enter a valid website URL (https://…).',
      };
    }
  }
  return { ok: true };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">International group to onboard</h2>' +
    '<p style="margin:0 0 16px;"><strong>' +
    escHtml(input.groupName) +
    '</strong> · ' +
    escHtml(input.countryName) +
    '</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:560px;">' +
    row('Contact', input.contactName) +
    row('Email', input.email) +
    row('Phone', input.phone) +
    row('Group / organisation', input.groupName) +
    row('Type', orgTypeLabel(input.orgType)) +
    row('Website', input.websiteUrl) +
    row('Country', input.countryName + ' (' + input.countryCode + ')') +
    '</table>' +
    (input.description
      ? '<p style="margin:16px 0 0;"><strong>About the group</strong><br>' +
        escHtml(input.description).replace(/\n/g, '<br>') +
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
    '<p style="margin:0 0 12px;">Thanks — we have your details for <strong>' +
    escHtml(input.groupName) +
    '</strong>.</p>' +
    '<p style="margin:0 0 12px;">We&rsquo;re building The Networker in ' +
    escHtml(input.countryName) +
    ' and will be in touch as we get closer to launch.</p>' +
    '<p style="margin:0;">The Networker International</p>' +
    '</div>'
  );
}

async function submitInternationalGroupIntake(payload) {
  if (!isSupabaseConfigured()) {
    const err = new Error(
      'Group intake is not configured yet — email hi@thenetworkeruk.com with your details.'
    );
    err.code = 'not_configured';
    throw err;
  }

  const input = normalizeInput(payload);
  const validation = validateInput(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.honeypot) {
    return {
      ok: true,
      message: 'Thanks — we will be in touch as we launch in your country.',
    };
  }

  const sb = getSupabaseAdmin();
  const insertRes = await sb
    .from('international_group_intake')
    .insert({
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      group_name: input.groupName,
      website_url: input.websiteUrl,
      org_type: input.orgType,
      description: input.description,
      country_code: input.countryCode,
      country_name: input.countryName,
      status: 'open',
      source: input.source,
    })
    .select('id, created_at')
    .single();

  if (insertRes.error) {
    if (/international_group_intake/i.test(insertRes.error.message || '')) {
      const err = new Error(
        'Group intake is not configured yet — email hi@thenetworkeruk.com with your details.'
      );
      err.code = 'not_configured';
      throw err;
    }
    const err = new Error(insertRes.error.message || 'Could not save your details.');
    err.code = 'save_failed';
    throw err;
  }

  const to = staffInbox();
  const subject =
    'International group — ' + input.groupName + ' (' + input.countryName + ')';

  try {
    await sendViaResend({
      to,
      subject,
      html: buildStaffEmailHtml(input),
      replyTo: input.email,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[international-group-intake-staff-email]', e.message || e);
  }

  try {
    await sendViaResend({
      to: input.email,
      subject: 'We received your details — The Networker International',
      html: buildConfirmationEmailHtml(input),
      replyTo: to,
      skipAllowlist: true,
    });
  } catch (e) {
    console.error('[international-group-intake-confirm-email]', e.message || e);
  }

  return {
    ok: true,
    id: insertRes.data && insertRes.data.id,
    message: 'Thanks — we will be in touch as we launch in your country.',
  };
}

module.exports = {
  submitInternationalGroupIntake,
};
