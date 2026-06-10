function wrapSponsorRow(sponsorInner) {
  const inner = String(sponsorInner || '').trim();
  if (!inner) return '';
  if (/^<tr[\s>]/i.test(inner)) return inner;
  return '<tr><td>' + inner + '</td></tr>';
}

function attendeeInitial(name) {
  const text = String(name || '').trim();
  if (!text) return '?';
  return text.charAt(0).toUpperCase();
}

function enrichOrganiserRegistrationVars(vars, sponsorSection) {
  const input = vars && typeof vars === 'object' ? vars : {};
  const attendeeName = String(input.attendee_name || input.user_name || '').trim() || 'Guest';
  const attendeeEmail = String(input.attendee_email || input.user_email || '').trim();
  const sponsorRow = wrapSponsorRow(sponsorSection);

  return {
    ...input,
    attendee_name: attendeeName,
    attendee_email: attendeeEmail,
    attendee_initial: String(input.attendee_initial || '').trim() || attendeeInitial(attendeeName),
    booking_time: String(input.booking_time || input.booked_at || '').trim(),
    user_name: attendeeName,
    user_email: attendeeEmail,
    sponsor_row: sponsorRow,
    sponsor_section: sponsorRow,
  };
}

const ORGANISER_SECTION_PLACEHOLDERS = ['sponsor_row', 'sponsor_section'];

function stripUnresolvedOrganiserPlaceholders(html) {
  let out = String(html || '');
  for (const key of ORGANISER_SECTION_PLACEHOLDERS) {
    const re = new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g');
    out = out.replace(re, '');
  }
  return out;
}

module.exports = {
  enrichOrganiserRegistrationVars,
  stripUnresolvedOrganiserPlaceholders,
  attendeeInitial,
  ORGANISER_SECTION_PLACEHOLDERS,
};
