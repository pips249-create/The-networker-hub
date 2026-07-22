-- Listing report uphold: audit fields, conduct-warning link, notification emails.

alter table public.listing_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

comment on column public.listing_reports.reviewed_at is
  'When Command Centre upheld the report and unpublish action was taken.';
comment on column public.listing_reports.reviewed_by is
  'Admin user who upheld the listing report.';

create index if not exists idx_listing_reports_reviewed_at
  on public.listing_reports(reviewed_at desc)
  where status = 'reviewed';

alter table public.organiser_moderation_actions
  add column if not exists listing_report_id uuid references public.listing_reports(id) on delete set null;

create unique index if not exists organiser_moderation_actions_listing_report_uidx
  on public.organiser_moderation_actions(listing_report_id)
  where listing_report_id is not null;

comment on column public.organiser_moderation_actions.listing_report_id is
  'When a conduct warning was recorded from an upheld listing report.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values
  (
    'organiser_listing_unpublished_by_hub',
    'Organiser page unpublished by The Hub',
    'Sent when Command Centre unpublishes a group profile after upholding a listing report.',
    'Your organiser page {{organiser_name}} has been unpublished on The Networker Hub',
    '<p>Hi {{organiser_name}}, your organiser page was unpublished on The Networker Hub.</p>',
    array[
      'organiser_name',
      'removal_reason',
      'removal_details',
      'removal_details_row',
      'dashboard_url',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'refunds_url',
      'hub_rules_url',
      'sponsor_row'
    ]
  ),
  (
    'listing_report_upheld_reporter',
    'Listing report upheld — thank you',
    'Sent to the reporter when Command Centre upholds their listing report and takes action.',
    'We reviewed your report — thank you',
    '<p>Hi {{reporter_name}}, thanks for reporting a listing on The Networker Hub. We reviewed it and took action.</p>',
    array[
      'reporter_name',
      'listing_title',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'sponsor_row'
    ]
  )
on conflict (slug) do nothing;
