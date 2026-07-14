-- Route each Sponsor Hub placement to its matching email family.

alter table public.cms_blocks
  add column if not exists include_in_emails boolean not null default true;

comment on column public.cms_blocks.include_in_emails is
  'When true, the sponsor creative may be included in emails for its matching area.';

insert into public.cms_blocks (
  slot,
  title,
  subtitle,
  body,
  cta_label,
  cta_url,
  logo_url,
  image_url,
  company_name,
  active,
  include_in_emails
)
values
  (
    'event_email_mini_sponsors',
    'Email mini sponsors',
    'Email mini sponsors',
    '{"ads":[]}',
    'Visit website',
    'https://',
    null,
    null,
    null,
    false,
    true
  ),
  (
    'organiser_email_mini_sponsors',
    'Email mini sponsors',
    'Email mini sponsors',
    '{"ads":[]}',
    'Visit website',
    'https://',
    null,
    null,
    null,
    false,
    true
  ),
  (
    'opportunity_email_mini_sponsors',
    'Email mini sponsors',
    'Email mini sponsors',
    '{"ads":[]}',
    'Visit website',
    'https://',
    null,
    null,
    null,
    false,
    true
  )
on conflict (slot) do nothing;
