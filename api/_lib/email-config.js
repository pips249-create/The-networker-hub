function emailConfigStatus() {
  const hasResendApiKey = Boolean(String(process.env.RESEND_API_KEY || '').trim());
  const hasResendFrom = Boolean(String(process.env.RESEND_FROM || '').trim());
  return {
    hasResendApiKey,
    hasResendFrom,
    emailSendingConfigured: hasResendApiKey && hasResendFrom,
  };
}

module.exports = {
  emailConfigStatus,
};
