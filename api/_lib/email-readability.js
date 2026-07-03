/**
 * Typography and contrast tokens for HTML emails — aligned with public-site 40–55 UX pass.
 */
const EMAIL_TEXT_MUTED = '#635c5e';
const EMAIL_TEXT_SOFT = '#7a7274';

/** Map legacy px sizes to more readable equivalents (single-pass, no cascade). */
const EMAIL_FONT_SIZE_MAP = {
  10: 13,
  11: 13,
  12: 14,
  13: 15,
  14: 16,
  22: 24,
  26: 28,
};

const EMAIL_CTA_PADDING_REPLACEMENTS = [
  ['padding:8px 16px', 'padding:12px 22px'],
  ['padding:9px 20px', 'padding:12px 24px'],
  ['padding:10px 22px', 'padding:14px 28px'],
  ['padding:10px 24px', 'padding:14px 28px'],
  ['padding:10px 28px', 'padding:14px 32px'],
  ['padding:12px 28px', 'padding:14px 32px'],
];

const EMAIL_CTA_FONT_REPLACEMENTS = [
  ['font-size:14px;font-weight:600;color:#ffffff', 'font-size:16px;font-weight:600;color:#ffffff'],
  ['font-size:14px;font-weight:700;color:#ffffff', 'font-size:16px;font-weight:700;color:#ffffff'],
  ['font-size:15px;font-weight:700;', 'font-size:16px;font-weight:700;'],
  ['font-size:15px;font-weight:600;color:#ffffff', 'font-size:16px;font-weight:600;color:#ffffff'],
];

const EMAIL_LETTER_SPACING_REPLACEMENTS = [
  ['letter-spacing:3px', 'letter-spacing:1.5px'],
  ['letter-spacing:2.5px', 'letter-spacing:1px'],
  ['letter-spacing:2px', 'letter-spacing:1px'],
  ['letter-spacing:1.5px', 'letter-spacing:0.5px'],
];

function patchEmailReadability(html) {
  if (!html || typeof html !== 'string') return html;
  let out = html.replace(/#736b6e/gi, EMAIL_TEXT_MUTED).replace(/#9a9092/gi, EMAIL_TEXT_SOFT);
  out = out.replace(/font-size:\s*(\d+)px/gi, (match, px) => {
    const mapped = EMAIL_FONT_SIZE_MAP[parseInt(px, 10)];
    return mapped ? `font-size:${mapped}px` : match;
  });
  out = out.replace(/\.hero-title\s*\{\s*font-size:22px/g, '.hero-title { font-size:24px');
  for (const [from, to] of EMAIL_CTA_PADDING_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of EMAIL_CTA_FONT_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  for (const [from, to] of EMAIL_LETTER_SPACING_REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

module.exports = {
  EMAIL_TEXT_MUTED,
  EMAIL_TEXT_SOFT,
  EMAIL_FONT_SIZE_MAP,
  patchEmailReadability,
};
