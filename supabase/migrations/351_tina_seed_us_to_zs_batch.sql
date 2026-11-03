-- TINA Matchmaker seed batch: Us–Zs contacts (Nov 2026).
-- Includes job title, LinkedIn, blurb, location. Idempotent on email.
-- Phones stay in notes only (never on shortlist cards).
-- Requires 350_hubert_match_seed_location.sql

do $$
declare
  r record;
  existing_id uuid;
  existing_status text;
begin
  for r in
    select * from (
      values
        ('Usman Sheikh', 'usman@ansar.london', 'Ansar London', 'Immigration Lawyer', 'Immigration Lawyer', 'https://www.linkedin.com/in/usman-sheikh-233157b9/', 'London immigration lawyer', 'London', 'Us–Zs seed · Nov 2026 · Phone: 020 8993 4990 · Location: London'),
        ('Valentina Cerutti', 'equatherapy@gmail.com', 'Equa Therapy', 'Counsellor & Psychotherapist', 'Counsellor & Psychotherapist', 'https://www.linkedin.com/in/equatherapy/', 'Counsellor & Psychotherapist', 'Manchester', 'Us–Zs seed · Nov 2026 · Phone: 07522 138051 · Location: Manchester'),
        ('Vanessa Challess', 'vanessa@bonsai-law.com', 'Bonsai Law', 'Founder', 'Founder', 'https://www.linkedin.com/in/vanessa-bonsai/', 'Bonsai Law Founder', 'Kent', 'Us–Zs seed · Nov 2026 · Location: Kent'),
        ('Vanessa Louise Moore', 'vanessa@trustvanessa.com', 'Vanessa Loves Life Coach', 'emotional health coach', 'emotional health coach', '', 'Founder', 'Buckinghamshire', 'Us–Zs seed · Nov 2026 · Phone: 07469 152322 · Location: Buckinghamshire'),
        ('Vicki Boddice', 'vicki@boddiceaccounting.co.uk', 'Boddice Accounting', 'accounting and bookkeeping firm', 'accounting and bookkeeping firm', '', 'accounting and bookkeeping firm', 'Falkirk', 'Us–Zs seed · Nov 2026 · Phone: 07771 478307 · Location: Falkirk'),
        ('Vickki Ridgway', 'vickki@rfls.co.uk', 'Ridgway Fahey Legal Services Limited', 'Chartered Legal Executive Litigator', 'Chartered Legal Executive Litigator', 'https://www.linkedin.com/in/vickki-ridgway-2a38b235/', 'A Chartered Legal Executive specialising in clinical negligence, personal injury, dispute resolution, and litigation being driven by a deep commitment to justice and client care. I began my legal journey after returning to work as a secretary, discovering a passion for law that led to years of distance learning and my qualification as a Fellow of CILEX in 2004. Since then, I’ve built a practice rooted in empathy, precision, and advocacy. My motivation? Helping injured people rebuild their lives and guiding clients through complex disputes with clarity and confidence. Whether it’s a missed diagnosis, surgical error, or contentious litigation, I prepare each case with meticulous attention to detail and creative strategy, always putting the client at the heart of the claim. Proud to have…', '', 'Us–Zs seed · Nov 2026 · Phone: 0790 7058776'),
        ('Vicky Johnson', 'vgregory@talk21.com', 'Peter Bebb', 'Account Handler at PB Curran', 'Account Handler at PB Curran', '', 'Experienced Senior Broker with a demonstrated history of working in the insurance industry. Specialising in insurances for the Healthcare Profession. Skilled in Working with Brokers, Liability, Legal Liability, Insurance, and Renewals.', 'York', 'Us–Zs seed · Nov 2026 · Phone: 01904 656 314 · Location: York'),
        ('Vicky Midwood', 'vicky@vickymidwood.com', 'Self Health Guru', 'Behavioural Strategist & Health Coach', 'Behavioural Strategist & Health Coach', '', 'Specializes in health, lifestyle, and mindset coaching, helping high performers overcome stress, burnout, and habits around food or alcohol.', 'London / Remote, UK', 'Us–Zs seed · Nov 2026 · Phone: 0798 6132765 · Location: London / Remote, UK'),
        ('Vicky Poole', 'vicky@vickypoolecoaching.co.uk', 'Vicky Poole Coaching', 'Communication & Mindset Coach', 'Communication & Mindset Coach', '', 'Delivers empowerment coaching, personal transformation strategies, and effective communication training for professionals and individuals.', 'Reading, Berkshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 07896 909776 · Location: Reading, Berkshire, UK'),
        ('Victoria Brennan', 'hello@victoriabrennan.co.uk', 'Personal Development', 'Independent Consultant & Strategist', 'Independent Consultant & Strategist', '', 'Provides personal advisory, business consulting, and custom workflow development for independent professionals.', '', 'Us–Zs seed · Nov 2026 · Phone: 0795 8748891'),
        ('V Ramsden', 'vramsden@hotmail.com', 'Integrity Performance Consultancy', 'Executive Coach & Business Director', 'Executive Coach & Business Director', '', 'Focuses on leadership development, high-performance executive coaching, and strategic corporate transformation through Integrity Executive Coaching.', 'Gatwick / Sussex, UK', 'Us–Zs seed · Nov 2026 · Phone: 07739 728779 · Location: Gatwick / Sussex, UK'),
        ('Viki Cox', 'viki@empowerhrsupport.co.uk', 'Empower HR Support', 'HR Consultant & Specialist', 'HR Consultant & Specialist', '', 'Provides practical HR solutions, employee compliance, employment policy guidance, and outsourced HR support tailored for small-to-medium businesses.', '', 'Us–Zs seed · Nov 2026 · Phone: 075429 10388'),
        ('Vince Jordan', 'vince@jordan-it-solutions.co.uk', 'Jordan-IT-Solutions', 'Founder & Chief IT Engineer', 'Founder & Chief IT Engineer', '', 'Leads Jordan IT Solutions, providing managed IT support, cybersecurity, cloud integrations, and infrastructure services for SMEs.', 'Thame, Oxfordshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 01844 220218 · Location: Thame, Oxfordshire, UK'),
        ('Viresh Patel', 'info@vizaviproperties.co.uk', 'Vizavi Properties', 'Property Director', 'Property Director', '', 'Oversees property investments, residential/commercial letting, and real estate portfolio management under Vizavi Properties.', '', 'Us–Zs seed · Nov 2026 · Phone: 07564 844860'),
        ('Vivienne Nicholls', 'vivienne@rentadefib.co.uk', 'Rent A Defib', 'Business Development Manager', 'Business Development Manager', '', 'Coordinates business growth and sales operations for Rent A Defib, supplying short- and long-term defibrillator (AED) equipment and safety solutions', 'Derbyshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 0772 9643438 · Location: Derbyshire, UK'),
        ('Wenceslyne Ong', 'wenceslyne@elitelvlservices.com', 'Elite LVL Services', 'Operations Manager & Founder', 'Operations Manager & Founder', '', 'Manages global talent acquisition, offshore team assembly, and remote operations strategy for client businesses.', 'London, UK', 'Us–Zs seed · Nov 2026 · Phone: 07585 146853 · Location: London, UK'),
        ('Wendi McLean', 'enquiries@wendimclean.co.uk', 'The Mind Palace', 'Mindset & Life Transition Coach', 'Mindset & Life Transition Coach', '', 'Specializes in life transformation, confidence building, and emotional wellbeing coaching through individual and group mentoring.', 'Norwich, Norfolk, UK', 'Us–Zs seed · Nov 2026 · Phone: 07960 792763 · Location: Norwich, Norfolk, UK'),
        ('Will Hopkins', 'will@moonrise.media', 'Moonrise Media Ltd.', 'Founder & Video Producer', 'Founder & Video Producer', '', 'Creates brand videos, commercial video productions, and digital media assets through Moonrise Media.', 'Hereford, Herefordshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 07446 232739 · Location: Hereford, Herefordshire, UK'),
        ('William Thomas', 'william@ykdconstruction.co.uk', 'YKD Construction', 'Construction Director', 'Construction Director', '', 'Manages commercial build projects, home renovations, site logistics, and structural developments under YKD Construction.', 'York, North Yorkshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 07808 090682 · Location: York, North Yorkshire, UK'),
        ('Yasmin Faiz', 'yasmin@thewellwater.com', 'Purely Scottish', 'Commercial Account Manager', 'Commercial Account Manager', '', 'Handles client relations, bulk order logistics, and sustainable water solutions (boxed water and coolers) for Purely Scottish Bottlers.', 'East Lothian, Scotland, UK', 'Us–Zs seed · Nov 2026 · Location: East Lothian, Scotland, UK'),
        ('Zoe Binning', 'zoe@zoebinning.co.uk', 'Zoe Binning', 'Wedding Venue & Business Consultant', 'Wedding Venue & Business Consultant', '', 'Provides strategic venue management, eco-friendly business consulting, and commercial expansion advice across the wedding and events sector.', 'Cardiff / South Wales, UK', 'Us–Zs seed · Nov 2026 · Location: Cardiff / South Wales, UK'),
        ('Zoe Freeman', 'zoe.freeman@mihaz.co.uk', 'Mihaz', 'Founder & Business Mentor', 'Founder & Business Mentor', '', 'Delivers executive mentoring, strategy execution, and growth coaching for SME founders and business owners.', 'West Sussex / Hampshire, UK', 'Us–Zs seed · Nov 2026 · Phone: 07747 101884 · Location: West Sussex / Hampshire, UK'),
        ('Zoe Schoon', 'zoe.schoon@pink-spaghetti.co.uk', 'Pink Spaghetti', 'Co-Owner & Virtual Assistant', 'Co-Owner & Virtual Assistant', '', 'Operates the Pink Spaghetti franchise across Somerset, delivering outsourced PA services, social media management, and admin support.', 'Yeovil / Mendip, UK', 'Us–Zs seed · Nov 2026 · Phone: 07795 577405 · Location: Yeovil / Mendip, UK'),
        ('Zoe Tingey', 'zoe.tingey@reachplc.com', 'Reach Plc', 'Commercial Account Manager', 'Commercial Account Manager', '', 'Manages commercial media partnerships, regional advertising strategies, and digital publishing solutions across Reach plc platforms.', 'London / National, UK', 'Us–Zs seed · Nov 2026 · Location: London / National, UK'),
        ('Zsolt Barabas', 'info@indigopropertymaintenance.com', 'Indigo Property Maintenance', 'Founder & Property Maintenance Specialist', 'Founder & Property Maintenance Specialist', '', 'Manages property repairs, home improvements, and residential/commercial building upkeep services under Indigo Property Maintenance.', '', 'Us–Zs seed · Nov 2026 · Phone: 07787 383324'),
        ('Andrew Roberts', 'andrew.roberts2@barclays.com', 'Barclays - Eagle Labs', 'Ecosystem Manager / Startup Growth Lead', 'Ecosystem Manager / Startup Growth Lead', '', 'Facilitates business growth, innovation networking, and incubator support for tech startups and scale-ups through Barclays Eagle Lab', '', 'Us–Zs seed · Nov 2026 · Phone: 07917 848122'),
        ('Tim Wagner', 'tim@professionalpointer.com', 'Professional Pointer', 'Managing Director / Lead Consultant', 'Managing Director / Lead Consultant', '', 'Oversees strategic consulting, pointer training, and specialized professional services', 'South Africa', 'Us–Zs seed · Nov 2026 · Phone: +27 784593131 · Location: South Africa')
    ) as v(full_name, email, company, job_title, professional_role, linkedin_url, blurb, location, notes)
  loop
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
        job_title = nullif(r.job_title, ''),
        professional_role = nullif(r.professional_role, ''),
        linkedin_url = nullif(r.linkedin_url, ''),
        blurb = nullif(r.blurb, ''),
        location = nullif(r.location, ''),
        notes = nullif(r.notes, ''),
        source = coalesce(nullif(source, ''), 'rosie'),
        updated_at = now()
      where id = existing_id;
    else
      insert into public.hubert_match_seed (
        full_name,
        email,
        company,
        job_title,
        professional_role,
        linkedin_url,
        blurb,
        location,
        notes,
        source,
        status
      ) values (
        r.full_name,
        lower(trim(r.email)),
        nullif(r.company, ''),
        nullif(r.job_title, ''),
        nullif(r.professional_role, ''),
        nullif(r.linkedin_url, ''),
        nullif(r.blurb, ''),
        nullif(r.location, ''),
        nullif(r.notes, ''),
        'rosie',
        'active'
      );
    end if;
  end loop;
end $$;

