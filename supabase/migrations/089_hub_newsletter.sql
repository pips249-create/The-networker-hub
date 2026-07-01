-- Hub newsletter editions + email template

create table if not exists public.newsletter_editions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  edition_label text not null default '',
  subject text not null default '',
  preheader text not null default '',

  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),

  scheduled_at timestamptz,
  sent_at timestamptz,

  article_title text not null default '',
  article_body text not null default '',
  hub_news text not null default '',

  member_spotlight_name text not null default '',
  member_spotlight_title text not null default '',
  member_spotlight_body text not null default '',
  member_spotlight_image_url text not null default '',

  auto_featured boolean not null default true,
  use_events_sponsor boolean not null default true,
  featured_event_ids uuid[] not null default '{}',
  featured_organiser_ids uuid[] not null default '{}',
  featured_opportunity_ids uuid[] not null default '{}',

  recipient_count integer not null default 0,
  send_cursor integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,

  created_by text not null default ''
);

create index if not exists newsletter_editions_status_scheduled_idx
  on public.newsletter_editions (status, scheduled_at)
  where status in ('scheduled', 'sending');

comment on table public.newsletter_editions is
  'Composable Hub newsletter editions — schedule sends to opted-in members.';

grant select, insert, update, delete on public.newsletter_editions to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'hub_newsletter',
  'Hub newsletter',
  'Monthly magazine-style newsletter with sponsor, editorial, featured listings and member spotlight.',
  '{{edition_label}} — {{newsletter_subject}}',
  '<p>stub</p>',
  array[
    'user_name', 'edition_label', 'newsletter_subject', 'preheader',
    'sponsor_row', 'intro_html', 'article_section_html', 'hub_news_section_html',
    'featured_events_section_html', 'featured_organisers_section_html',
    'featured_opportunities_section_html', 'member_spotlight_section_html',
    'browse_events_url', 'opportunities_url', 'unsubscribe_url',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'
  ],
  'marketing'
)
on conflict (slug) do nothing;
