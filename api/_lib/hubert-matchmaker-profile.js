/**
 * Hubert Matchmaker member profile fields (blurb, looking-to-meet, discoverable).
 */
const LOOKING_TO_MEET_OPTIONS = [
  'Clients',
  'Investors',
  'Co-founders',
  'Hires',
  'Suppliers',
  'Mentors',
  'Partners',
  'Press',
];

const BLURB_MAX = 280;

function cleanLookingToMeet(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean);
  const allowed = new Map(LOOKING_TO_MEET_OPTIONS.map((o) => [o.toLowerCase(), o]));
  const out = [];
  const seen = new Set();
  list.forEach((item) => {
    const raw = String(item || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!raw) return;
    const canonical = allowed.get(raw.toLowerCase());
    const t = canonical || raw.slice(0, 80);
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  });
  return out.slice(0, 12);
}

function cleanMatchmakerBlurb(value) {
  const s = String(value == null ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return '';
  return s.slice(0, BLURB_MAX);
}

function parseDiscoverable(value, currentAt) {
  if (value === undefined) return undefined;
  const on =
    value === true ||
    value === 1 ||
    String(value).toLowerCase() === 'true' ||
    String(value).toLowerCase() === '1' ||
    String(value).toLowerCase() === 'on' ||
    String(value).toLowerCase() === 'yes';
  const off =
    value === false ||
    value === 0 ||
    String(value).toLowerCase() === 'false' ||
    String(value).toLowerCase() === '0' ||
    String(value).toLowerCase() === 'off' ||
    String(value).toLowerCase() === 'no';
  if (on) return currentAt || new Date().toISOString();
  if (off) return null;
  return undefined;
}

/**
 * Prefill helper from Hub booking fields — never auto-opts into discoverable.
 */
function suggestMatchmakerBlurb(attendee) {
  const role = String(attendee?.professional_role || attendee?.job_title || '')
    .trim()
    .replace(/\s+/g, ' ');
  const company = String(attendee?.company || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (role && company) return cleanMatchmakerBlurb(role + ' at ' + company);
  if (role) return cleanMatchmakerBlurb(role);
  if (company) return cleanMatchmakerBlurb('Works at ' + company);
  return '';
}

function matchmakerProfileFromAttendee(attendee) {
  const lookingToMeet = Array.isArray(attendee?.looking_to_meet) ? attendee.looking_to_meet.filter(Boolean) : [];
  const savedBlurb = String(attendee?.matchmaker_blurb || '').trim();
  const suggestedBlurb = suggestMatchmakerBlurb(attendee);
  const blurb = savedBlurb || suggestedBlurb;
  const discoverableAt = attendee?.discoverable_at || null;
  const discoverable = Boolean(discoverableAt);
  const matchmakerReady = Boolean(discoverable && savedBlurb && lookingToMeet.length);
  return {
    matchmakerBlurb: savedBlurb,
    suggestedBlurb,
    /** Prefill value for the form (saved wins; else Hub job/company suggestion). */
    matchmakerBlurbPrefill: blurb,
    lookingToMeet,
    discoverable,
    discoverableAt,
    lookingToMeetOptions: LOOKING_TO_MEET_OPTIONS.slice(),
    matchmakerReady,
    matchmakerMissing: [
      !savedBlurb ? 'headline' : null,
      !lookingToMeet.length ? 'lookingToMeet' : null,
      !discoverable ? 'discoverable' : null,
    ].filter(Boolean),
  };
}

function assertMatchmakerReady(attendeeOrProfile) {
  const profile =
    attendeeOrProfile && attendeeOrProfile.matchmakerMissing
      ? attendeeOrProfile
      : matchmakerProfileFromAttendee(attendeeOrProfile || {});
  if (profile.matchmakerReady) return profile;
  const err = new Error('profile_incomplete');
  err.code = 'profile_incomplete';
  err.message =
    'Finish your Hubert profile first — headline, who you want to meet, and Include me.';
  err.profile = profile;
  throw err;
}

module.exports = {
  LOOKING_TO_MEET_OPTIONS,
  BLURB_MAX,
  cleanLookingToMeet,
  cleanMatchmakerBlurb,
  parseDiscoverable,
  suggestMatchmakerBlurb,
  matchmakerProfileFromAttendee,
  assertMatchmakerReady,
};
