-- Point sponsorship / advertising enquiry mailto links at Rosie.

update public.cms_blocks
set
  cta_url = replace(cta_url, 'sales@the-networker.co.uk', 'rosie@thenetworkerhub.com'),
  updated_at = now()
where cta_url like '%sales@the-networker.co.uk%';
