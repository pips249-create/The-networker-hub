-- Hubert Matchmaker private seed list (Rosie / ops).
-- Not publicly browsable; used only for back-of-house shortlists + invite emails.

create table if not exists public.hubert_match_seed (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text,
  company text,
  job_title text,
  industry text,
  professional_role text,
  looking_to_meet text[] not null default '{}',
  linkedin_url text,
  blurb text,
  source text not null default 'rosie',
  status text not null default 'active'
    check (status in ('active', 'paused', 'converted', 'do_not_contact')),
  reminder_sent_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  converted_attendee_id uuid references public.attendees (id) on delete set null,
  created_by_user_id uuid,
  notes text
);

create index if not exists hubert_match_seed_status_idx
  on public.hubert_match_seed (status, updated_at desc);

create unique index if not exists hubert_match_seed_email_unique
  on public.hubert_match_seed (lower(email))
  where email is not null and length(trim(email)) > 0;

comment on table public.hubert_match_seed is
  'Private Hubert Matchmaker seed contacts (admin/Rosie). Not a public directory.';

alter table public.hubert_match_seed enable row level security;
