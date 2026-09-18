-- Referral Partner Programme: recorded acceptance of programme terms.

alter table public.affiliate_partners
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists application_terms_agreed_at timestamptz;

comment on column public.affiliate_partners.terms_accepted_at is
  'When the partner accepted Referral Partner Terms (hub or accept page).';
comment on column public.affiliate_partners.terms_version is
  'Version id of terms accepted (see api/_lib/partner-terms.js).';
comment on column public.affiliate_partners.application_terms_agreed_at is
  'When they ticked terms on /partners apply (before invite).';
