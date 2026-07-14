-- Complete sponsor coverage across attendee, organiser, opportunity, and general Hub emails.

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
  'organiser_ticket_sales_nudge',
  'Ticket sales interest (organiser)',
  'Sent when a visitor asks for tickets while sales are disabled.',
  'Someone wants tickets for {{event_name}}',
  '<p>stub</p>',
  array[
    'organiser_name',
    'event_name',
    'nudger_name',
    'tickets_url',
    'dashboard_url',
    'visitor_message_row',
    'sponsor_row',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'contact_url'
  ],
  'organisers'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();

-- Main directory sponsor coverage.
update public.email_templates
set
  placeholders = coalesce(placeholders, '{}'::text[]) || array(
    select missing.key
    from unnest(array['sponsor_row']::text[]) as missing(key)
    where not (key = any(coalesce(placeholders, '{}'::text[])))
  ),
  updated_at = now()
where slug in (
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'saved_event_tickets_open',
  'saved_organiser_new_listing',
  'application_received',
  'application_approved',
  'application_denied',
  'meeting_link_added',
  'event_details_updated',
  'post_event_review_request',
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
  'alumni_fast_pass_invite',
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_booking_cancelled',
  'organiser_ticket_sales_nudge',
  'organiser_featured_expiry_reminder',
  'organiser_claim_invite',
  'organiser_team_invite',
  'organiser_email_verify',
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
  'stripe_connect_nudge',
  'payout_requested',
  'payout_approved',
  'payout_paid',
  'event_almost_full',
  'opportunity_listing_live',
  'opportunity_listing_expiry_reminder',
  'opportunity_premium_expiry_reminder',
  'opportunity_premium_live',
  'opportunity_enquiry_received',
  'opportunity_enquiry_sent',
  'opportunity_listing_expired',
  'opportunity_premium_expired',
  'opportunity_listing_rejected',
  'saved_opportunity_closing_soon',
  'opportunity_saved_search_match'
);

-- Selected domain emails show their configured three-logo mini sponsor row.
update public.email_templates
set
  placeholders = coalesce(placeholders, '{}'::text[]) || array(
    select missing.key
    from unnest(array['mini_sponsors_row']::text[]) as missing(key)
    where not (key = any(coalesce(placeholders, '{}'::text[])))
  ),
  updated_at = now()
where slug in (
  'account_welcome',
  'password_reset',
  'booking_confirmation',
  'booking_reminder',
  'online_join_reminder',
  'saved_event_tickets_open',
  'saved_organiser_new_listing',
  'application_received',
  'application_approved',
  'application_denied',
  'meeting_link_added',
  'event_details_updated',
  'post_event_review_request',
  'guest_visit_followup',
  'category_exclusivity_payment_reminder',
  'attendee_reengagement',
  'attendee_signup_events_nudge',
  'attendee_signup_events_nudge_followup',
  'attendee_hubert_event_concierge',
  'booking_cancelled',
  'event_cancelled',
  'refund_processed',
  'alumni_fast_pass_invite',
  'organiser_new_registration',
  'organiser_new_application',
  'organiser_featured_expiry_reminder',
  'organiser_ranking_badge',
  'organiser_low_upcoming_events',
  'opportunity_listing_live',
  'opportunity_listing_expiry_reminder',
  'opportunity_premium_expiry_reminder',
  'opportunity_premium_live',
  'saved_opportunity_closing_soon',
  'opportunity_saved_search_match'
);

-- These two database-owned templates have non-standard footer colours, so place
-- the Hub partner row explicitly rather than relying on runtime footer detection.
update public.email_templates
set
  body_html = replace(
    body_html,
    '<tr>
          <td class="mobile-pad" style="background:#452d5c;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;">',
    '{{mini_sponsors_row}}
        <tr>
          <td class="mobile-pad" style="background:#452d5c;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;">'
  ),
  updated_at = now()
where slug = 'password_reset'
  and body_html not like '%{{mini_sponsors_row}}%';

update public.email_templates
set
  body_html = replace(
    body_html,
    '<tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 48px 32px;text-align:center;border-radius:0 0 20px 20px;">',
    '{{mini_sponsors_row}}

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 48px 32px;text-align:center;border-radius:0 0 20px 20px;">'
  ),
  updated_at = now()
where slug = 'account_welcome'
  and body_html not like '%{{mini_sponsors_row}}%';
