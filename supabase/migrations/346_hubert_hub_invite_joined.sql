-- Hubert Hub invites: credit inviters when invitees create an account.
-- Powers search-quota unlock (2 joined colleagues → 10 searches / week).

alter table public.hubert_hub_invites
  add column if not exists joined_at timestamptz,
  add column if not exists joined_attendee_id uuid references public.attendees (id) on delete set null;

create index if not exists hubert_hub_invites_inviter_joined_idx
  on public.hubert_hub_invites (inviter_attendee_id, joined_at desc)
  where joined_at is not null;

create index if not exists hubert_hub_invites_inviter_user_joined_idx
  on public.hubert_hub_invites (inviter_user_id, joined_at desc)
  where joined_at is not null and inviter_user_id is not null;

comment on column public.hubert_hub_invites.joined_at is
  'When the invitee created a Hub account (referral credit). Null until join.';
comment on column public.hubert_hub_invites.joined_attendee_id is
  'Attendee id created/claimed by the invitee at registration.';

notify pgrst, 'reload schema';
