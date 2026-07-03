-- 1-hour online join reminder for attendees

alter table public.registrations
  add column if not exists online_join_reminder_sent_at timestamptz;

comment on column public.registrations.online_join_reminder_sent_at is
  'When the 1-hour online join-link reminder was sent to the attendee.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'online_join_reminder',
    'Online join reminder (1 hour)',
    'Sent about 1 hour before an online event starts, with the join link.',
    'Join online in 1 hour — {{event_name}}',
    '<p>stub</p>',
    array[
      'user_name',
      'event_name',
      'event_date',
      'event_time',
      'event_url',
      'hub_account_url',
      'meeting_link_section',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'sponsor_row',
      'mini_sponsors_row'
    ],
    'attendees'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
