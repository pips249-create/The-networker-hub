-- Membership lifecycle emails + pay-invite queue kind.

alter table public.organiser_roster_email_queue
  drop constraint if exists organiser_roster_email_queue_kind_check;

alter table public.organiser_roster_email_queue
  add constraint organiser_roster_email_queue_kind_check
  check (kind in ('invite', 'new_event', 'booking_reminder', 'pay_invite'));

alter table public.organiser_roster_email_queue
  drop constraint if exists organiser_roster_email_queue_event_required;

alter table public.organiser_roster_email_queue
  add constraint organiser_roster_email_queue_event_required check (
    kind in ('invite', 'pay_invite') or event_id is not null
  );

insert into public.email_templates (
  slug, name, description, subject, body_html, placeholders, category
)
values
(
  'member_roster_payment_failed',
  'Membership payment failed (member)',
  'Sent when a Hub-billed membership renewal payment fails.',
  'Update your card for {{organiser_name}} membership',
  '<p>stub — see email-templates/member-roster-payment-failed.html</p>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'expires_note',
    'cta_url', 'cta_label', 'hub_account_url', 'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'contact_url', 'sponsor_row'
  ],
  'attendees'
),
(
  'member_roster_payment_failed_organiser',
  'Membership payment failed (organiser)',
  'Notifies the organiser when a member’s Hub membership payment fails.',
  'Membership payment failed — {{member_name}}',
  '<p>stub — see email-templates/member-roster-payment-failed-organiser.html</p>',
  array[
    'user_name', 'user_email', 'member_name', 'member_email', 'organiser_name', 'organiser_url',
    'expires_note', 'cta_url', 'cta_label', 'hub_account_url', 'site_url', 'logo_url',
    'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'
  ],
  'organisers'
),
(
  'member_roster_renewal_receipt',
  'Membership renewal receipt',
  'Receipt after a successful Hub membership payment or renewal.',
  'Membership receipt — {{organiser_name}}',
  '<p>stub — see email-templates/member-roster-renewal-receipt.html</p>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'amount_paid',
    'billing_interval', 'next_billing_date', 'receipt_intro', 'period_note',
    'cta_url', 'cta_label', 'hub_account_url', 'site_url', 'logo_url', 'logo_footer_url',
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
