-- Business opportunity emails + premium expiry tracking

alter table public.business_opportunities
  add column if not exists featured_until timestamptz,
  add column if not exists featured_expiry_reminder_sent_at timestamptz,
  add column if not exists listing_expiry_reminder_sent_at timestamptz;

comment on column public.business_opportunities.featured_until is
  'When paid premium spotlight placement ends; extended on premium subscription activation.';

comment on column public.business_opportunities.featured_expiry_reminder_sent_at is
  'Set when the premium placement expiry reminder email was sent.';

comment on column public.business_opportunities.listing_expiry_reminder_sent_at is
  'Set when the standard listing expiry reminder email was sent.';

create index if not exists business_opportunities_featured_until_idx
  on public.business_opportunities (featured_until)
  where featured = true and featured_until is not null;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_listing_live',
    'Opportunity listing live (lister)',
    'Sent when a business opportunity listing payment activates and the listing goes live.',
    'Your opportunity is live — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'opportunity_url', 'dashboard_url', 'expiry_date', 'expiry_note', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_listing_expiry_reminder',
    'Opportunity listing expiry reminder (lister)',
    'Sent 7 days before a prepaid business opportunity listing expires.',
    'Your opportunity listing expires on {{expiry_date}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'expiry_date', 'renew_url', 'opportunity_url', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_premium_expiry_reminder',
    'Premium opportunity expiry reminder (lister)',
    'Sent 2 days before premium spotlight placement expires.',
    'Your premium placement expires on {{expiry_date}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'expiry_date', 'renew_url', 'opportunity_url', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_premium_live',
    'Premium opportunity live (lister)',
    'Sent when premium spotlight placement is activated after checkout.',
    'Premium placement active — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'opportunity_url', 'dashboard_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_enquiry_received',
    'Opportunity enquiry received (lister)',
    'Sent to the lister when someone submits an enquiry on their opportunity.',
    'New enquiry: {{enquirer_name}} — {{opportunity_title}}',
    '<p>stub</p>',
    array['owner_name', 'opportunity_title', 'enquirer_name', 'enquirer_email', 'enquiry_message', 'dashboard_url', 'reply_mailto_url', 'opportunity_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  ),
  (
    'opportunity_enquiry_sent',
    'Opportunity enquiry sent (enquirer)',
    'Confirmation sent to the person who submitted an opportunity enquiry.',
    'Your enquiry was sent — {{opportunity_title}}',
    '<p>stub</p>',
    array['enquirer_name', 'opportunity_title', 'opportunity_url', 'message_preview', 'lister_name', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'opportunities'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();

update public.email_templates
set
  placeholders = array['organiser_name', 'event_name', 'expiry_date', 'extend_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
  updated_at = now()
where slug = 'organiser_featured_expiry_reminder';

update public.email_templates
set
  placeholders = array['organiser_name', 'claim_url', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
  updated_at = now()
where slug = 'organiser_claim_invite';
