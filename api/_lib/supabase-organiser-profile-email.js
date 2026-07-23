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
  return profileEmail(row) === em;
}

module.exports = {
  profileEmail,
  emailMatchesProfile,
};
