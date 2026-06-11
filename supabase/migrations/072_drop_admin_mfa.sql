-- Remove unused admin TOTP MFA (replaced by email password recovery).

drop table if exists public.admin_mfa_secrets;
