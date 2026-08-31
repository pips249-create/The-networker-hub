/** Hub-owned seed listings — temporary owner until a company claims and pays. */
const HUB_SEED_OWNER_EMAIL = 'catherine@thenetworkeruk.com';

function isHubSeedOwnerEmail(email) {
  return (
    String(email || '')
      .trim()
      .toLowerCase() === HUB_SEED_OWNER_EMAIL
  );
}

/**
 * Patch fields when admin Save listing includes owner_email.
 * Blank input keeps the listing hub-owned. Changing the email resets claim state
 * (Assign & send claim invite is what emails the invite).
 */
function buildOwnerEmailSavePatch(rawInput, previousOwnerEmail) {
  const raw = String(rawInput || '')
    .trim()
    .toLowerCase();
  const ownerEmail = raw || HUB_SEED_OWNER_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    const err = new Error('invalid_owner_email');
    err.code = 'invalid_owner_email';
    throw err;
  }
  const previous = String(previousOwnerEmail || '')
    .trim()
    .toLowerCase();
  const patch = { owner_email: ownerEmail };
  if (ownerEmail !== previous) {
    patch.supabase_user_id = null;
    patch.ownership_claimed_at = null;
    patch.ownership_disputed_at = null;
    patch.ownership_disputed_by_email = null;
    patch.ownership_claim_status = isHubSeedOwnerEmail(ownerEmail) ? null : 'pending';
  } else if (isHubSeedOwnerEmail(ownerEmail)) {
    patch.ownership_claim_status = null;
  }
  return patch;
}

module.exports = {
  HUB_SEED_OWNER_EMAIL,
  isHubSeedOwnerEmail,
  buildOwnerEmailSavePatch,
};
