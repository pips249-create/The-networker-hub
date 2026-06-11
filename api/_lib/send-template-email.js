const { getEmailTemplateBySlug } = require('./supabase-email-templates');
const { getEmailsEnabledForEmail } = require('./supabase-auth');
const { getBookingEmailDefaultVars } = require('./email-booking-defaults');
const { resolveBookingConfirmationBody } = require('./booking-confirmation-template');
const { resolveBookingReminderBody } = require('./booking-reminder-template');
const { resolveOrganiserNewBookingBody } = require('./organiser-new-booking-template');
const { resolveOrganiserBookingCancelledBody } = require('./organiser-booking-cancelled-template');
const {
  enrichBookingConfirmationVars,
  enrichBookingReminderVars,
  enrichAccountWelcomeVars,
  stripUnresolvedBookingPlaceholders,
  stripUnresolvedBookingReminderPlaceholders,
  stripUnresolvedAccountWelcomePlaceholders,
} = require('./booking-email-sections');
const {
  enrichOrganiserRegistrationVars,
  enrichOrganiserBookingCancelledVars,
  stripUnresolvedOrganiserPlaceholders,
} = require('./organiser-email-sections');
const {
  enrichBookingCancelledVars,
  enrichEventCancelledVars,
  enrichRefundProcessedVars,
  stripBookingCancelledPlaceholders,
  stripEventCancelledPlaceholders,
  stripRefundProcessedPlaceholders,
} = require('./cancellation-email-sections');

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

  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const usesBookingEmailDefaults =
    slug === 'booking_confirmation' ||
    slug === 'booking_reminder' ||
    slug === 'account_welcome' ||
    slug === 'saved_event_tickets_open' ||
    slug === 'organiser_new_registration' ||
    slug === 'organiser_booking_cancelled' ||
    slug === 'booking_cancelled' ||
    slug === 'event_cancelled' ||
    slug === 'refund_processed';
  const bookingDefaults = usesBookingEmailDefaults ? await getBookingEmailDefaultVars() : {};
  const sponsorSection = bookingDefaults.sponsor_section || '';
  delete bookingDefaults.sponsor_section;

  let merged = {
    site_url: siteUrl,
    logo_url: siteUrl + '/assets/logo-nav.png',
    ...variables,
    ...bookingDefaults,
  };

  if (slug === 'booking_confirmation') {
    merged = enrichBookingConfirmationVars(merged, sponsorSection);
  } else if (slug === 'booking_reminder') {
    merged = enrichBookingReminderVars(merged, sponsorSection);
  } else if (slug === 'account_welcome' || slug === 'saved_event_tickets_open') {
    merged = enrichAccountWelcomeVars(merged, sponsorSection);
  } else if (slug === 'organiser_new_registration') {
    merged = enrichOrganiserRegistrationVars(merged, sponsorSection);
  } else if (slug === 'organiser_booking_cancelled') {
    merged = enrichOrganiserBookingCancelledVars(merged, sponsorSection);
  } else if (slug === 'booking_cancelled') {
    merged = enrichBookingCancelledVars(merged, sponsorSection);
  } else if (slug === 'event_cancelled') {
    merged = enrichEventCancelledVars(merged, sponsorSection);
  } else if (slug === 'refund_processed') {
    merged = enrichRefundProcessedVars(merged, sponsorSection);
  }

  let bodyHtml = template.body_html;
  let templateSource = 'database';
  if (slug === 'booking_confirmation') {
    const resolved = resolveBookingConfirmationBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'booking_reminder') {
    const resolved = resolveBookingReminderBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'organiser_new_registration') {
    const resolved = resolveOrganiserNewBookingBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'organiser_booking_cancelled') {
    const resolved = resolveOrganiserBookingCancelledBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  }

  let html = replacePlaceholders(bodyHtml, merged);
  if (slug === 'booking_confirmation') {
    html = stripUnresolvedBookingPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'booking_reminder') {
    html = stripUnresolvedBookingReminderPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'account_welcome' || slug === 'saved_event_tickets_open') {
    html = stripUnresolvedAccountWelcomePlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'organiser_new_registration' || slug === 'organiser_booking_cancelled') {
    html = stripUnresolvedOrganiserPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'booking_cancelled') {
    html = stripBookingCancelledPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'event_cancelled') {
    html = stripEventCancelledPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'refund_processed') {
    html = stripRefundProcessedPlaceholders(html);
    html = replacePlaceholders(html, merged);
  }

  return {
    template,
    subject: replacePlaceholders(template.subject, merged),
    html,
    templateSource,
  };
}

async function sendViaResend({ to, subject, html }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    const err = new Error(
      'Email sending is not configured. For local dev add RESEND_API_KEY and RESEND_FROM to local.env, then run npm run sync-env and restart npm start. On live, set them in Vercel → Environment Variables and redeploy.'
    );
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
async function sendTemplatedEmail({ slug, to, variables, skipEmailCheck }) {
  if (!skipEmailCheck) {
    const allowed = await getEmailsEnabledForEmail(to);
    if (!allowed) {
      const err = new Error('emails_disabled');
      err.code = 'emails_disabled';
      throw err;
    }
  }

  const built = await buildEmailFromTemplate(slug, variables);
  const result = await sendViaResend({
    to,
    subject: built.subject,
    html: built.html,
  });
  return {
    ...result,
    subject: built.subject,
    slug: built.template.slug,
    template_source: built.templateSource || 'database',
  };
}

module.exports = {
  replacePlaceholders,
  buildEmailFromTemplate,
  sendTemplatedEmail,
  sendViaResend,
};
