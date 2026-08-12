/**
 * Pre-launch recipient allowlist — only these addresses receive outbound email
 * while Resend/domain setup is in progress. Set EMAIL_ALLOWLIST_DISABLED=true
 * in Vercel when you launch to send to all users.
 */
const DEFAULT_ALLOWED_RECIPIENTS = [
  'pips249@gmail.com',
  'catherine@the-networker.co.uk',
  'catherine@thenetworkerhub.com',
  'rosie@the-networker.co.uk',
  'rosie@thenetworkerhub.com',
  'jamie@thenetworkerhub.com',
  'andreagaiga8@gmail.com',
  'hancher249@gmail.com',
  'rosie.mcgilvray@yahoo.co.uk',
  'gary.dixon336@outlook.com',
];

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function parseEnvAllowlist(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function isEmailAllowlistEnabled() {
  const flag = String(process.env.EMAIL_ALLOWLIST_DISABLED || '')
    .trim()
    .toLowerCase();
  return flag !== 'true' && flag !== '1' && flag !== 'yes';
}

function getAllowedRecipients() {
  const allowed = new Set(DEFAULT_ALLOWED_RECIPIENTS.map(normalizeEmail));
  parseEnvAllowlist(process.env.EMAIL_RECIPIENT_ALLOWLIST).forEach(function (email) {
    allowed.add(email);
  });
  return allowed;
}

function isRecipientAllowed(email) {
  if (!isEmailAllowlistEnabled()) return true;
  const recipient = normalizeEmail(email);
  if (!recipient) return false;
  return getAllowedRecipients().has(recipient);
}

function emailAllowlistStatus() {
  const enabled = isEmailAllowlistEnabled();
  const allowed = [...getAllowedRecipients()].sort();
  return {
    emailAllowlistEnabled: enabled,
    emailAllowlistCount: allowed.length,
    emailAllowlistRecipients: allowed,
  };
}

module.exports = {
  DEFAULT_ALLOWED_RECIPIENTS,
  normalizeEmail,
  isEmailAllowlistEnabled,
  getAllowedRecipients,
  isRecipientAllowed,
  emailAllowlistStatus,
};
