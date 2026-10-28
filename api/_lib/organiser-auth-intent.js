/**
 * Detect organiser signup intent and opt users in without a separate enable step
 * when they arrive from for-organisers CTAs (still requires email verification).
 *
 * Organiser workspace access and the Welcome email both wait until the inbox
 * confirmation code succeeds — matching a directory email is not enough.
 */
const { isClientRole, setHubViewCookie } = require('./auth');
const sbAuth = require('./supabase-auth');
const { getSupabaseAdmin } = require('./supabase');
const { getOrganiserAccessStatus } = require('./organiser-access-guard');
const { sendOrganiserEmailVerification } = require('./organiser-email-verification');
const {
  buildEmailVerifyRedirect,
  parseVerifyEmailPath,
} = require('./organiser-email-verify-paths');

const ORGANISER_ACCESS_PENDING_KEY = 'organiser_access_pending';

async function setOrganiserAccessPending(userId, pending) {
  const uid = String(userId || '').trim();
  if (!uid) return { ok: false, skipped: true, reason: 'missing_user' };

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) {
    return { ok: false, skipped: true, reason: 'user_not_found' };
  }

  const user_metadata = { ...(data.user.user_metadata || {}) };
  if (pending) {
    user_metadata[ORGANISER_ACCESS_PENDING_KEY] = true;
  } else {
    delete user_metadata[ORGANISER_ACCESS_PENDING_KEY];
  }
  const { error: updateError } = await sb.auth.admin.updateUserById(uid, { user_metadata });
  if (updateError) throw new Error(updateError.message);
  return { ok: true, pending: Boolean(pending) };
}

async function hasOrganiserAccessPending(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.admin.getUserById(uid);
  if (error || !data?.user) return false;
  return Boolean(data.user.user_metadata?.[ORGANISER_ACCESS_PENDING_KEY]);
}

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
  // /organiser/verify-email is shared by every account (attendee + organiser).
  // Only the post-confirm ?next= destination can imply organiser intent — otherwise
  // login treats a confirm-email recovery as organiser enable and resends a fresh
  // code that invalidates the digits still in the inbox link.
  const verify = parseVerifyEmailPath(next);
  if (verify) {
    return isOrganiserAuthIntent({ next: verify.next || '', intent: '' });
  }
  const path = organiserPathFromNext(next);
  return /^\/organiser(\/|$)/.test(path);
}

function isOrganiserClaimNext(next) {
  return String(next || '').indexOf('onboard=claim') !== -1;
}

/** True when next is verify-email and still carries the confirmation code or legacy token. */
function hasVerifyEmailToken(next) {
  const raw = String(next || '').trim();
  if (!raw) return false;
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, 'https://example.com');
    return (
      /^\/organiser\/verify-email(?:\.html)?\/?$/.test(url.pathname) &&
      !!(url.searchParams.get('token') || url.searchParams.get('code'))
    );
  } catch {
    return (
      raw.indexOf('/organiser/verify-email') !== -1 &&
      (raw.indexOf('token=') !== -1 || raw.indexOf('code=') !== -1)
    );
  }
}

async function resolveOrganiserRedirect(session) {
  const status = await getOrganiserAccessStatus(session);
  // Inbox confirmation first — matching a directory email is not enough.
  if (!status.organiserEmailVerified) {
    return '/organiser/verify-email';
  }
  if (status.pendingClaimCount > 0) {
    return '/organiser/?onboard=claim';
  }
  const pendingIntent = await hasOrganiserAccessPending(session.sub).catch(() => false);
  if (
    pendingIntent ||
    status.organiserAccess ||
    status.organiserProfiles > 0 ||
    status.ownedOpportunityCount > 0
  ) {
    return '/organiser/';
  }
  // Attendee-only accounts continue to the welcome onboarding after confirm.
  return '/welcome';
}

async function maybeAutoEnableOrganiserAccess(session, res, options = {}) {
  if (!session?.sub || !isClientRole(session.role)) {
    return { enabled: false, redirect: null };
  }

  const skipVerificationEmail = Boolean(options.skipVerificationEmail);

  const before = await getOrganiserAccessStatus(session);
  if (!before.organiserEmailVerified) {
    try {
      await setOrganiserAccessPending(session.sub, true);
    } catch {
      /* Verify screen can still complete; enable-after-verify is best-effort */
    }
    setHubViewCookie(res, 'organiser');
    if (!skipVerificationEmail) {
      try {
        await sendOrganiserEmailVerification({
          userId: session.sub,
          email: session.email,
          name: session.name,
        });
      } catch {
        /* The verify screen can resend. Do not put the code in this redirect. */
      }
    }
    return {
      enabled: false,
      pendingVerification: true,
      redirect: '/organiser/verify-email',
    };
  }

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
  try {
    await setOrganiserAccessPending(session.sub, false);
  } catch {
    /* Access is already enabled */
  }
  setHubViewCookie(res, 'organiser');

  return {
    enabled: true,
    redirect: await resolveOrganiserRedirect(session),
  };
}

/**
 * After a successful inbox code submit, grant organiser access when the user
 * asked for it (CTA / enable) or already matches a pending claim / profile.
 */
async function maybeEnableOrganiserAccessAfterEmailVerify(session, res) {
  if (!session?.sub || !isClientRole(session.role)) {
    return { enabled: false };
  }

  const status = await getOrganiserAccessStatus(session);
  if (!status.organiserEmailVerified) {
    return { enabled: false, reason: 'email_not_verified' };
  }

  const pendingIntent = await hasOrganiserAccessPending(session.sub).catch(() => false);
  const shouldEnable =
    pendingIntent ||
    status.organiserAccess ||
    status.pendingClaimCount > 0 ||
    status.organiserProfiles > 0 ||
    status.ownedOpportunityCount > 0;

  if (!shouldEnable) {
    return { enabled: false, reason: 'no_organiser_intent' };
  }

  if (!status.organiserAccessAt) {
    await sbAuth.enableOrganiserAccess(session.sub);
  }
  try {
    await setOrganiserAccessPending(session.sub, false);
  } catch {
    /* Access grant is the important part */
  }
  setHubViewCookie(res, 'organiser');
  return { enabled: true };
}

function isPreservableOrganiserDeepLink(next) {
  const path = organiserPathFromNext(next);
  if (!path || path === '/organiser' || path === '/organiser/') return false;
  return /^\/organiser(\/|$)/.test(path);
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
  // Keep email confirmation tokens — autoResult.redirect is a bare verify path.
  if (hasVerifyEmailToken(trimmedNext)) {
    return trimmedNext;
  }
  // Pay links and other organiser deep links beat a generic /organiser/ redirect.
  if (isPreservableOrganiserDeepLink(trimmedNext)) {
    return trimmedNext;
  }
  if (autoResult?.redirect) return autoResult.redirect;
  return trimmedNext || '/organiser/';
}

module.exports = {
  ORGANISER_ACCESS_PENDING_KEY,
  isOrganiserAuthIntent,
  isOrganiserClaimNext,
  isPreservableOrganiserDeepLink,
  maybeAutoEnableOrganiserAccess,
  maybeEnableOrganiserAccessAfterEmailVerify,
  setOrganiserAccessPending,
  hasOrganiserAccessPending,
  resolveOrganiserRedirect,
  redirectAfterOrganiserAuth,
  buildEmailVerifyRedirect,
  parseVerifyEmailPath,
  hasVerifyEmailToken,
};
