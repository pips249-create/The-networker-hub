-- Hubert Matchmaker: signup / first-login opt-in tracking (never auto-discoverable).
-- interest_at = they asked to join intros (still need blurb + looking-to-meet + Include me).
-- prompt_dismissed_at = "Maybe later" on the dashboard modal.

alter table public.attendees
  add column if not exists hubert_intros_interest_at timestamptz,
  add column if not exists hubert_intros_prompt_dismissed_at timestamptz;

comment on column public.attendees.hubert_intros_interest_at is
  'When the member opted in to Hubert intros (signup checkbox or Enable Intros). Discoverable still requires explicit Include me + profile.';

comment on column public.attendees.hubert_intros_prompt_dismissed_at is
  'When the member dismissed the first-login Hubert intros prompt (Maybe later).';

notify pgrst, 'reload schema';
