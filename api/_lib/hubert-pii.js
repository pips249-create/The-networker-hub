/**
 * Redact likely PII before optional third-party AI processing (Hubert / OpenAI).
 * Keeps enough context for FAQ-style replies while reducing accidental data leakage.
 */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const UK_PHONE_RE = /(?:\+44\s?\d{2,4}|0\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g;
const CARDISH_RE = /\b(?:\d[ -]?){13,19}\b/g;

function redactPii(text) {
  let s = String(text || '');
  if (!s) return s;
  s = s.replace(EMAIL_RE, '[email redacted]');
  s = s.replace(UK_POSTCODE_RE, '[postcode redacted]');
  s = s.replace(UK_PHONE_RE, '[phone redacted]');
  s = s.replace(CARDISH_RE, '[number redacted]');
  return s;
}

function redactMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map(function (m) {
    return {
      role: m.role,
      content: redactPii(m.content),
    };
  });
}

module.exports = {
  redactPii,
  redactMessages,
};
