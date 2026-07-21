/**
 * Detect organiser signup intent and opt users in without a separate enable step
 * when they arrive from for-organisers CTAs (still requires email verification).
 */
const { isClientRole, setHubViewCookie } = require('./auth');
const sbAuth = require('./supabase-auth');
const { getOrganiserAccessStatus } = require('./organiser-access-guard');
const { sendOrganiserEmailVerification } = require('./organiser-email-verification');

function organiserPathFromNext(next) {
  const raw = String(next || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).pathname || '';
    return raw.split('?')[0].split('#')[0];
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
}

function isOrganiserAuthIntent({ next, intent } = {}) {
  const value = String(intent || '')
    .trim()
    .toLowerCase();
  if (value === 'organiser' || value === 'organiser-claim') return true;
  const path = organiserPathFromNext(next);
  return /^\/organiser(\/|$)/.test(path);
}

function isOrganiserClaimNext(next) {
  return String(next || '').indexOf('onboard=claim') !== -1;
}

async function resolveOrganiserRedirect(session) {
  const status = await getOrganiserAccessStatus(session);
  if (status.pendingClaimCount > 0) {
    return '/organiser/?onboard=claim';
  }
  if (status.organiserEmailVerified) {
    return '/organiser/';
  }
  return '/organiser/verify-email';
}

async function maybeAutoEnableOrganiserAccess(session, res) {
  if (!session?.sub || !isClientRole(session.role)) {
    return { enabled: false, redirect: null };
  }

  const before = await getOrganiserAccessStatus(session);
  if (before.organiserAccess) {
    return {
      enabled: false,
      alreadyEnabled: true,
      redirect: await resolveOrganiserRedirect(session),
    };
  }

  if (before.pendingClaimCount > 0) {
    return {
      enabled: false,
      bootstrapped: true,
      redirect: '/organiser/?onboard=claim',
    };
  }

  await sbAuth.enableOrganiserAccess(session.sub);
  setHubViewCookie(res, 'organiser');

  if (!before.organiserEmailVerified) {
    try {
      await sendOrganiserEmailVerification({
        userId: session.sub,
        email: session.email,
        name: session.name,
      });
    } catch {
      /* enable succeeds even if verification email fails */
    }
  }

  return {
    enabled: true,
    redirect: await resolveOrganiserRedirect(session),
  };
}

function redirectAfterOrganiserAuth({ next, intent, autoResult, defaultRedirect }) {
  if (!isOrganiserAuthIntent({ next, intent })) {
    return defaultRedirect;
  }
  const trimmedNext = String(next || '').trim();
  const claimIntent = String(intent || '').trim().toLowerCase() === 'organiser-claim';
  if (claimIntent || isOrganiserClaimNext(trimmedNext)) {
    return trimmedNext || '/organiser/?onboard=claim';
  }
  if (autoResult?.redirect) return autoResult.redirect;
  return trimmedNext || '/organiser/';
}

module.exports = {
  isOrganiserAuthIntent,
  maybeAutoEnableOrganiserAccess,
  resolveOrganiserRedirect,
  redirectAfterOrganiserAuth,
};
