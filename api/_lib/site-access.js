const { signSession, verifySession } = require('./auth');

const COOKIE_NAME = 'hub_site_preview';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const TOKEN_TYPE = 'site_preview';

function isSiteAccessRequired() {
  return Boolean(String(process.env.SITE_ACCESS_PASSWORD || '').trim());
}

function getSiteAccessPassword() {
  return String(process.env.SITE_ACCESS_PASSWORD || '').trim();
}

function signSiteAccessToken(secret) {
  if (!secret) return null;
  return signSession(
    {
      type: TOKEN_TYPE,
      exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC,
    },
    secret
  );
}

function verifySiteAccessToken(token, secret) {
  const payload = verifySession(token, secret);
  if (!payload || payload.type !== TOKEN_TYPE) return null;
  return payload;
}

function setSiteAccessCookie(res) {
  const secret = process.env.SESSION_SECRET;
  const token = signSiteAccessToken(secret);
  if (!token) return false;

  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}${secure}`
  );
  return true;
}

function siteAccessStatus() {
  const required = isSiteAccessRequired();
  return {
    siteAccessRequired: required,
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    siteAccessReady: !required || Boolean(process.env.SESSION_SECRET),
  };
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SEC,
  TOKEN_TYPE,
  isSiteAccessRequired,
  getSiteAccessPassword,
  signSiteAccessToken,
  verifySiteAccessToken,
  setSiteAccessCookie,
  siteAccessStatus,
};
