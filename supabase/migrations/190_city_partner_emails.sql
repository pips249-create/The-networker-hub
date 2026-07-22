-- City Partner transactional emails + opening-soon waitlist tracking.

alter table public.city_partner_waitlist
  add column if not exists opening_soon_notified_at timestamptz;

comment on column public.city_partner_waitlist.opening_soon_notified_at is
  'Set when a heads-up email was sent before the current sponsor subscription ends.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'city_partner_payment_welcome',
    'City Partner payment welcome (sponsor)',
    'Sent after City Partner Stripe checkout completes — logo and link instructions.',
    'City Partner confirmed — send your logo & link',
    '<p>stub</p>',
    array['contact_name', 'city_names', 'advertising_url', 'creative_email', 'monthly_note', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'advertising'
  ),
  (
    'city_partner_opening_soon',
    'City Partner opening soon (waitlist)',
    'Sent when a sponsored city gets a subscription end date — heads-up before checkout opens.',
    '{{city_name}} City Partner — opens {{available_from}}',
    '<p>stub</p>',
    array['contact_name', 'city_name', 'available_from', 'advertising_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'advertising'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category;

update public.email_templates
set
  subject = '{{city_name}} City Partner — slot now available',
  placeholders = array['contact_name', 'city_name', 'advertising_url', 'available_from', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
  updated_at = now()
where slug = 'city_partner_slot_open';
