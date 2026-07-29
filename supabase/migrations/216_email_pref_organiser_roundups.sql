-- Split Hub marketing vs organiser monthly round-up email preferences.

alter table public.hub_accounts
  add column if not exists email_pref_organiser_roundups boolean not null default true;

comment on column public.hub_accounts.email_pref_organiser_roundups is
  'Optional: monthly organiser group round-ups. Independent of Hub marketing (emails_enabled).';

-- Respect prior bundled marketing opt-outs: do not re-subscribe them to round-ups automatically.
update public.hub_accounts
set email_pref_organiser_roundups = false
where emails_enabled = false
  and email_pref_organiser_roundups = true;
