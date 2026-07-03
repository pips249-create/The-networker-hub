const crypto = require('crypto');

const COOKIE_NAME = 'hub_site_preview';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const TOKEN_TYPE = 'site_preview';

/** TEMP: off for PageSpeed testing — set to false before launch (or use DISABLE_SITE_ACCESS_GATE in Vercel). */
function isSiteAccessGateDisabled() {
  const flag = String(process.env.DISABLE_SITE_ACCESS_GATE || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  return true;
}

function isSiteAccessRequired() {
  if (isSiteAccessGateDisabled()) return false;
  return Boolean(String(process.env.SITE_ACCESS_PASSWORD || '').trim());
}

function getSiteAccessPassword() {
  return String(process.env.SITE_ACCESS_PASSWORD || '').trim();
}

function getPreviewCookieSecret() {
  return getSiteAccessPassword();
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signSiteAccessToken(secret) {
  if (!secret) return null;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      type: TOKEN_TYPE,
      exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC,
    })
  );
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function buildSiteAccessCookie(token) {
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}${secure}`;
}

function setSiteAccessCookie(res) {
  const token = signSiteAccessToken(getPreviewCookieSecret());
  if (!token) return false;
  res.setHeader('Set-Cookie', buildSiteAccessCookie(token));
  return true;
}

function siteAccessStatus() {
  const required = isSiteAccessRequired();
  const hasPassword = Boolean(getSiteAccessPassword());
  return {
    siteAccessRequired: required,
    hasSiteAccessPassword: hasPassword,
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    siteAccessReady: !required || hasPassword,
  };
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE_SEC,
  TOKEN_TYPE,
  isSiteAccessRequired,
  getSiteAccessPassword,
  getPreviewCookieSecret,
  signSiteAccessToken,
  buildSiteAccessCookie,
  setSiteAccessCookie,
  siteAccessStatus,
};
