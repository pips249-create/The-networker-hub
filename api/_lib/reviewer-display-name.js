/**
 * Public review attribution — first name + last initial only.
 * Never publish a full legal name or email on public review surfaces.
 */
function reviewerDisplayName(attendee) {
  const name = String(attendee?.name || '').trim();
  if (!name) return 'Attendee';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  if (!lastInitial) return parts[0];
  return parts[0] + ' ' + lastInitial + '.';
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

module.exports = {
  reviewerDisplayName,
  reviewerInitials,
};
