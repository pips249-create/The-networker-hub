-- Sidebar ad slot for individual business opportunity detail pages.

insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'opportunity_page_sidebar_ad',
  '',
  '',
  'Enquire now',
  'https://',
  false
)
on conflict (slot) do nothing;
