-- Events directory sponsored carousel — up to 12 logo cards with a button.
insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values (
  'events_browse_carousel_ads',
  'Events directory advert carousel',
  '{"ads":[{"id":"events_browse_carousel_1","slot_index":0,"active":false},{"id":"events_browse_carousel_2","slot_index":1,"active":false},{"id":"events_browse_carousel_3","slot_index":2,"active":false},{"id":"events_browse_carousel_4","slot_index":3,"active":false},{"id":"events_browse_carousel_5","slot_index":4,"active":false},{"id":"events_browse_carousel_6","slot_index":5,"active":false},{"id":"events_browse_carousel_7","slot_index":6,"active":false},{"id":"events_browse_carousel_8","slot_index":7,"active":false},{"id":"events_browse_carousel_9","slot_index":8,"active":false},{"id":"events_browse_carousel_10","slot_index":9,"active":false},{"id":"events_browse_carousel_11","slot_index":10,"active":false},{"id":"events_browse_carousel_12","slot_index":11,"active":false}]}',
  'Find out more',
  'https://www.thenetworkeruk.com/advertising#ad-panel-events',
  true
)
on conflict (slot) do nothing;
