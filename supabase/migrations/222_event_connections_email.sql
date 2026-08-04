-- Event connections email: organiser sends co-attendee name + email list after an event.

alter table public.events
  add column if not exists connections_email_sent_at timestamptz;

alter table public.events
  add column if not exists connections_email_sent_count integer;

comment on column public.events.connections_email_sent_at is
  'When the organiser last emailed the attendee connections list for this event.';

comment on column public.events.connections_email_sent_count is
  'How many recipients received the last connections-list send.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'event_connections_list',
  'Event connections list (attendee)',
  'Organiser-triggered email after an event — list of confirmed co-attendees with name, company, job title and email.',
  'Who attended — {{event_name}}',
  '<p>stub — see email-templates/event-connections-list.html</p>',
  array[
    'user_name', 'event_name', 'event_date', 'event_date_clause', 'organiser_name',
    'attendee_count', 'connections_list_html', 'organiser_note_html',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'unsubscribe_url',
    'sponsor_row', 'mini_sponsors_row'
  ],
  'events'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
