-- Member offers shown on the attendee dashboard (My services).
-- Writes go through the API with the service role. Members only see published rows.

create table if not exists public.member_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null default '',
  category text not null default '',
  highlight text not null default '',
  summary text not null default '',
  href text not null default '',
  image_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  seed_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_offers_title_len check (char_length(title) between 1 and 120),
  constraint member_offers_sort_order_check check (sort_order between 0 and 9999)
);

create unique index if not exists member_offers_seed_key_uidx
  on public.member_offers (seed_key)
  where seed_key is not null;

create index if not exists member_offers_published_sort_idx
  on public.member_offers (published, sort_order, title);

comment on table public.member_offers is
  'Curated member offers on the attendee dashboard. Platform admins publish them.';

alter table public.member_offers enable row level security;

revoke all on table public.member_offers from anon, authenticated;
grant select, insert, update, delete on table public.member_offers to service_role;

-- Starter drafts so admins can publish the first offers after adding a link.
insert into public.member_offers (
  title, provider, category, highlight, summary, published, sort_order, seed_key
)
values
  (
    'Swft Business Cards',
    'Swft',
    'Business cards',
    '3 months free',
    'Member offer on Swft business cards.',
    false,
    10,
    'swft-business-cards'
  ),
  (
    'Deciding the right franchise for you',
    'Franchise guidance',
    'Franchise',
    'Help choosing',
    'Help working out which franchise is the right fit for you.',
    false,
    20,
    'franchise-fit'
  )
on conflict (seed_key) where seed_key is not null do nothing;
