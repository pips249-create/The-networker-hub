function profileEmail(row) {
  return String(row?.email || row?.contact_email || '')
    .trim()
    .toLowerCase();
}

function emailMatchesProfile(sessionEmail, row) {
  const em = String(sessionEmail || '')
    .trim()
    .toLowerCase();
  if (!em) return false;
  const profile = String(row?.email || '')
    .trim()
    .toLowerCase();
  const contact = String(row?.contact_email || '')
    .trim()
    .toLowerCase();
  return (profile && profile === em) || (contact && contact === em);
}

module.exports = {
  profileEmail,
  emailMatchesProfile,
};
