-- Two-step organiser outreach: Email 1 rebrand (trust) + Email 2 confirm page (action).

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
  'organiser_rebrand_announcement',
  'Organiser rebrand announcement (Email 1)',
  'Introduce the move from the-networker.co.uk to The Networker Hub. No account action — send 3–5 days before the confirm-page email.',
  'We''re upgrading The Networker — your group listing is ready',
  '<p>stub — see email-templates/organiser-rebrand-announcement.html</p>',
  array[
    'organiser_name',
    'site_url',
    'legacy_site_url',
    'for_organisers_url',
    'company_name',
    'company_number',
    'legacy_email',
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

-- Soften Email 2 subject (follow-up, no emoji).
update public.email_templates
set
  name = 'Organiser confirm page (Email 2)',
  description = 'Follow-up after rebrand announcement — create password, confirm organiser page, add events.',
  subject = 'Confirm your organiser page — The Networker Hub',
  placeholders = coalesce(placeholders, '{}'::text[]) || array(
    select missing.key
    from unnest(array['legacy_site_url', 'company_name', 'company_number']::text[]) as missing(key)
    where not (key = any(coalesce(placeholders, '{}'::text[])))
  ),
  updated_at = now()
where slug = 'organiser_launch_invite';
