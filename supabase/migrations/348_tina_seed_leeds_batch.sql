-- TINA Matchmaker seed batch: Leeds networking contacts (Nov 2026).
-- Idempotent on lower(email). Skips do_not_contact rows. Phones stay in notes only.

do $$
declare
  r record;
  existing_id uuid;
  existing_status text;
  note text;
begin
  for r in
    select * from (
      values
        ('Adam Ogilvie', 'a.ogilvie@mvuf.org.uk', 'Meanwood Valley Urban Farm', 'Charity', '07969680024'),
        ('Alan Terry', 'cheers@liquidindulgence.co.uk', 'Liquid Indulgence', 'Wine Club specialist', '07917 539720'),
        ('Alex Oprea', 'alex.oprea18aug@gmail.com', 'Client Steer', 'Marketing', '07448895459'),
        ('Andrew Coggin', 'andrew@accommodationsuk.co.uk', 'Accommodations UK', 'Hotel Reservation Specialists', '0191 2132131'),
        ('Andy Hadfield', 'andy.hadfield@ichdiensolutions.co.uk', 'Ich Dien Solutions', 'Coaching and Training', '0779 8812473'),
        ('Anthony Rance', 'anthony.rance@weightmans.com', 'Weightmans LLP', 'Legal', '0758 1383759'),
        ('Colin Tansley', 'info@intelect-group.com', 'Intelect', 'Investigations, Training and Technology', '07423 633394'),
        ('Debbie Fletcher', 'debbie@dfmps.co.uk', 'DF Mortgage & Protection Specialists', 'Financial Services', '0795 8664720'),
        ('Elizabeth Ward', 'liz@virtuosolegal.com', 'Virtuoso Legal', 'Legal', '0783 4129522'),
        ('Faisal Ahammad', 'm.f.ahammad@leeds.ac.uk', 'University of Leeds', 'Education', '0791 2042146'),
        ('Glenn Rhea', 'glenn.rhea@complifyglobal.com', 'Complify UK Software & Technology Limited', 'eLearning Provider', '0782 5120813'),
        ('Helen Bateman Underwood', 'helen@underwood-training.co.uk', 'Underwood Training', 'First Aid Training', '0797 1298265'),
        ('Jenny Heath', 'jenny.heath@village-hotels.com', 'Village Hotel Leeds North', 'Hospitality and Leisure', '07818 044521'),
        ('Jessica Allan', 'jessica@mappedandmanaged.co.uk', 'Mapped & Managed', 'VA', '0779 4364432'),
        ('Jon Charters-Reid', 'jon@uksurveys.net', 'Charters-Reid Surveyors Ltd', 'Surveyor', '07900 172636'),
        ('Keith Madeley', 'keith@mryorkshire.com', 'Madeley Enterprises Limited', 'Consultancy', '07831 159800'),
        ('Lee Kaznowski', 'lee.kaznowski@ascentisllp.co.uk', 'Ascentis Accountants', 'Accountancy and Finance', '07795 574604'),
        ('Lisa Summerscales', 'lisa@mclarenandco.com', 'McLaren&Co.', 'Websites and Branding', '07813 300627'),
        ('Louise Rawson', 'louise@rucklidges.co.uk', 'Rucklidges solicitors', 'Legal', '0786 8101052'),
        ('Mark Kelly', 'mark@forthwise.co.uk', 'Mark Kelly Consultancy ltd t/a Forthwise', 'IT consultancy and Business Consultancy', '0735 9860519'),
        ('Najinder Devgun', 'naj@2020fp.co.uk', '20:20 Financial Planning Ltd', 'Financial Advice and Planning', '0747 5541278'),
        ('Nanda Swain', 'nanda.swain@brickwellheath.com', 'Brickwell Heath', 'Property and Development', '0796 5498393'),
        ('Nikki Wallis', 'nikki@talespincopy.co.uk', 'Talespin Copy', 'Marketing and PR', '0791 4626890'),
        ('Rena Crossley', 'rena@getelevated.uk', 'Elevated Ltd', 'Professional Services', '0771 3647077'),
        ('Rosie McGilvray', 'rosie.mcgilvray@va.vitality.co.uk', 'Vitality', 'Private Medical', '07814 103774'),
        ('Philippa Goldstone', 'philippa@equalsone.co.uk', 'Equals One Ltd', 'Recruitment', '07930 407998'),
        ('Poonam Kaur', 'poonam@wearefds.com', 'F D S Director Services Ltd', 'Corporate Finance', '07446 184 924'),
        ('Tom Brook', 'tom@anotherconcept.co.uk', 'Another Concept', 'Marketing Specialist', '07809 256223')
    ) as v(full_name, email, company, industry, phone)
  loop
    note := 'Leeds networking seed · Nov 2026 · Phone: ' || r.phone;

    select s.id, s.status
      into existing_id, existing_status
    from public.hubert_match_seed s
    where s.email is not null
      and lower(trim(s.email)) = lower(trim(r.email))
    limit 1;

    if existing_id is not null then
      if existing_status = 'do_not_contact' then
        continue;
      end if;
      update public.hubert_match_seed
      set
        full_name = r.full_name,
        company = nullif(r.company, ''),
        industry = nullif(r.industry, ''),
        notes = note,
        source = coalesce(nullif(source, ''), 'rosie'),
        updated_at = now()
      where id = existing_id;
    else
      insert into public.hubert_match_seed (
        full_name,
        email,
        company,
        industry,
        notes,
        source,
        status
      ) values (
        r.full_name,
        lower(trim(r.email)),
        nullif(r.company, ''),
        nullif(r.industry, ''),
        note,
        'rosie',
        'active'
      );
    end if;
  end loop;
end $$;
