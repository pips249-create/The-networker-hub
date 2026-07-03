-- Remove Hub newsletter tables, template, and related schema after feature retirement.

drop table if exists public.newsletter_sends;
drop table if exists public.newsletter_link_clicks;
drop table if exists public.newsletter_webhook_events;
drop table if exists public.newsletter_editions;

delete from public.email_templates
where slug = 'hub_newsletter';

delete from public.hub_revenue_deals
where category = 'newsletter';

alter table public.hub_revenue_deals
  drop constraint if exists hub_revenue_deals_category_check;

alter table public.hub_revenue_deals
  add constraint hub_revenue_deals_category_check
  check (category in ('events', 'opportunities', 'ticket_sales', 'browse_organisers', 'awards'));

comment on table public.hub_revenue_deals is
  'Manually logged Hub advertising revenue (sponsorship, awards) for revenue target tracking.';

alter table public.hub_accounts
  drop column if exists email_pref_newsletter;
