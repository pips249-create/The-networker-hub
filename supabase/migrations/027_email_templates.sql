-- Transactional email templates (Command Centre editor + Resend sender)

create table if not exists public.email_templates (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  slug         text not null unique,
  name         text not null,
  description  text,
  subject      text not null,
  body_html    text not null default '',
  placeholders text[] not null default '{}'
);

create index if not exists idx_email_templates_slug on public.email_templates (slug);

grant select, insert, update, delete on public.email_templates to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values
  (
    'booking_confirmation',
    'Booking confirmation',
    'Sent when an attendee completes a paid or free ticket purchase.',
    'Your ticket for {{event_name}}',
    '<p>Hi {{user_name}},</p><p>Thanks for booking <strong>{{event_name}}</strong>.</p><p><strong>When:</strong> {{event_date}} at {{event_time}}<br><strong>Where:</strong> {{event_location}}</p><p><strong>Ticket:</strong> {{ticket_name}}<br><strong>Amount paid:</strong> {{amount_paid}}</p><p>Hosted by {{organiser_name}}.</p><p><a href="{{event_url}}">View event details</a></p><p>See you there,<br>The Networker Hub</p>',
    array['user_name', 'user_email', 'event_name', 'event_date', 'event_time', 'event_location', 'event_url', 'ticket_name', 'amount_paid', 'organiser_name', 'meeting_link', 'site_url']
  ),
  (
    'booking_reminder',
    'Event reminder',
    'Reminder email sent before an upcoming event.',
    'Reminder: {{event_name}} is coming up',
    '<p>Hi {{user_name}},</p><p>This is a friendly reminder that <strong>{{event_name}}</strong> is on {{event_date}} at {{event_time}}.</p><p><strong>Location:</strong> {{event_location}}</p><p><a href="{{event_url}}">Event details</a></p><p>— The Networker Hub</p>',
    array['user_name', 'user_email', 'event_name', 'event_date', 'event_time', 'event_location', 'event_url', 'organiser_name', 'meeting_link', 'site_url']
  ),
  (
    'organiser_new_registration',
    'New registration (organiser)',
    'Notifies the organiser when someone books a ticket.',
    'New booking: {{user_name}} — {{event_name}}',
    '<p>Hi {{organiser_name}},</p><p><strong>{{user_name}}</strong> ({{user_email}}) just booked <strong>{{ticket_name}}</strong> for {{event_name}}.</p><p>Amount: {{amount_paid}}</p><p><a href="{{dashboard_url}}">Open organiser dashboard</a></p>',
    array['organiser_name', 'user_name', 'user_email', 'event_name', 'ticket_name', 'amount_paid', 'dashboard_url', 'site_url']
  )
on conflict (slug) do nothing;
