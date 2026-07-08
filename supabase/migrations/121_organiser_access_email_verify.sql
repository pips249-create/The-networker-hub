-- Organiser opt-in + email verification before publish, attendees, payouts, and claims.

alter table public.hub_accounts
  add column if not exists organiser_access_at timestamptz,
  add column if not exists organiser_email_verified_at timestamptz,
  add column if not exists organiser_email_verify_token_hash text,
  add column if not exists organiser_email_verify_expires_at timestamptz;

comment on column public.hub_accounts.organiser_access_at is
  'When the user opted in to organiser features (list events, manage groups).';
comment on column public.hub_accounts.organiser_email_verified_at is
  'When the user verified email ownership for organiser actions.';
comment on column public.hub_accounts.organiser_email_verify_token_hash is
  'SHA-256 hash of the pending organiser email verification token.';
comment on column public.hub_accounts.organiser_email_verify_expires_at is
  'Expiry for organiser_email_verify_token_hash.';

-- Existing organiser account owners: grandfather access + verification.
update public.hub_accounts ha
set
  organiser_access_at = coalesce(ha.organiser_access_at, now()),
  organiser_email_verified_at = coalesce(ha.organiser_email_verified_at, now())
where exists (
  select 1
  from public.organisers o
  where o.supabase_user_id = ha.user_id
    and o.ownership_claim_status = 'claimed'
);

update public.hub_accounts
set
  organiser_access_at = coalesce(organiser_access_at, now()),
  organiser_email_verified_at = coalesce(organiser_email_verified_at, now())
where role = 'admin';
