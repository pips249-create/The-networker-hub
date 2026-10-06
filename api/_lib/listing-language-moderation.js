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

function pluralFormsForTerm(term) {
  const forms = [term + 's'];
  // English -es only applies to stems ending in s, x, z, ch, or sh
  // (bitch → bitches). Adding -es to every stem flags "spices" as "spic".
  if (/(?:s|x|z|ch|sh)$/.test(term)) forms.push(term + 'es');
  return forms;
}

function tokenEqualsTerm(token, term) {
  if (token === term) return true;
  // Simple plurals so "rapists" still matches "rapist"
  const plurals = pluralFormsForTerm(term);
  for (let i = 0; i < plurals.length; i++) {
    if (token === plurals[i]) return true;
  }
  return false;
}

/**
 * Whole-token matches, plus obfuscation like n.i.g.g.e.r after collapse.
 * Do NOT use naive collapsed.includes — that flags "therapist" as "rapist".
 */
function matchesTokenList(collapsed, tokens, list) {
  const hits = new Set();
  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (tokenEqualsTerm(tokens[i], list[j])) hits.add(list[j]);
    }
  }
  for (let i = 0; i < list.length; i++) {
    const term = list[i];
    if (term.length >= 4 && collapsed === term) {
      hits.add(term);
      continue;
    }
    // Obfuscated slur across punctuation/spaces only when no longer clean
    // word already contains the term (avoids therapist → rapist).
    if (term.length < 5 || !collapsed.includes(term)) continue;
    const embeddedInLongerWord = tokens.some(
      (t) => t.length > term.length && t.includes(term) && !tokenEqualsTerm(t, term)
    );
    if (!embeddedInLongerWord) hits.add(term);
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
      if (term.length < 4 || !collapsed.includes(term)) continue;
      const embeddedInLongerWord = tokens.some(
        (t) => t.length > term.length && t.includes(term) && !tokenEqualsTerm(t, term)
      );
      if (embeddedInLongerWord) continue;
      profanity.push(term);
      break;
    }
  }

  return { hate: hateUnique, profanity };
}

function originalChunks(raw) {
  const chunks = [];
  const re = /\S+/g;
  let match;
  const text = String(raw || '');
  while ((match = re.exec(text))) {
    const trimmed = match[0].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (trimmed) chunks.push(trimmed);
  }
  return chunks;
}

/**
 * The words the organiser actually wrote, so a rejection can point at them.
 * Single words first; otherwise the shortest phrase that still matches
 * (covers "white power" and "n.i.g.g.e.r" / "n i g g e r").
 */
function findExcerpts(raw, terms) {
  const chunks = originalChunks(raw);
  const excerpts = [];
  const seen = new Set();
  function add(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    excerpts.push(clean);
  }

  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];
    const direct = chunks.filter((chunk) => scanListingLanguage(chunk).hate.includes(term));
    if (direct.length) {
      direct.forEach(add);
      continue;
    }
    const maxWindow = Math.min(chunks.length, 8);
    let foundWindow = false;
    for (let size = 2; size <= maxWindow && !foundWindow; size++) {
      for (let i = 0; i + size <= chunks.length; i++) {
        const phrase = chunks.slice(i, i + size).join(' ');
        if (!scanListingLanguage(phrase).hate.includes(term)) continue;
        add(phrase);
        foundWindow = true;
      }
    }
    if (!foundWindow) add(term);
  }
  return excerpts;
}

function scanEventListingLanguage(row) {
  const parts = [
    { field: 'title', text: row?.title },
    { field: 'description', text: row?.description },
  ];
  const hate = [];
  const profanity = [];
  const fields = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const scan = scanListingLanguage(part.text);
    scan.profanity.forEach((term) => {
      if (!profanity.includes(term)) profanity.push(term);
    });
    if (!scan.hate.length) continue;
    scan.hate.forEach((term) => {
      if (!hate.includes(term)) hate.push(term);
    });
    fields.push({
      field: part.field,
      excerpts: findExcerpts(part.text, scan.hate),
    });
  }
  return { hate, profanity, fields };
}

const LISTING_HATE_MESSAGE_MAX = 270;

function clipExcerpt(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= 48) return clean;
  return clean.slice(0, 45) + '…';
}

function listingHateSpeechMessage(fields) {
  const sentences = [];
  (fields || []).forEach((field) => {
    const label = field.field === 'title' ? 'title' : 'description';
    const excerpts = [];
    (field.excerpts || []).forEach((item) => {
      const clipped = clipExcerpt(item);
      if (clipped && !excerpts.includes(clipped)) excerpts.push(clipped);
    });
    const shown = excerpts.slice(0, 3);
    if (!shown.length) return;
    sentences.push('In the ' + label + ', remove ' + shown.map((item) => '“' + item + '”').join(', '));
  });
  const lead =
    'This listing can’t go live because of language that isn’t allowed on The Networker UK (hate speech or extreme abuse). ';
  if (!sentences.length) return LISTING_HATE_SPEECH_ERROR;
  let message = lead + sentences.join('. ') + '.';
  if (message.length <= LISTING_HATE_MESSAGE_MAX) return message;
  const shortLead = 'This listing can’t go live because of language that isn’t allowed. ';
  message = shortLead + sentences.join('. ') + '.';
  if (message.length <= LISTING_HATE_MESSAGE_MAX) return message;
  return message.slice(0, LISTING_HATE_MESSAGE_MAX - 1) + '…';
}

function listingLanguagePublicExtra(fields) {
  const safe = [];
  (fields || []).forEach((field) => {
    if (field.field !== 'title' && field.field !== 'description') return;
    const excerpts = [];
    (field.excerpts || []).forEach((item) => {
      const clean = String(item || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (clean && excerpts.length < 4 && !excerpts.includes(clean)) excerpts.push(clean);
    });
    if (excerpts.length) safe.push({ field: field.field, excerpts });
  });
  if (!safe.length) return undefined;
  return { language: { fields: safe } };
}

function assertNoHateSpeechForPublish(row) {
  const scan = scanEventListingLanguage(row);
  if (!scan.hate.length) return scan;
  const err = new Error(listingHateSpeechMessage(scan.fields));
  err.status = 400;
  err.code = 'listing_hate_speech_blocked';
  err.matches = scan.hate;
  err.language = { fields: scan.fields };
  err.publicExtra = listingLanguagePublicExtra(scan.fields);
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
  findExcerpts,
  listingHateSpeechMessage,
  assertNoHateSpeechForPublish,
  assertNoHateSpeechOnLiveListing,
};
