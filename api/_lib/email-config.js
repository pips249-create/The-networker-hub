const { emailAllowlistStatus } = require('./email-allowlist');
const {
  automatedEmailSequencesStatus,
  hubertEventConciergeEmailsStatus,
} = require('./automated-email-sequences');

/**
 * Resend open/click tracking is off by default on every domain. When it is off,
 * the Emails dashboard stays on "Delivered" forever — that does not mean nobody
 * opened the message. Enable tracking under Resend → Domains → Configuration
 * (and verify the tracking CNAME) if you need open/click events. Prefer click
 * tracking over open tracking on the transactional mail subdomain.
 */
const RESEND_OPEN_TRACKING_HINT =
  'Resend open tracking is off by default. Emails that stay on Delivered may still have been opened — turn on open/click tracking under Domains → Configuration (with a verified tracking CNAME) if you need those events. Prefer click tracking on mail.thenetworkeruk.com; keep open tracking for Broadcasts only.';

function emailConfigStatus() {
  const hasResendApiKey = Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const hasResendFrom = Boolean(String(process.env.RESEND_FROM || '').trim());
  const hasResendWebhookSecret = Boolean(String(process.env.RESEND_WEBHOOK_SECRET || '').trim());
  return {
    hasResendApiKey,
    hasResendFrom,
    hasResendWebhookSecret,
    emailSendingConfigured: hasResendApiKey && hasResendFrom,
    resendOpenTrackingHint: RESEND_OPEN_TRACKING_HINT,
    ...emailAllowlistStatus(),
    ...automatedEmailSequencesStatus(),
    ...hubertEventConciergeEmailsStatus(),
  };
}

module.exports = {
  emailConfigStatus,
};
