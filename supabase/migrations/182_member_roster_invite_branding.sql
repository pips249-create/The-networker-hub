-- Member list invite emails: organiser logo/branding placeholders; keep file-backed HTML.

update public.email_templates
set
  placeholders = array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'organiser_logo_url',
    'organiser_invite_intro_section', 'register_url', 'hub_account_url', 'upcoming_event_section',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url', 'sponsor_row'
  ],
  body_html = '<p>stub — see email-templates/member-roster-invite.html</p>',
  updated_at = now()
where slug = 'member_roster_invite';

update public.email_templates
set
  placeholders = array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'organiser_logo_url',
    'organiser_invite_intro_section', 'cta_url', 'cta_label', 'hub_groups_url', 'hub_account_url',
    'upcoming_event_section', 'event_name', 'event_date', 'event_time', 'event_location', 'event_url',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url', 'sponsor_row'
  ],
  body_html = '<p>stub — see email-templates/member-roster-existing.html</p>',
  updated_at = now()
where slug = 'member_roster_existing';
