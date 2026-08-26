/**
 * Listing language moderation for event title/description.
 * - Hate / slurs: block publish (and block saving onto a live listing)
 * - Strong swearing: allow publish, flag for admin review
 * Obfuscation like f*ck / f.u.c.k is folded the same way as review-name checks.
 */

const {
  foldAlphanumeric,
} = require('./public-review-name-moderation');

const LISTING_HATE_SPEECH_ERROR =
  'This listing can’t go live because it includes language that isn’t allowed on The Networker UK (hate speech or extreme abuse). Please remove it and try again.';

/** Collapse common masked swears before token / fold matching (f*ck, f.u.c.k, sh!t). */
const OBFUSCATION_NORMALIZERS = [
  { re: /f[\W_]*(?:u+|\*)?[\W_]*c[\W_]*k(?:[\W_]*i[\W_]*n[\W_]*g)?/gi, to: 'fuck' },
  { re: /s[\W_]*h[\W_]*(?:[i1!]|\*)?[\W_]*t/gi, to: 'shit' },
  { re: /b[\W_]*u[\W_]*l[\W_]*l[\W_]*s[\W_]*h[\W_]*(?:[i1!]|\*)?[\W_]*t/gi, to: 'bullshit' },
  { re: /a[\W_]*[s\$5][\W_]*[s\$5][\W_]*h[\W_]*[o0][\W_]*l[\W_]*e/gi, to: 'asshole' },
  { re: /a[\W_]*r[\W_]*s[\W_]*e[\W_]*h[\W_]*[o0][\W_]*l[\W_]*e/gi, to: 'arsehole' },
  { re: /b[\W_]*[i1!][\W_]*t[\W_]*c[\W_]*h/gi, to: 'bitch' },
  { re: /b[\W_]*a[\W_]*s[\W_]*t[\W_]*a[\W_]*r[\W_]*d/gi, to: 'bastard' },
  { re: /w[\W_]*a[\W_]*n[\W_]*k[\W_]*e[\W_]*r/gi, to: 'wanker' },
  { re: /c[\W_]*(?:u+|\*)?[\W_]*n[\W_]*t/gi, to: 'cunt' },
  { re: /d[\W_]*[i1!][\W_]*c[\W_]*k[\W_]*h[\W_]*e[\W_]*a[\W_]*d/gi, to: 'dickhead' },
];

function normalizeObfuscatedLanguage(raw) {
  let text = String(raw || '');
  for (let i = 0; i < OBFUSCATION_NORMALIZERS.length; i++) {
    text = text.replace(OBFUSCATION_NORMALIZERS[i].re, OBFUSCATION_NORMALIZERS[i].to);
  }
  return text;
}

/** Hate / slurs / extreme abuse — block publish. */
const HATE_TOKENS = [
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
  'faggot',
  'faggots',
  'fag',
  'dyke',
  'tranny',
  'shemale',
  'retard',
  'retarded',
  'spastic',
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
  'nazi',
  'nazis',
  'hitler',
  'kkk',
];

const HATE_PHRASES = [
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

/**
 * Strong swearing — admin alert only (not blocked).
 * Keep mild words (damn, hell, crap) out to limit noise.
 */
const PROFANITY_TOKENS = [
  'fuck',
  'fucks',
  'fucker',
  'fuckers',
  'fucking',
  'fucked',
  'fuckhead',
  'shit',
  'shits',
  'shitty',
  'bullshit',
  'asshole',
  'assholes',
  'arsehole',
  'arseholes',
  'bitch',
  'bitches',
  'bastard',
  'bastards',
  'dickhead',
  'dickheads',
  'wanker',
  'wankers',
  'twat',
  'twats',
  'bollocks',
  'piss',
  'pissed',
  'pissoff',
];

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

function matchesTokenList(collapsed, tokens, list) {
  const hits = new Set();
  for (let i = 0; i < tokens.length; i++) {
    if (list.includes(tokens[i])) hits.add(tokens[i]);
  }
  for (let i = 0; i < list.length; i++) {
    const term = list[i];
    if (term.length >= 4 && collapsed === term) hits.add(term);
    if (term.length >= 5 && collapsed.includes(term)) hits.add(term);
  }
  return [...hits];
}

function matchesPhraseList(collapsed, phrases) {
  const hits = [];
  for (let i = 0; i < phrases.length; i++) {
    if (collapsed.includes(phrases[i])) hits.push(phrases[i]);
  }
  return hits;
}

function collectListingLanguageText(row) {
  return [row?.title, row?.description]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * @returns {{ hate: string[], profanity: string[] }}
 */
function scanListingLanguage(text) {
  const raw = normalizeObfuscatedLanguage(text);
  if (!String(raw || '').trim()) return { hate: [], profanity: [] };

  const collapsed = foldAlphanumeric(raw);
  const tokens = tokensForMatch(raw);

  const hate = [
    ...matchesPhraseList(collapsed, HATE_PHRASES),
    ...matchesTokenList(collapsed, tokens, HATE_TOKENS),
  ];
  // Deduplicate while preserving order
  const hateUnique = [...new Set(hate)];

  const profanityRaw = matchesTokenList(collapsed, tokens, PROFANITY_TOKENS);
  // Don't double-count terms already treated as hate (e.g. motherfucker)
  const hateSet = new Set(hateUnique);
  const profanity = [...new Set(profanityRaw.filter((t) => !hateSet.has(t)))];

  // Obfuscated fuck / shit etc. that didn't token-split cleanly
  if (!profanity.length && !hateUnique.length) {
    for (let i = 0; i < PROFANITY_TOKENS.length; i++) {
      const term = PROFANITY_TOKENS[i];
      if (term.length >= 4 && collapsed.includes(term)) {
        profanity.push(term);
        break;
      }
    }
  }

  return { hate: hateUnique, profanity };
}

function scanEventListingLanguage(row) {
  return scanListingLanguage(collectListingLanguageText(row));
}

function assertNoHateSpeechForPublish(row) {
  const scan = scanEventListingLanguage(row);
  if (!scan.hate.length) return scan;
  const err = new Error(LISTING_HATE_SPEECH_ERROR);
  err.status = 400;
  err.code = 'listing_hate_speech_blocked';
  err.matches = scan.hate;
  throw err;
}

/**
 * Block hate speech whenever the listing would remain or become public.
 * Draft / unpublished saves are allowed so organisers can fix copy offline.
 */
function assertNoHateSpeechOnLiveListing(row, previousStatus) {
  const willBeLive = String(row?.status || '').toLowerCase() === 'published';
  if (!willBeLive) return scanEventListingLanguage(row);
  return assertNoHateSpeechForPublish(row);
}

module.exports = {
  LISTING_HATE_SPEECH_ERROR,
  HATE_TOKENS,
  PROFANITY_TOKENS,
  collectListingLanguageText,
  scanListingLanguage,
  scanEventListingLanguage,
  assertNoHateSpeechForPublish,
  assertNoHateSpeechOnLiveListing,
};
