/** Attendee row linked to Supabase Auth — not a checkout-only contact record. */
function hasLinkedAttendeeAccount(attendee) {
  return Boolean(String(attendee?.supabase_user_id || '').trim());
}

module.exports = {
  hasLinkedAttendeeAccount,
};
