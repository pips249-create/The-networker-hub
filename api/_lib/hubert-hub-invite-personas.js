/**
 * Named inviters for admin seed The Networker UK invites (ops send as Catherine or Rosie).
 * Member invites always use the signed-in individual — never these personas.
 */
const HUB_INVITE_PERSONAS = {
  catherine: {
    key: 'catherine',
    name: 'Catherine Hancher',
    email: 'catherine@thenetworkeruk.com',
    // Casual fallback when ops leave the custom note blank — avoid repeating
    // the “warm intros / both sides say yes” body copy below.
    defaultNote:
      'Catherine thought you’d love connecting with our UK business network.',
  },
  rosie: {
    key: 'rosie',
    name: 'Rosie McGilvray',
    email: 'rosie@thenetworkeruk.com',
    defaultNote:
      'Rosie thought you’d love connecting with our UK business network.',
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
