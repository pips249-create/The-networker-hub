/** Shared word limits for public-facing copy fields. */
const DESCRIPTION_MAX_WORDS = 500;

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function descriptionTooLong(text) {
  return countWords(text) > DESCRIPTION_MAX_WORDS;
}

function descriptionLimitError(fieldLabel) {
  const label = fieldLabel || 'Description';
  const err = new Error(`${label} must be ${DESCRIPTION_MAX_WORDS} words or fewer.`);
  err.code = 'description_too_long';
  err.status = 400;
  return err;
}

function assertDescriptionLimit(text, fieldLabel) {
  if (descriptionTooLong(text)) throw descriptionLimitError(fieldLabel);
  return String(text || '').trim();
}

module.exports = {
  DESCRIPTION_MAX_WORDS,
  countWords,
  descriptionTooLong,
  descriptionLimitError,
  assertDescriptionLimit,
};
