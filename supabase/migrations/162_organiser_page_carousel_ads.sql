-- Organiser profile pages — separate 3-slot mini sponsor carousel (distinct from event pages).
insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'organiser_page_carousel_ads',
  'Organiser page carousel ads',
  '{"ads":[{"id":"organiser_carousel_1","slot_index":0,"active":false},{"id":"organiser_carousel_2","slot_index":1,"active":false},{"id":"organiser_carousel_3","slot_index":2,"active":false}]}',
  'Enquire now',
  'mailto:rosie@thenetworkerhub.com?subject=Organisers%20Mini%20Sponsors%20enquiry',
  false
)
on conflict (slot) do nothing;
