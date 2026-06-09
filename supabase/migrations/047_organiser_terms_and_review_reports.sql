-- Persist organiser terms acceptance + review reports (CMA / moderation)

alter table public.hub_accounts
  add column if not exists organiser_terms_accepted_at timestamptz,
  add column if not exists organiser_terms_version text;

comment on column public.hub_accounts.organiser_terms_accepted_at is 'When the user accepted organiser terms before first publish';
comment on column public.hub_accounts.organiser_terms_version is 'Version slug of accepted organiser terms (e.g. v1)';

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  review_id uuid references public.reviews(id) on delete set null,
  organiser_id uuid references public.organisers(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  review_snippet text not null default '',
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed'))
);

create index if not exists idx_review_reports_status_created
  on public.review_reports(status, created_at desc);

create index if not exists idx_review_reports_review_id
  on public.review_reports(review_id);
