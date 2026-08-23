/** Hub-owned seed listings — temporary owner until a company claims and pays. */
const HUB_SEED_OWNER_EMAIL = 'catherine@thenetworkeruk.com';

function isHubSeedOwnerEmail(email) {
  return (
    String(email || '')
      .trim()
      .toLowerCase() === HUB_SEED_OWNER_EMAIL
  );
}

module.exports = {
  HUB_SEED_OWNER_EMAIL,
  isHubSeedOwnerEmail,
};
