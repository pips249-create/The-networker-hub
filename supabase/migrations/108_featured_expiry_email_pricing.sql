-- Featured event expiry reminder — single £55/month extend option (was 1 week / 1 month / 2 months tiers).

update public.email_templates
set
  body_html = replace(
    body_html,
    'Choose 1 week (£20), 1 month (£55), or 2 months (£100) when you extend.',
    'Extend for £55 per month to keep your event in the Premium Spotlight carousel.'
  ),
  updated_at = now()
where slug = 'organiser_featured_expiry_reminder'
  and body_html like '%Choose 1 week (£20)%';
