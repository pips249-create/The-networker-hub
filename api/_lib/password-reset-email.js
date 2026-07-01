const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');

function siteHost() {
  return (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

async function createPasswordResetLink(email, redirectPath) {
  const sb = getSupabaseAdmin();
  const redirectTo = siteHost() + String(redirectPath || '/reset-password.html');
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email: String(email || '').trim().toLowerCase(),
    options: { redirectTo },
  });
  if (error) throw error;
  const resetUrl = data?.properties?.action_link || null;
  if (!resetUrl) {
    const err = new Error('reset_link_failed');
    err.code = 'reset_link_failed';
    throw err;
  }
  return resetUrl;
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
  createPasswordResetLink,
  sendPasswordResetEmail,
};
