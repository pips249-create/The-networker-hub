/** Canonical public brand — The Networker UK (rebrand from The Networker Hub). */
const BRAND_NAME = 'The Networker UK';
const BRAND_NAME_SHORT = 'Networker UK';
const LEGAL_NAME = 'The Networker Group Ltd';
const DEFAULT_PUBLIC_SITE = 'https://www.thenetworkeruk.com';
const SUPPORT_EMAIL = 'hi@thenetworkeruk.com';
const MAIL_FROM_DOMAIN = 'mail.thenetworkeruk.com';
const LEGACY_MAIL_FROM_DOMAINS = ['mail.thenetworkeruk.com', 'mail.thenetworkerhub.com'];
const LOGO_ASSET_VERSION = '20260823uk3';

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
  LEGACY_PUBLIC_HOSTS,
};
