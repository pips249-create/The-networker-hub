/**
 * Optional recipient allowlist (off by default after launch).
 * Set EMAIL_ALLOWLIST_ENABLED=true to restrict outbound mail to
 * DEFAULT_ALLOWED_RECIPIENTS + EMAIL_RECIPIENT_ALLOWLIST only.
 * EMAIL_ALLOWLIST_DISABLED=true also keeps the allowlist off (legacy).
 */
const DEFAULT_ALLOWED_RECIPIENTS = [
  'pips249@gmail.com',
  'catherine@the-networker.co.uk',
  'catherine@thenetworkeruk.com',
  'rosie@the-networker.co.uk',
  'rosie@thenetworkeruk.com',
  'jamie@thenetworkeruk.com',
  'andreagaiga8@gmail.com',
  'hancher249@gmail.com',
  'rosie.mcgilvray@yahoo.co.uk',
  'gary.dixon336@outlook.com',
  'hello@thenetworkeruk.com',
  'hello@the-networker.co.uk',
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
  const disabled = String(process.env.EMAIL_ALLOWLIST_DISABLED || '')
    .trim()
    .toLowerCase();
  if (disabled === 'true' || disabled === '1' || disabled === 'yes') return false;
  const enabled = String(process.env.EMAIL_ALLOWLIST_ENABLED || '')
    .trim()
    .toLowerCase();
  return enabled === 'true' || enabled === '1' || enabled === 'yes';
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
