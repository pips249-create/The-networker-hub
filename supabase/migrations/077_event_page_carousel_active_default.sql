-- Ensure event page carousel is enabled once slots are configured.
update public.cms_blocks
set active = true,
    updated_at = now()
where slot = 'event_page_carousel_ads'
  and active = false;
