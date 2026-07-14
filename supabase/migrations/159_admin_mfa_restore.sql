-- Restore admin Command Centre TOTP MFA (separate from Supabase Auth MFA).

create table if not exists public.admin_mfa_secrets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  secret_encrypted text not null,
  enrolled_at timestamptz not null default now(),
  last_verified_at timestamptz
);

comment on table public.admin_mfa_secrets is
  'TOTP secrets for platform admins — required before Command Centre API access.';

alter table public.admin_mfa_secrets enable row level security;

revoke all on table public.admin_mfa_secrets from anon, authenticated;
