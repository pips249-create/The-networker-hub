-- Listing alert emails: series-aware subject and placeholder copy.

update public.email_templates
set
  subject = '{{listing_subject}}',
  placeholders = array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'event_name', 'event_date',
    'event_time', 'event_location', 'event_url', 'event_date_count', 'listing_badge',
    'listing_headline', 'listing_intro', 'listing_subject', 'event_date_prefix',
    'listing_cta_label', 'hub_account_url', 'browse_events_url', 'contact_url', 'privacy_url',
    'terms_url', 'site_url', 'logo_url', 'logo_footer_url', 'sponsor_row', 'mini_sponsors_row'
  ],
  updated_at = now()
where slug = 'saved_organiser_new_listing';

update public.email_templates
set
  subject = '{{listing_subject}}',
  placeholders = array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'event_name', 'event_date',
    'event_time', 'event_location', 'event_url', 'event_date_count', 'listing_badge',
    'listing_headline', 'listing_intro', 'listing_subject', 'event_date_prefix',
    'listing_cta_label', 'cta_url', 'cta_label', 'hub_account_url', 'browse_events_url',
    'contact_url', 'privacy_url', 'terms_url', 'site_url', 'logo_url', 'logo_footer_url',
    'sponsor_row', 'mini_sponsors_row'
  ],
  updated_at = now()
where slug = 'member_roster_new_event';
