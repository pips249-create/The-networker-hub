/**
 * Public review attribution.
 * Default: first name + last initial.
 * Anonymous option: stable "Networker ####" (no freeform handles).
 * Never publish a full legal name or email on public review surfaces.
 */

const ANONYMOUS_REVIEW_NAME = '__networker__';

function isAnonymousPublicReviewName(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return false;
  if (s === ANONYMOUS_REVIEW_NAME || s === 'networker') return true;
  return /^networker(\s|#|-)?\d{3,6}$/i.test(String(raw || '').trim());
}

function networkerNumberFromId(id) {
  const hex = String(id || '')
    .replace(/-/g, '')
    .toLowerCase();
  if (!hex) return '1000';
  let n = 0;
  for (let i = 0; i < Math.min(12, hex.length); i++) {
    const v = parseInt(hex.charAt(i), 16);
    if (!Number.isNaN(v)) n = (n * 16 + v) % 9000;
  }
  return String(1000 + (n % 9000));
}

function networkerAlias(attendee) {
  return 'Networker ' + networkerNumberFromId(attendee?.id);
}

function firstNameLastInitial(name) {
  const full = String(name || '').trim();
  if (!full) return '';
  const parts = full.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  if (!lastInitial) return parts[0];
  return parts[0] + ' ' + lastInitial + '.';
}

function reviewerDisplayName(attendee) {
  const stored = String(
    attendee?.public_review_name || attendee?.publicReviewName || ''
  ).trim();
  if (isAnonymousPublicReviewName(stored)) {
    return networkerAlias(attendee);
  }
  // Ignore legacy freeform custom names — only first name + last initial, or Networker.
  return firstNameLastInitial(attendee?.name) || 'Attendee';
}

function reviewerInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0))
    .toUpperCase()
    .replace(/\./g, '');
}

function normalizeStoredPublicReviewName(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return null;
  if (isAnonymousPublicReviewName(s)) return ANONYMOUS_REVIEW_NAME;
  const err = new Error(
    'Choose first name + last initial, or stay anonymous as Networker with a number.'
  );
  err.status = 400;
  err.code = 'public_review_name_invalid';
  throw err;
}

module.exports = {
  ANONYMOUS_REVIEW_NAME,
  isAnonymousPublicReviewName,
  networkerAlias,
  networkerNumberFromId,
  firstNameLastInitial,
  reviewerDisplayName,
  reviewerInitials,
  normalizeStoredPublicReviewName,
};
