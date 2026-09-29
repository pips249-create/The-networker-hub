/**
 * "Offer your services" from the attendee dashboard.
 * Emails partnerships@ with the signed-in member's name and email.
 */
const PARTNERSHIPS_EMAIL = String(
  process.env.PARTNERSHIPS_EMAIL || 'partnerships@thenetworkeruk.com'
)
  .trim()
  .toLowerCase();

const LIMITS = {
  offer: 500,
  audience: 200,
  website: 500,
};

function normalizeEmail(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, max) {
  const s = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.slice(0, max);
}

function escHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanWebsite(value) {
  const s = cleanText(value, LIMITS.website);
  if (!s) return '';
  let url;
  try {
    url = new URL(s);
  } catch {
    return { error: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'invalid_url' };
  if (url.username || url.password) return { error: 'invalid_url' };
  return url.toString();
}

function prepareMemberOfferEnquire(body, session) {
  const src = body && typeof body === 'object' ? body : {};
  const email = normalizeEmail(session && session.email);
  const name = cleanText(session && session.name, 120) || 'A member';
  if (!isValidEmail(email)) {
    return {
      ok: false,
      error: 'invalid_email',
      message: 'Sign in with an email address before sending this.',
    };
  }
  const offer = cleanText(src.offer || src.summary || src.what, LIMITS.offer);
  if (offer.length < 10) {
    return {
      ok: false,
      error: 'missing_offer',
      message: 'Tell us what you offer, in a sentence or two.',
    };
  }
  const audience = cleanText(src.audience || src.who, LIMITS.audience);
  const website = cleanWebsite(src.website || src.href || '');
  if (website && website.error) {
    return {
      ok: false,
      error: 'invalid_website',
      message: 'Enter a website that starts with https://, or leave it blank.',
    };
  }
  return {
    ok: true,
    input: {
      name: name,
      email: email,
      offer: offer,
      audience: audience,
      website: website || '',
    },
  };
}

function buildStaffEmailHtml(input) {
  return (
    '<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.5;color:#2d2636;">' +
    '<h2 style="margin:0 0 12px;font-size:18px;">Offer your services</h2>' +
    '<p style="margin:0 0 16px;">A member wants something featured on My services.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:520px;">' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Name</td><td><strong>' +
    escHtml(input.name) +
    '</strong></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0;color:#666;">Email</td><td><a href="mailto:' +
    escHtml(input.email) +
    '">' +
    escHtml(input.email) +
    '</a></td></tr>' +
    (input.audience
      ? '<tr><td style="padding:4px 12px 4px 0;color:#666;">Who it is for</td><td>' +
        escHtml(input.audience) +
        '</td></tr>'
      : '') +
    (input.website
      ? '<tr><td style="padding:4px 12px 4px 0;color:#666;">Website</td><td><a href="' +
        escHtml(input.website) +
        '">' +
        escHtml(input.website) +
        '</a></td></tr>'
      : '') +
    '</table>' +
    '<p style="margin:16px 0 0;"><strong>What they offer</strong><br>' +
    escHtml(input.offer) +
    '</p></div>'
  );
}

async function submitMemberOfferEnquire(body, session) {
  const prepared = prepareMemberOfferEnquire(body, session);
  if (!prepared.ok) return prepared;
  const input = prepared.input;
  const { sendViaResend } = require('./send-template-email');
  await sendViaResend({
    to: PARTNERSHIPS_EMAIL,
    subject: 'Offer your services — ' + input.name,
    html: buildStaffEmailHtml(input),
    replyTo: input.email,
    skipAllowlist: true,
    tags: [{ name: 'category', value: 'member_offer_enquire' }],
  });
  return {
    ok: true,
    message: "We've got it. We'll look into featuring this and reply from partnerships@thenetworkeruk.com.",
  };
}

module.exports = {
  PARTNERSHIPS_EMAIL,
  prepareMemberOfferEnquire,
  submitMemberOfferEnquire,
};
