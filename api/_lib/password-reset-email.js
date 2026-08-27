const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');

/**
 * Absolute public origin for auth redirects / reset links.
 * Never return a protocol-relative or https:/host (single-slash) value — that makes
 * Supabase treat the redirect as a path on *.supabase.co ("requested path is invalid").
 */
function publicAuthSite() {
  const raw = String(
    process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.thenetworkeruk.com'
  ).trim();
  if (!raw) return 'https://www.thenetworkeruk.com';

  let url = raw.replace(/\/$/, '');
  // Fix https:/host or http:/host (missing slash) before URL parsing.
  url = url.replace(/^(https?:)\/(?!\/)/i, '$1//');
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url.replace(/^\/+/, '');
  }
  if (!/localhost|127\.0\.0\.1/i.test(url)) {
    url = url.replace(/^http:\/\//i, 'https://');
  }

  try {
    return new URL(url).origin;
  } catch {
    return 'https://www.thenetworkeruk.com';
  }
}

function resetPagePath(redirectPath) {
  const path = String(redirectPath || '/reset-password').trim() || '/reset-password';
  return path.startsWith('/') ? path : '/' + path;
}

/**
 * Build a Hub-hosted reset URL that does not depend on Supabase Auth Site URL.
 * Supabase dashboard Site URL is currently broken (https:/www.thenetworkerhub.com),
 * so action_link redirects land on *.supabase.co/www… and fail.
 */
async function createPasswordResetLink(email, redirectPath) {
  const sb = getSupabaseAdmin();
  const site = publicAuthSite();
  const path = resetPagePath(redirectPath);
  const redirectTo = site + path;

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email: String(email || '').trim().toLowerCase(),
    options: { redirectTo },
  });
  if (error) throw error;

  const hashedToken = String(data?.properties?.hashed_token || '').trim();
  if (hashedToken) {
    return (
      site +
      path +
      '?token_hash=' +
      encodeURIComponent(hashedToken) +
      '&type=recovery'
    );
  }

  // Last resort: rewrite redirect_to on Supabase's action_link.
  const actionLink = String(data?.properties?.action_link || '').trim();
  if (actionLink) {
    try {
      const u = new URL(actionLink);
      u.searchParams.set('redirect_to', redirectTo);
      return u.toString();
    } catch {
      return actionLink;
    }
  }

  const err = new Error('reset_link_failed');
  err.code = 'reset_link_failed';
  throw err;
}

async function sendPasswordResetEmail({ email, userName, redirectPath }) {
  const address = String(email || '').trim().toLowerCase();
  if (!address) {
    const err = new Error('missing_email');
    err.code = 'missing_email';
    throw err;
  }

  const resetUrl = await createPasswordResetLink(address, redirectPath);
  const name = String(userName || '').trim() || address.split('@')[0];

  return {
    ...(await sendTemplatedEmail({
      slug: 'password_reset',
      to: address,
      variables: {
        user_name: name,
        reset_url: resetUrl,
      },
      skipEmailCheck: true,
    })),
    reset_url: resetUrl,
  };
}

module.exports = {
  publicAuthSite,
  createPasswordResetLink,
  sendPasswordResetEmail,
};
