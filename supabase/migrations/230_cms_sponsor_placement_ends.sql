-- Clarify that sponsor_available_from is the placement end date for all CMS sponsor slots
-- (Headline heroes, county partners, sidebars — not only City Partner).

comment on column public.cms_blocks.sponsor_available_from is
  'When this sponsorship placement ends / the slot re-opens. Used for City Partner holds and manual Headline (and other) sponsor terms. After this timestamp the placement is treated as expired.';
