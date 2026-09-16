-- Tailored organiser sales pitch decks (Command Centre → Pitch deck tab).

create table if not exists public.custom_pitch_decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  company_name text not null,
  website text,
  contact_name text,
  organiser_id uuid references public.organisers(id) on delete set null,
  include_sections text[] not null default '{}',
  brief text,
  deck jsonb not null default '{}'::jsonb,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_pitch_decks_slug_format check (slug ~ '^custom-[a-z0-9-]+$')
);

create index if not exists custom_pitch_decks_created_at_idx
  on public.custom_pitch_decks (created_at desc);

create index if not exists custom_pitch_decks_company_name_idx
  on public.custom_pitch_decks (lower(company_name));

comment on table public.custom_pitch_decks is
  'Internal tailored sales pitch decks generated from Command Centre (unlisted /p-tnh-custom-* URLs).';

alter table public.custom_pitch_decks enable row level security;

revoke all on table public.custom_pitch_decks from anon, authenticated;
grant select, insert, update, delete on table public.custom_pitch_decks to service_role;
