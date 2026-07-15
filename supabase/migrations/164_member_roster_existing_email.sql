-- Member roster invite for existing Hub accounts (second+ group membership).

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
  'member_roster_existing',
  'Member roster welcome (existing account)',
  'Sent when an organiser adds someone who already has a Hub account to their member roster.',
  '{{organiser_name}} added you to their member roster',
  '<p>stub — see email-templates/member-roster-existing.html</p>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'cta_url', 'cta_label',
    'hub_groups_url', 'hub_account_url', 'upcoming_event_section', 'event_name', 'event_date',
    'event_time', 'event_location', 'event_url', 'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'contact_url', 'sponsor_row'
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

update public.email_templates
set placeholders = array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'register_url',
    'hub_account_url', 'upcoming_event_section', 'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'contact_url', 'sponsor_row'
  ],
  updated_at = now()
where slug = 'member_roster_invite';
