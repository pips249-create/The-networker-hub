-- Decouple business opportunities from group profiles (repair if 042 already ran)
alter table public.business_opportunities
  alter column organiser_id drop not null;

alter table public.business_opportunities
  add column if not exists owner_email text,
  add column if not exists supabase_user_id uuid;

create index if not exists business_opportunities_owner_email_idx
  on public.business_opportunities (lower(owner_email));

create index if not exists business_opportunities_owner_user_idx
  on public.business_opportunities (supabase_user_id);
