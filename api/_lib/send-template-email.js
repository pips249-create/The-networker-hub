const { getEmailTemplateBySlug } = require('./supabase-email-templates');
const { getEmailsEnabledForEmail, canSendEmailCategory } = require('./supabase-auth');
const { getBookingEmailDefaultVars } = require('./email-booking-defaults');
const { resolveBookingConfirmationBody } = require('./booking-confirmation-template');
const { resolveBookingReminderBody } = require('./booking-reminder-template');
const { resolveOrganiserNewBookingBody } = require('./organiser-new-booking-template');
const { resolveOrganiserNewApplicationBody } = require('./organiser-new-application-template');
const { resolveApplicationReceivedBody } = require('./application-received-template');
const {
  resolveApplicationApprovedBody,
  resolveApplicationDeniedBody,
} = require('./application-decision-template');
const { resolveOrganiserBookingCancelledBody } = require('./organiser-booking-cancelled-template');
const { resolveBookingCancelledBody } = require('./booking-cancelled-template');
const { resolveEventCancelledBody } = require('./event-cancelled-template');
const { resolveOrganiserRankingBadgeBody } = require('./organiser-ranking-badge-template');
const {
  resolveBrandedEmailBody,
  getBrandedEmailSubject,
  isBrandedEmailSlug,
  BRANDED_EMAIL_TEMPLATES,
} = require('./branded-email-templates');
const {
  legalPolicyUrl,
  contactUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
  unsubscribeUrl,
} = require('./hub-email-urls');
const {
  ensureUnsubscribePlaceholder,
  ensureUnsubscribeLink,
} = require('./email-footer-unsubscribe');
const {
  enrichBookingConfirmationVars,
  enrichBookingReminderVars,
  enrichAccountWelcomeVars,
  stripUnresolvedBookingPlaceholders,
  stripUnresolvedBookingReminderPlaceholders,
  stripUnresolvedAccountWelcomePlaceholders,
} = require('./booking-email-sections');
const { isRecipientAllowed } = require('./email-allowlist');
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
const {
  getEmailSponsorVars,
  ensureSponsorPlaceholderAfterHeader,
  insertSponsorPlaceholderBeforeFooter,
  stripUnresolvedSponsorPlaceholders,
} = require('./email-sponsor-sections');
const { emailGreetingName } = require('./email-display-name');
const {
  enrichOrganiserHubWarningVars,
  enrichOrganiserHubSuspendedVars,
  stripOrganiserHubModerationPlaceholders,
} = require('./organiser-hub-moderation-sections');
const {
  enrichEventRemovedByHubVars,
  stripEventRemovedByHubPlaceholders,
} = require('./event-removed-by-hub-sections');
const { patchEmailMobileStyles } = require('./email-mobile-styles');

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const DEFAULT_RESEND_FROM_NAME = 'The Networker Hub';
const DEFAULT_RESEND_FROM_EMAIL = 'hello@mail.thenetworkerhub.com';

/**
 * Always send with a friendly from-name so inboxes show "The Networker Hub"
 * instead of only the mail.thenetworkerhub.com address.
 */
function formatResendFrom(raw) {
  const configured = String(raw || '').trim();
  const angleMatch = configured.match(/^(.*)<([^>]+)>\s*$/);
  let email = '';
  if (angleMatch) {
    email = String(angleMatch[2] || '')
      .trim()
      .toLowerCase();
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configured)) {
    email = configured.toLowerCase();
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    email = DEFAULT_RESEND_FROM_EMAIL;
  }
  return '"' + DEFAULT_RESEND_FROM_NAME + '" <' + email + '>';
}

/** Business-critical emails — not blocked by hub marketing opt-out. */
const TRANSACTIONAL_EMAIL_SLUGS = new Set([
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_booking_cancelled',
  'event_removed_by_hub',
  'event_unpublished_by_hub',
  'organiser_hub_warning',
  'organiser_hub_suspended',
  'organiser_ticket_sales_nudge',
  'application_received',
  'application_approved',
  'application_denied',
  'organiser_ranking_badge',
  'organiser_featured_expiry_reminder',
  'organiser_claim_invite',
  'organiser_launch_invite',
  'organiser_rebrand_announcement',
  'organiser_team_invite',
  'opportunity_listing_live',
  'opportunity_listing_expiry_reminder',
  'opportunity_premium_expiry_reminder',
  'opportunity_premium_live',
  'opportunity_enquiry_received',
  'opportunity_enquiry_sent',
  'opportunity_listing_expired',
  'opportunity_premium_expired',
  'opportunity_listing_rejected',
  'payout_requested',
  'payout_approved',
  'payout_paid',
  'stripe_connect_nudge',
  'meeting_link_added',
  'event_details_updated',
  'category_exclusivity_payment_reminder',
  'event_almost_full',
  'organiser_low_upcoming_events',
  'password_reset',
  'organiser_email_verify',
  'post_event_review_request',
  'post_event_review_reminder',
  'event_saved_search_match',
  'guest_visit_followup',
  'alumni_fast_pass_invite',
  'member_roster_invite',
  'member_roster_existing',
  'member_roster_new_event',
  'member_roster_booking_reminder',
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'refund_processed',
  'booking_cancelled',
  'event_cancelled',
]);

function replacePlaceholders(text, variables) {
  const vars = variables && typeof variables === 'object' ? variables : {};
  return String(text || '').replace(PLACEHOLDER_RE, function (match, key) {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const val = vars[key];
    if (val == null) return '';
    return String(val);
  });
}

function fileOnlyEmailTemplate(slug) {
  if (BRANDED_EMAIL_TEMPLATES[slug]) {
    return {
      subject: getBrandedEmailSubject(slug),
      resolveBody: (dbHtml) => resolveBrandedEmailBody(slug, dbHtml),
    };
  }
  const map = {
    organiser_new_application: {
      subject: 'New application: {{attendee_name}} — {{event_name}}',
      resolveBody: resolveOrganiserNewApplicationBody,
    },
    application_received: {
      subject: 'Application received — {{event_name}}',
      resolveBody: resolveApplicationReceivedBody,
    },
    application_approved: {
      subject: "You're approved — complete your booking for {{event_name}}",
      resolveBody: resolveApplicationApprovedBody,
    },
    application_denied: {
      subject: 'Update on your application for {{event_name}}',
      resolveBody: resolveApplicationDeniedBody,
    },
    organiser_ranking_badge: {
      subject: 'Congratulations — {{badge_label}} for {{period_label}}',
      resolveBody: resolveOrganiserRankingBadgeBody,
    },
  };
  return map[slug] || null;
}

async function buildEmailFromTemplate(slug, variables, options = {}) {
  const overrides = options && typeof options === 'object' ? options : {};
  let template = await getEmailTemplateBySlug(slug);
  let templateSource = 'database';

  if (template && (overrides.subject != null || overrides.body_html != null)) {
    template = {
      ...template,
      subject: overrides.subject != null ? String(overrides.subject) : template.subject,
      body_html: overrides.body_html != null ? String(overrides.body_html) : template.body_html,
    };
  }

  if (!template) {
    const fileTpl = fileOnlyEmailTemplate(slug);
    if (!fileTpl) {
      const err = new Error('template_not_found');
      err.code = 'template_not_found';
      throw err;
    }
    const resolved = fileTpl.resolveBody('');
    template = {
      slug,
      subject: fileTpl.subject,
      body_html: resolved.bodyHtml,
    };
    templateSource = resolved.source || 'file';
  }

  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const usesBookingEmailDefaults =
    slug === 'booking_confirmation' ||
    slug === 'booking_reminder' ||
    slug === 'saved_event_tickets_open' ||
    slug === 'organiser_new_registration' ||
    slug === 'organiser_new_application' ||
    slug === 'application_received' ||
    slug === 'application_approved' ||
    slug === 'application_denied' ||
    slug === 'organiser_booking_cancelled' ||
    slug === 'booking_cancelled' ||
    slug === 'event_cancelled' ||
    slug === 'refund_processed';

  const sponsorVars = await getEmailSponsorVars(slug);
  const bookingDefaults = usesBookingEmailDefaults ? await getBookingEmailDefaultVars() : {};
  // Never let booking-layout defaults reintroduce sponsors onto emails that opted out.
  const sponsorSection = String(sponsorVars.sponsor_row || '').trim();
  const dbMiniSponsorsRow = String(sponsorVars.mini_sponsors_row || '').trim();
  delete bookingDefaults.sponsor_section;
  delete bookingDefaults.sponsor_row;
  delete bookingDefaults.mini_sponsors_row;

  let merged = {
    site_url: siteUrl,
    logo_url: logoNavUrl(siteUrl),
    logo_footer_url: logoFooterUrl(siteUrl),
    privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
    terms_url: legalPolicyUrl(siteUrl, 'terms'),
    hub_rules_url: legalPolicyUrl(siteUrl, 'hub-rules'),
    refunds_url: legalPolicyUrl(siteUrl, 'refunds'),
    contact_url: contactUrl(siteUrl),
    unsubscribe_url: unsubscribeUrl(siteUrl),
    support_email: supportEmail(),
    sponsor_row: sponsorSection,
    sponsor_section: sponsorSection,
    mini_sponsors_row: dbMiniSponsorsRow,
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
  } else if (slug === 'organiser_new_application') {
    merged = enrichOrganiserRegistrationVars(merged, sponsorSection);
  } else if (slug === 'application_received') {
    merged = enrichBookingConfirmationVars(merged, sponsorSection);
    if (!merged.attendee_initial) {
      const name = String(merged.user_name || '').trim();
      merged.attendee_initial = name ? name.charAt(0).toUpperCase() : '?';
    }
  } else if (slug === 'application_approved' || slug === 'application_denied') {
    merged = enrichBookingConfirmationVars(merged, sponsorSection);
  } else if (slug === 'organiser_booking_cancelled') {
    merged = enrichOrganiserBookingCancelledVars(merged, sponsorSection);
  } else if (slug === 'booking_cancelled') {
    merged = enrichBookingCancelledVars(merged, sponsorSection);
  } else if (slug === 'event_cancelled') {
    merged = enrichEventCancelledVars(merged, sponsorSection);
  } else if (slug === 'event_removed_by_hub' || slug === 'event_unpublished_by_hub' || slug === 'organiser_listing_unpublished_by_hub') {
    merged = enrichEventRemovedByHubVars(merged, sponsorSection);
  } else if (slug === 'organiser_hub_warning') {
    merged = enrichOrganiserHubWarningVars(merged, sponsorSection);
  } else if (slug === 'organiser_hub_suspended') {
    merged = enrichOrganiserHubSuspendedVars(merged, sponsorSection);
  } else if (slug === 'refund_processed') {
    merged = enrichRefundProcessedVars(merged, sponsorSection);
  }

  if (merged.user_name) {
    const greeting = emailGreetingName(merged.user_name);
    if (greeting) merged.user_name = greeting;
  }

  merged.logo_url = logoNavUrl(siteUrl);
  merged.logo_footer_url = logoFooterUrl(siteUrl);
  // Live CMS sponsor resolution always wins over preview/sample variables.
  merged.sponsor_row = sponsorSection;
  merged.sponsor_section = sponsorSection;
  merged.mini_sponsors_row = dbMiniSponsorsRow;

  let bodyHtml = template.body_html;
  bodyHtml = ensureUnsubscribePlaceholder(bodyHtml);
  if (templateSource === 'database') {
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
  } else if (slug === 'organiser_new_application') {
    const resolved = resolveOrganiserNewApplicationBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'application_received') {
    const resolved = resolveApplicationReceivedBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'application_approved') {
    const resolved = resolveApplicationApprovedBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'application_denied') {
    const resolved = resolveApplicationDeniedBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'organiser_ranking_badge') {
    const resolved = resolveOrganiserRankingBadgeBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (isBrandedEmailSlug(slug)) {
    const resolved = resolveBrandedEmailBody(slug, template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'organiser_booking_cancelled') {
    const resolved = resolveOrganiserBookingCancelledBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'booking_cancelled') {
    const resolved = resolveBookingCancelledBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  } else if (slug === 'event_cancelled') {
    const resolved = resolveEventCancelledBody(template.body_html);
    bodyHtml = resolved.bodyHtml;
    templateSource = resolved.source;
  }
  }

  if (sponsorSection) {
    // Main sponsor always sits in the cream container just below the Hub logo hero.
    bodyHtml = ensureSponsorPlaceholderAfterHeader(bodyHtml, '{{sponsor_row}}');
  }
  if (dbMiniSponsorsRow && !/\{\{\s*mini_sponsors_row\s*\}\}/.test(bodyHtml)) {
    bodyHtml = insertSponsorPlaceholderBeforeFooter(bodyHtml, '{{mini_sponsors_row}}');
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
  } else if (slug === 'organiser_new_registration' || slug === 'organiser_new_application' || slug === 'organiser_booking_cancelled') {
    html = stripUnresolvedOrganiserPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'application_received' || slug === 'application_approved' || slug === 'application_denied') {
    html = stripUnresolvedBookingPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'booking_cancelled') {
    html = stripBookingCancelledPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'event_cancelled') {
    html = stripEventCancelledPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'event_removed_by_hub' || slug === 'event_unpublished_by_hub' || slug === 'organiser_listing_unpublished_by_hub') {
    html = stripEventRemovedByHubPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'organiser_hub_warning' || slug === 'organiser_hub_suspended') {
    html = stripOrganiserHubModerationPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (slug === 'refund_processed') {
    html = stripRefundProcessedPlaceholders(html);
    html = replacePlaceholders(html, merged);
  } else if (isBrandedEmailSlug(slug)) {
    html = stripUnresolvedSponsorPlaceholders(html);
    html = html.replace(/\{\{\s*article_hero_image_html\s*\}\}/g, '');
    html = replacePlaceholders(html, merged);
  }

  const footerSupportEmail = String(merged.support_email || supportEmail()).trim();
  if (footerSupportEmail) {
    const supportRe = /\{\{\s*support_email\s*\}\}/g;
    html = html.replace(supportRe, footerSupportEmail);
  }

  const subject = replacePlaceholders(template.subject, merged).replace(
    /\{\{\s*support_email\s*\}\}/g,
    footerSupportEmail || ''
  );

  html = patchEmailMobileStyles(html);
  html = ensureUnsubscribeLink(html, merged.unsubscribe_url || unsubscribeUrl(siteUrl));

  return {
    template,
    subject,
    html,
    templateSource,
  };
}

async function sendViaResend({ to, subject, html, tags, replyTo, from, skipAllowlist, listUnsubscribeUrl }) {
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

  if (!skipAllowlist && !isRecipientAllowed(recipient)) {
    const err = new Error(
      'This recipient is not on the pre-launch email allowlist. Add them to EMAIL_RECIPIENT_ALLOWLIST in Vercel, or set EMAIL_ALLOWLIST_DISABLED=true when you launch.'
    );
    err.code = 'recipient_not_allowlisted';
    throw err;
  }

  const tagList = Array.isArray(tags)
    ? tags
        .map(function (tag) {
          if (!tag || typeof tag !== 'object') return null;
          const name = String(tag.name || '').trim();
          const value = String(tag.value || '').trim();
          if (!name || !value) return null;
          return { name, value };
        })
        .filter(Boolean)
    : [];

  const body = {
    from: formatResendFrom(from || process.env.RESEND_FROM),
    to: [recipient],
    subject,
    html,
  };
  const replyToAddress = String(replyTo || supportEmail() || '')
    .trim()
    .toLowerCase();
  if (replyToAddress && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToAddress)) {
    body.reply_to = replyToAddress;
  }
  if (tagList.length) body.tags = tagList;

  const unsub = String(listUnsubscribeUrl || '').trim();
  if (unsub) {
    body.headers = {
      'List-Unsubscribe': '<' + unsub + '>',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
const PREFERENCE_EMAIL_SLUGS = {
  booking_reminder: 'event_reminders',
  online_join_reminder: 'event_reminders',
  saved_organiser_new_listing: 'organiser_alerts',
};

/** Promotional / nurture mail — requires explicit marketing opt-in (PECR). */
const MARKETING_EMAIL_SLUGS = new Set([
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'saved_event_tickets_open',
  'saved_opportunity_closing_soon',
  'opportunity_saved_search_match',
]);

/** Member-list mail — organiser-uploaded recipients; bypass pre-launch allowlist. */
const MEMBER_ROSTER_EMAIL_SLUGS = new Set([
  'member_roster_invite',
  'member_roster_existing',
  'member_roster_new_event',
  'member_roster_booking_reminder',
]);

/**
 * Conduct moderation mail — must reach the organiser even while the pre-launch
 * allowlist is on (warnings/suspensions are enforcement, not marketing).
 */
const ORGANISER_MODERATION_EMAIL_SLUGS = new Set([
  'organiser_hub_warning',
  'organiser_hub_suspended',
]);

function shouldSkipEmailAllowlist(slug) {
  return MEMBER_ROSTER_EMAIL_SLUGS.has(slug) || ORGANISER_MODERATION_EMAIL_SLUGS.has(slug);
}

async function sendTemplatedEmail({ slug, to, variables, skipEmailCheck, subject, resendTags, replyTo, from }) {
  if (!skipEmailCheck) {
    if (TRANSACTIONAL_EMAIL_SLUGS.has(slug)) {
      if (PREFERENCE_EMAIL_SLUGS[slug]) {
        const allowed = await canSendEmailCategory(to, PREFERENCE_EMAIL_SLUGS[slug]);
        if (!allowed) {
          const err = new Error('emails_disabled');
          err.code = 'emails_disabled';
          throw err;
        }
      }
    } else if (MARKETING_EMAIL_SLUGS.has(slug)) {
      const allowed = await canSendEmailCategory(to, 'marketing');
      if (!allowed) {
        const err = new Error('emails_disabled');
        err.code = 'emails_disabled';
        throw err;
      }
    } else if (PREFERENCE_EMAIL_SLUGS[slug]) {
      const allowed = await canSendEmailCategory(to, PREFERENCE_EMAIL_SLUGS[slug]);
      if (!allowed) {
        const err = new Error('emails_disabled');
        err.code = 'emails_disabled';
        throw err;
      }
    } else {
      const allowed = await getEmailsEnabledForEmail(to);
      if (!allowed) {
        const err = new Error('emails_disabled');
        err.code = 'emails_disabled';
        throw err;
      }
    }
  }

  const built = await buildEmailFromTemplate(slug, variables);
  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const result = await sendViaResend({
    to,
    subject: subject || built.subject,
    html: built.html,
    tags: resendTags,
    replyTo,
    from,
    skipAllowlist: shouldSkipEmailAllowlist(slug),
    listUnsubscribeUrl: unsubscribeUrl(siteUrl),
  });
  return {
    ...result,
    subject: subject || built.subject,
    slug: built.template.slug,
    template_source: built.templateSource || 'database',
  };
}

module.exports = {
  replacePlaceholders,
  buildEmailFromTemplate,
  sendTemplatedEmail,
  sendViaResend,
  formatResendFrom,
};
