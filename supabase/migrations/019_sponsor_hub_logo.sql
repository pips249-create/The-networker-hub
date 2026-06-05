-- Sponsor Hub: company logo + name for ad-style placement on Events browse.

alter table public.cms_blocks
  add column if not exists logo_url text,
  add column if not exists company_name text;

-- Move legacy headline from body <h3> into title (tagline) when title is still the slot label.
update public.cms_blocks
set title = trim(
  regexp_replace(
    coalesce(substring(body from '<h3[^>]*>(.*?)</h3>'), title),
    '<[^>]+>',
    '',
    'g'
  )
)
where slot = 'sponsor_hub'
  and coalesce(title, '') in ('Sponsor Hub', '')
  and coalesce(body, '') ~ '<h3';
