-- Sponsor Hub CTA was /sponsor (no page) — use mailto enquire link.

update public.cms_blocks
set
  cta_url = 'mailto:sales@the-networker.co.uk?subject=Sponsor%20Hub%20enquiry',
  updated_at = now()
where slot = 'sponsor_hub';
