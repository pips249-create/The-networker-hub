const { hasLinkedAttendeeAccount } = require('./attendee-member-account');

function encodeQuery(params) {
  const parts = [];
  Object.keys(params).forEach((key) => {
    const val = params[key];
    if (val == null || val === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
  });
  return parts.join('&');
}

function buildReviewAccountFollowUp(attendee, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const includeEmailInUrls = opts.includeEmailInUrls !== false;
  const email = String(attendee?.email || '')
    .trim()
    .toLowerCase();
  const hasLinkedAccount = hasLinkedAttendeeAccount(attendee);
  const company = String(attendee?.company || '').trim();
  const jobTitle = String(attendee?.job_title || '').trim();
  const profileNeedsDetails = !company || !jobTitle;

  const settingsNext = '/account/settings';
  const registerParams = {
    intent: 'networker',
    next: settingsNext,
  };
  const loginParams = { next: settingsNext };
  if (includeEmailInUrls && email) {
    registerParams.email = email;
    loginParams.email = email;
  }

  return {
    hasLinkedAccount,
    profileNeedsDetails,
    registerUrl: hasLinkedAccount ? null : '/register?' + encodeQuery(registerParams),
    loginUrl: hasLinkedAccount ? null : '/login?' + encodeQuery(loginParams),
    accountUrl: '/account/#reviews-done',
    settingsUrl: settingsNext,
  };
}

module.exports = {
  buildReviewAccountFollowUp,
};
