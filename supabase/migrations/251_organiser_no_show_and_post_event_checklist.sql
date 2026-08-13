-- Organisers can mark a booking as a no-show so that person does not get a
-- review request and cannot leave a review for that event. A post-event
-- checklist email prompts them to do this before review emails go out.

alter table public.registrations
  add column if not exists no_show_at timestamptz,
  add column if not exists no_show_marked_by uuid references auth.users(id) on delete set null;

create index if not exists registrations_no_show_event_idx
  on public.registrations (event_id)
  where no_show_at is not null;

comment on column public.registrations.no_show_at is
  'When the organiser marked this booking as did not attend. Skips review emails and blocks a review for this event.';

comment on column public.registrations.no_show_marked_by is
  'Auth user who marked the no-show.';

alter table public.events
  add column if not exists post_event_organiser_checklist_sent_at timestamptz;

comment on column public.events.post_event_organiser_checklist_sent_at is
  'When the post-event organiser checklist email was sent (mark no-shows, send round-up).';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'organiser_post_event_checklist',
    'Post-event checklist (organiser)',
    'Sent shortly after an event ends: mark no-shows before review emails go out, then send the attendee round-up.',
    'After {{event_name}} — two quick steps',
    '<p>stub — see email-templates/organiser-post-event-checklist.html</p>',
    array[
      'organiser_name',
      'event_name',
      'event_date',
      'attendee_count',
      'attendees_url',
      'roundup_url',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'organisers'
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category;
