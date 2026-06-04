-- Hub platform layer — roles, hub mode, organiser publish status
-- Run after 001_initial_schema.sql in Supabase SQL Editor

-- Admin / client role + attendee ↔ organiser nav mode (replaces Airtable Users.Role)
create table if not exists public.hub_accounts (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  role          text not null default 'client' check (role in ('admin', 'client')),
  hub_view      text not null default 'attendee' check (hub_view in ('attendee', 'organiser')),
  display_name  text
);

alter table public.hub_accounts enable row level security;

create policy "Users read own hub account"
  on public.hub_accounts for select
  using (user_id = auth.uid());

create policy "Users update own hub account"
  on public.hub_accounts for update
  using (user_id = auth.uid());

-- Organiser dashboard draft / publish (separate from verification_status)
alter table public.organisers
  add column if not exists listing_status text default 'draft'
    check (listing_status in ('draft', 'published', 'unpublished'));

-- Sign-up: link profiles to auth user
create policy "Users can insert own attendee profile"
  on public.attendees for insert
  with check (supabase_user_id = auth.uid());

create policy "Users can insert own organiser profile"
  on public.organisers for insert
  with check (supabase_user_id = auth.uid());

-- Public organiser pages: verified OR explicitly published listing
drop policy if exists "Public can view verified organisers" on public.organisers;

create policy "Public can view listed organisers"
  on public.organisers for select
  using (
    verification_status = 'Verified'
    or listing_status = 'published'
  );
