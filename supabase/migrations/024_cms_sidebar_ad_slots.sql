-- Seed sidebar ad slots for event and organiser detail pages.
insert into public.cms_blocks (slot, title, body, cta_label, cta_url, active)
values
  (
    'event_page_sidebar_ad',
    'Reach engaged ticket buyers',
    '<ul class="sponsor-list"><li>Compact placement beside checkout</li></ul>',
    'Enquire now',
    'mailto:sales@the-networker.co.uk?subject=Event%20page%20advert',
    false
  ),
  (
    'organiser_page_sidebar_ad',
    'Connect with networkers',
    '<ul class="sponsor-list"><li>Sidebar placement on organiser profiles</li></ul>',
    'Enquire now',
    'mailto:sales@the-networker.co.uk?subject=Organiser%20page%20advert',
    false
  )
on conflict (slot) do nothing;
