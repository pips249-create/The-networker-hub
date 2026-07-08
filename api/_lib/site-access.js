const crypto = require('crypto');

const COOKIE_NAME = 'hub_site_preview';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const TOKEN_TYPE = 'site_preview';

function isSiteAccessGateDisabled() {
  const flag = String(process.env.DISABLE_SITE_ACCESS_GATE || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
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

function cookieSecureSuffix() {
  return process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
}

function buildSiteAccessCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SEC}${cookieSecureSuffix()}`;
}

function buildClearedSiteAccessCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieSecureSuffix()}`;
}

function setSiteAccessCookie(res) {
  const token = signSiteAccessToken(getPreviewCookieSecret());
  if (!token) return false;
  res.setHeader('Set-Cookie', buildSiteAccessCookie(token));
  return true;
}

function clearSiteAccessCookie(res) {
  res.setHeader('Set-Cookie', buildClearedSiteAccessCookie());
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
  buildClearedSiteAccessCookie,
  setSiteAccessCookie,
  clearSiteAccessCookie,
  siteAccessStatus,
};
