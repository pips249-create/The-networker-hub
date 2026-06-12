-- Event page sidebar — 5-slot sponsor carousel (managed in Sponsorship command centre)
insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'event_page_carousel_ads',
  'Event page carousel ads',
  '{"ads":[{"id":"event_carousel_1","slot_index":0,"active":false},{"id":"event_carousel_2","slot_index":1,"active":false},{"id":"event_carousel_3","slot_index":2,"active":false},{"id":"event_carousel_4","slot_index":3,"active":false},{"id":"event_carousel_5","slot_index":4,"active":false}]}',
  'Enquire now',
  'mailto:sales@the-networker.co.uk?subject=Event%20page%20carousel%20advert',
  false
)
on conflict (slot) do nothing;
