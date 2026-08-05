/**
 * Public review display-name moderation.
 * One optional name is stored on the attendee account and used on all reviews.
 * This module blocks hate, abuse, and impersonation — keep the list maintainable.
 */

const PUBLIC_REVIEW_NAME_ERROR =
  'That public review name isn’t allowed. Please choose something respectful — no hate, abuse, or impersonation.';

/** Whole-token matches only (avoids false positives in longer words). */
const BLOCKED_TOKENS = [
  // Hate / racial / ethnic
  'nigger',
  'nigga',
  'niggas',
  'chink',
  'gook',
  'kike',
  'spic',
  'spick',
  'wetback',
  'paki',
  'coon',
  'raghead',
  'towelhead',
  // Homophobic / transphobic
  'faggot',
  'faggots',
  'fag',
  'dyke',
  'tranny',
  'shemale',
  // Ableist / extreme abuse
  'retard',
  'retarded',
  'spastic',
  // Sexual abuse / extreme insults as handles
  'rape',
  'rapist',
  'paedo',
  'pedo',
  'paedophile',
  'pedophile',
  'childfucker',
  'motherfucker',
  'cunt',
  'cunts',
  // Extremist
  'nazi',
  'nazis',
  'hitler',
  'kkk',
  // Impersonation
  'admin',
  'administrator',
  'moderator',
  'support',
  'thenetworkhub',
  'thenetworkerhub',
  'networkerhub',
  'hubert',
];

/** Longer phrases checked against collapsed alphanumeric text. */
const BLOCKED_PHRASES = [
  'whitepower',
  'whitepride',
  'siegheil',
  'heilhitler',
  'killjews',
  'killgays',
  'gasjews',
  'fuckniggers',
  'fuckfags',
];

function foldAlphanumeric(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/[^a-z0-9]+/g, '');
}

function tokensForMatch(raw) {
  const spaced = String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!spaced) return [];
  return spaced.split(/\s+/).filter(Boolean);
}

function isPublicReviewNameBlocked(raw) {
  const collapsed = foldAlphanumeric(raw);
  if (!collapsed) return false;

  for (let i = 0; i < BLOCKED_PHRASES.length; i++) {
    if (collapsed.includes(BLOCKED_PHRASES[i])) return true;
  }

  const tokens = tokensForMatch(raw);
  for (let i = 0; i < tokens.length; i++) {
    if (BLOCKED_TOKENS.includes(tokens[i])) return true;
  }

  // Also catch "n.i.g.g.e.r" / "n i g g e r" style after full collapse.
  for (let i = 0; i < BLOCKED_TOKENS.length; i++) {
    const term = BLOCKED_TOKENS[i];
    if (term.length >= 4 && collapsed === term) return true;
    if (term.length >= 5 && collapsed.includes(term)) return true;
  }

  return false;
}

function assertPublicReviewNameAllowed(raw) {
  if (!raw) return;
  if (!isPublicReviewNameBlocked(raw)) return;
  const err = new Error(PUBLIC_REVIEW_NAME_ERROR);
  err.status = 400;
  err.code = 'public_review_name_blocked';
  throw err;
}

module.exports = {
  PUBLIC_REVIEW_NAME_ERROR,
  isPublicReviewNameBlocked,
  assertPublicReviewNameAllowed,
  foldAlphanumeric,
};
