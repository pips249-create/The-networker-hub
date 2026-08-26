const { emailAllowlistStatus } = require('./email-allowlist');
const { automatedEmailSequencesStatus } = require('./automated-email-sequences');

function emailConfigStatus() {
  const hasResendApiKey = Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const hasResendFrom = Boolean(String(process.env.RESEND_FROM || '').trim());
  const hasResendWebhookSecret = Boolean(String(process.env.RESEND_WEBHOOK_SECRET || '').trim());
  return {
    hasResendApiKey,
    hasResendFrom,
    hasResendWebhookSecret,
    emailSendingConfigured: hasResendApiKey && hasResendFrom,
    ...emailAllowlistStatus(),
    ...automatedEmailSequencesStatus(),
  };
}

module.exports = {
  emailConfigStatus,
};
