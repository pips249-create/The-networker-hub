/**
 * Named inviters for admin seed The Networker UK invites (ops send as Catherine or Rosie).
 * Member invites always use the signed-in individual — never these personas.
 */
const HUB_INVITE_PERSONAS = {
  catherine: {
    key: 'catherine',
    name: 'Catherine Hancher',
    email: 'catherine@thenetworkeruk.com',
    defaultNote:
      'Catherine thought you’d be a good fit for The Networker UK and Hubert introductions.',
  },
  rosie: {
    key: 'rosie',
    name: 'Rosie McGilvray',
    email: 'rosie@thenetworkeruk.com',
    defaultNote:
      'Rosie thought you’d be a good fit for The Networker UK and Hubert introductions.',
  },
};

function resolveHubInvitePersona(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  if (HUB_INVITE_PERSONAS[key]) return HUB_INVITE_PERSONAS[key];
  if (key === 'catherine hancher' || key.indexOf('catherine') === 0) {
    return HUB_INVITE_PERSONAS.catherine;
  }
  if (key === 'rosie mcgilvray' || key.indexOf('rosie') === 0) {
    return HUB_INVITE_PERSONAS.rosie;
  }
  return null;
}

module.exports = {
  HUB_INVITE_PERSONAS,
  resolveHubInvitePersona,
};
