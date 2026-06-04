-- Safe re-run of 002 (use if policies "already exist")
-- Paste into Supabase SQL Editor → Run

create table if not exists public.hub_accounts (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz default now(),
  role          text not null default 'client' check (role in ('admin', 'client')),
  hub_view      text not null default 'attendee' check (hub_view in ('attendee', 'organiser')),
  display_name  text
);

alter table public.hub_accounts enable row level security;

drop policy if exists "Users read own hub account" on public.hub_accounts;
drop policy if exists "Users update own hub account" on public.hub_accounts;

create policy "Users read own hub account"
  on public.hub_accounts for select
  using (user_id = auth.uid());

create policy "Users update own hub account"
  on public.hub_accounts for update
  using (user_id = auth.uid());

alter table public.organisers
  add column if not exists listing_status text default 'draft'
    check (listing_status in ('draft', 'published', 'unpublished'));

drop policy if exists "Users can insert own attendee profile" on public.attendees;
drop policy if exists "Users can insert own organiser profile" on public.organisers;
drop policy if exists "Public can view verified organisers" on public.organisers;
drop policy if exists "Public can view listed organisers" on public.organisers;

create policy "Users can insert own attendee profile"
  on public.attendees for insert
  with check (supabase_user_id = auth.uid());

create policy "Users can insert own organiser profile"
  on public.organisers for insert
  with check (supabase_user_id = auth.uid());

create policy "Public can view listed organisers"
  on public.organisers for select
  using (
    verification_status = 'Verified'
    or listing_status = 'published'
  );
