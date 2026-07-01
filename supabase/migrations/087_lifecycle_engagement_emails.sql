-- Lifecycle + engagement email templates and tracking columns

alter table public.attendees
  add column if not exists reengagement_email_sent_at timestamptz;

comment on column public.attendees.reengagement_email_sent_at is
  'When the inactive-attendee re-engagement email was last sent.';

alter table public.organisers
  add column if not exists low_upcoming_events_nudge_sent_at timestamptz,
  add column if not exists stripe_connect_nudge_sent_at timestamptz;

comment on column public.organisers.low_upcoming_events_nudge_sent_at is
  'When the low upcoming-events calendar nudge was last sent.';

comment on column public.organisers.stripe_connect_nudge_sent_at is
  'When the Stripe Connect setup reminder was last sent.';

alter table public.business_opportunities
  add column if not exists listing_expired_email_sent_at timestamptz,
  add column if not exists premium_expired_email_sent_at timestamptz;

comment on column public.business_opportunities.listing_expired_email_sent_at is
  'When the listing-expired notification was sent to the lister.';

comment on column public.business_opportunities.premium_expired_email_sent_at is
  'When the premium-placement-expired notification was sent.';

alter table public.registrations
  add column if not exists post_event_review_sent_at timestamptz,
  add column if not exists osop_payment_reminder_sent_at timestamptz,
  add column if not exists application_decided_at timestamptz;

comment on column public.registrations.post_event_review_sent_at is
  'When the post-event review request email was sent.';

comment on column public.registrations.osop_payment_reminder_sent_at is
  'When the OSOP payment reminder was sent after approval.';

comment on column public.registrations.application_decided_at is
  'When the organiser approved or denied an application.';

alter table public.events
  add column if not exists almost_full_email_sent_at timestamptz;

comment on column public.events.almost_full_email_sent_at is
  'When the organiser almost-full capacity alert was sent.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_listing_expired',
    'Opportunity listing expired (lister)',
    'Sent when a prepaid business opportunity listing expires and goes offline.',
    'Your listing has expired — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'renew_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_premium_expired',
    'Premium opportunity expired (lister)',
    'Sent when paid premium spotlight placement ends.',
    'Premium placement ended — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'renew_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_listing_rejected',
    'Opportunity listing rejected (lister)',
    'Sent when an admin rejects a business opportunity listing.',
    'Your listing was not approved — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'rejection_note', 'edit_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'payout_requested',
    'Payout requested (organiser)',
    'Sent when an organiser requests a payout for an event.',
    'Payout request received — {{event_name}}',
    '<p>stub</p>',
    array['organiser_name', 'event_name', 'amount_net', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  ),
  (
    'payout_approved',
    'Payout approved (organiser)',
    'Sent when an admin approves a payout request.',
    'Payout approved — {{event_name}}',
    '<p>stub</p>',
    array['organiser_name', 'event_name', 'amount_net', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  ),
  (
    'payout_paid',
    'Payout paid (organiser)',
    'Sent when an admin marks a payout as paid.',
    'Payout sent — {{event_name}}',
    '<p>stub</p>',
    array['organiser_name', 'event_name', 'amount_net', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  ),
  (
    'stripe_connect_nudge',
    'Stripe Connect setup (organiser)',
    'Sent when an organiser has paid tickets on sale but has not connected Stripe.',
    'Add your bank details to receive payouts',
    '<p>stub</p>',
    array['organiser_name', 'connect_url', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  ),
  (
    'meeting_link_added',
    'Online join link added (attendee)',
    'Sent when an organiser adds an online join link for the first time.',
    'Join link for {{event_name}}',
    '<p>stub</p>',
    array['user_name', 'event_name', 'meeting_link_section', 'event_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'events'
  ),
  (
    'post_event_review_request',
    'Post-event review request (attendee)',
    'Sent 24–48 hours after an event ends to attendees who have not left a review.',
    'How was {{event_name}}?',
    '<p>stub</p>',
    array['user_name', 'event_name', 'review_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'events'
  ),
  (
    'osop_payment_reminder',
    'OSOP payment reminder (attendee)',
    'Sent when an application was approved but payment is still pending.',
    'Complete your booking — {{event_name}}',
    '<p>stub</p>',
    array['user_name', 'event_name', 'hub_payment_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'events'
  ),
  (
    'event_almost_full',
    'Event almost full (organiser)',
    'Sent when an event has three or fewer tickets remaining.',
    'Almost full — {{event_name}}',
    '<p>stub</p>',
    array['organiser_name', 'event_name', 'tickets_remaining', 'tickets_sold', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  ),
  (
    'attendee_reengagement',
    'Inactive attendee re-engagement',
    'Sent when an attendee has not booked an event for 30 days — popular organisers and upcoming events.',
    'Ready to network again?',
    '<p>stub</p>',
    array['user_name', 'recommendations_html', 'browse_events_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'marketing'
  ),
  (
    'organiser_low_upcoming_events',
    'Low upcoming events (organiser)',
    'Sent when an organiser has three or fewer upcoming published events.',
    'Only {{upcoming_count}} events left on your calendar',
    '<p>stub</p>',
    array['organiser_name', 'upcoming_count', 'create_event_url', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'organiser'
  )
on conflict (slug) do nothing;

update public.email_templates
set body_html = '<p>stub</p>',
    updated_at = now()
where slug = 'saved_organiser_new_listing'
  and body_html not like '%hub-email-layout-v2%';
