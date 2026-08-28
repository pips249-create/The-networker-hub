-- Separate acceptance for business opportunity listings (addendum to organiser terms §4).

alter table public.hub_accounts
  add column if not exists organiser_opportunity_terms_accepted_at timestamptz,
  add column if not exists organiser_opportunity_terms_version text;

comment on column public.hub_accounts.organiser_opportunity_terms_accepted_at is 'When the user accepted business listing terms before first opportunity submit';
comment on column public.hub_accounts.organiser_opportunity_terms_version is 'Version slug of accepted business listing terms (e.g. v1)';
