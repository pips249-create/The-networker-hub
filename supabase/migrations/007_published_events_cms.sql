-- Public browse views + CMS blocks for events page
-- DROP required when the view already exists with a different column list (42P16).

drop view if exists public.published_events cascade;

create view public.published_events as
select e.*
from public.events e
left join public.organisers o on o.id = e.organiser_id
where e.approval_status = 'Approved'
  and (
    e.organiser_id is null
    or o.listing_status is null
    or o.listing_status not in ('draft', 'unpublished')
  );

create table if not exists public.cms_blocks (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  slot        text not null unique,
  title       text,
  body        text,
  cta_label   text,
  cta_url     text,
  active      boolean not null default true
);

create or replace view public.active_cms_blocks as
select *
from public.cms_blocks
where active = true;

grant select on public.published_events to anon, authenticated, service_role;
grant select on public.active_cms_blocks to anon, authenticated, service_role;
grant select on public.cms_blocks to anon, authenticated, service_role;

insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'sponsor_hub',
  'Sponsor Hub',
  '<h3><em>Get sponsored:</em> Reach 10k founders monthly from £2,000/month</h3><ul class="sponsor-list"><li>Premium placement beside Featured events</li><li>Short line of copy</li><li>Direct link to your landing page</li></ul>',
  'Enquire now',
  'mailto:sales@the-networker.co.uk?subject=Sponsor%20Hub%20enquiry',
  true
)
on conflict (slot) do nothing;
