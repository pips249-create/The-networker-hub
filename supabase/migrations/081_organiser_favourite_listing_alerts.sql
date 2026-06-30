-- Organiser favourite alerts: notify_email + listing alert tracking + event published_at

alter table public.organiser_favourites
  add column if not exists notify_email boolean not null default true;

alter table public.events
  add column if not exists published_at timestamptz;

update public.events
set published_at = created_at
where status = 'published'
  and published_at is null;

create table if not exists public.organiser_favourite_listing_alerts (
  id                     uuid primary key default uuid_generate_v4(),
  created_at             timestamptz not null default now(),
  organiser_favourite_id uuid not null references public.organiser_favourites(id) on delete cascade,
  event_id               uuid not null references public.events(id) on delete cascade,
  unique (organiser_favourite_id, event_id)
);

create index if not exists organiser_favourite_listing_alerts_fav_idx
  on public.organiser_favourite_listing_alerts(organiser_favourite_id);

alter table public.organiser_favourite_listing_alerts enable row level security;

grant select, insert, update, delete on public.organiser_favourite_listing_alerts to service_role;

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'saved_organiser_new_listing',
  'Saved organiser — new listing',
  'Sent when a favourited organiser publishes a new event listing.',
  '{{organiser_name}} has a new listing on The Networker Hub',
  '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New listing</title></head><body style="margin:0;padding:0;background:#faf7f2;font-family:DM Sans,system-ui,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf7f2;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);"><tr><td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;"><a href="{{site_url}}/"><img src="{{logo_url}}" alt="The Networker Hub" width="180" style="height:auto;border:0;"></a></td></tr><tr><td style="padding:32px 48px 8px;"><h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#2d1b5e;">New listing from {{organiser_name}}</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5a4a62;">Hi {{user_name}}, a networking group you saved has listed a new event.</p><p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#2d1b5e;">{{event_name}}</p><p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5a4a62;">{{event_date}}{{event_time}} · {{event_location}}</p><p style="margin:0 0 24px;"><a href="{{event_url}}" style="display:inline-block;background:#9d60a7;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;">View listing</a></p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5a4a62;">You can also browse everything from <a href="{{organiser_url}}" style="color:#7a3d8a;">{{organiser_name}}''s profile</a> or manage your saved items in <a href="{{hub_account_url}}" style="color:#7a3d8a;">My tickets &amp; reviews</a>.</p></td></tr><tr><td style="padding:0 48px 32px;"><p style="margin:0;font-size:12px;line-height:1.6;color:#9d87aa;">You are receiving this because you saved this organiser on The Networker Hub.</p></td></tr></table></td></tr></table></body></html>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'event_name', 'event_date',
    'event_time', 'event_location', 'event_url', 'hub_account_url', 'browse_events_url',
    'contact_url', 'privacy_url', 'terms_url', 'site_url', 'logo_url'
  ],
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
