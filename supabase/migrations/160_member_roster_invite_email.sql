-- Member roster invite email + invite_sent_at tracking.

alter table public.organiser_member_roster
  add column if not exists invite_sent_at timestamptz;

comment on column public.organiser_member_roster.invite_sent_at is
  'When the member roster invite email was last sent to this address.';

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
  'member_roster_invite',
  'Member roster invite (attendee)',
  'Sent when an organiser adds someone to their member roster.',
  '{{organiser_name}} added you to their member roster on The Networker Hub',
  '<p>stub — see email-templates/member-roster-invite.html</p>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'register_url',
    'hub_account_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url',
    'terms_url', 'contact_url', 'sponsor_row'
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
