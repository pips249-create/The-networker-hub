/** Canonical public brand — The Networker UK (rebrand from The Networker Hub). */
const BRAND_NAME = 'The Networker UK';
const BRAND_NAME_SHORT = 'Networker UK';
const LEGAL_NAME = 'The Networker Group Ltd';
const DEFAULT_PUBLIC_SITE = 'https://www.thenetworkeruk.com';
const SUPPORT_EMAIL = 'hi@thenetworkeruk.com';
const MAIL_FROM_DOMAIN = 'mail.thenetworkeruk.com';
const LEGACY_MAIL_FROM_DOMAINS = ['mail.thenetworkeruk.com', 'mail.thenetworkerhub.com'];
const LOGO_ASSET_VERSION = '20260828email1';
/** Square logo — schema.org Organization.logo, favicons, UI. */
const LOGO_ASSET = '/assets/logo.png';
/** 1200×630 share card — og:image / twitter:image (not the square logo). */
const OG_SHARE_IMAGE = '/assets/logo-networker-uk-og.png?v=20260902og2';

/** Legacy / future hosts — keep for redirects and platform URL detection. */
const LEGACY_PUBLIC_HOSTS = [
  'thenetworkerhub.com',
  'www.thenetworkerhub.com',
  'thenetworkerhub.co.uk',
  'www.thenetworkerhub.co.uk',
  'thenetworkeruk.com',
  'www.thenetworkeruk.com',
  'the-networker.co.uk',
  'www.the-networker.co.uk',
  'the-networker.com',
  'www.the-networker.com',
];

module.exports = {
  BRAND_NAME,
  BRAND_NAME_SHORT,
  LEGAL_NAME,
  DEFAULT_PUBLIC_SITE,
  SUPPORT_EMAIL,
  MAIL_FROM_DOMAIN,
  LEGACY_MAIL_FROM_DOMAINS,
  LOGO_ASSET_VERSION,
  LOGO_ASSET,
  OG_SHARE_IMAGE,
  LEGACY_PUBLIC_HOSTS,
};
