/**
 * Unique FAQ copy for each /networking/:city page.
 *
 * Questions follow how people search ("networking in Manchester",
 * "business networking events in Glasgow"). Answers name the districts
 * this directory already covers. They do not promise a live meeting in
 * every neighbourhood, or name groups and venues we do not run.
 *
 * Counties and /networking/online keep the shared template in
 * networking-region-content.js. {inventory} is filled from the live counts.
 */
function inventorySentence(listingCount, dateCount) {
  const listings = Number(listingCount) || 0;
  const dates = Number(dateCount) || 0;
  if (listings <= 0) return 'New meetings are added as organisers publish them.';
  const listingWord = listings === 1 ? 'listing' : 'listings';
  if (dates > listings) {
    const dateWord = dates === 1 ? 'date' : 'dates';
    return (
      'There are currently ' +
      listings +
      ' ' +
      listingWord +
      ', covering ' +
      dates +
      ' upcoming ' +
      dateWord +
      '. Each listing is one group.'
    );
  }
  return 'There are currently ' + listings + ' upcoming ' + listingWord + '.';
}

function fillInventory(text, listingCount, dateCount) {
  return String(text || '')
    .replace(/\{inventory\}/g, inventorySentence(listingCount, dateCount))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const CITY_FAQS = {
  manchester: {
    places: ['Northern Quarter', 'Deansgate', 'Spinningfields', 'Salford Quays'],
    faqs: [
      {
        question: 'Where can I find networking in Manchester?',
        answer:
          'Networking in Manchester is listed on this page. {inventory} Coverage runs from the Northern Quarter and Deansgate to Spinningfields and Salford Quays. Listings include breakfast meetings, evening mixers, workshops and industry groups. Open an event for the date and price, or an organiser page for that group’s next meetings.',
      },
      {
        question: 'Where do business networking groups meet in Manchester?',
        answer:
          'Business networking groups in Manchester are listed across the city rather than in a single room. This page covers Deansgate, Spinningfields, the Northern Quarter and Salford Quays, including MediaCity. The venue is on each listing, so you can compare a city-centre meeting with a Salford one before you book.',
      },
      {
        question: 'Is there breakfast networking in Manchester?',
        answer:
          'Breakfast networking in Manchester is listed whenever an organiser publishes a morning meeting. You will also see lunch and after-work events on the same page. Many groups offer a guest visit, so you can try the room before you join. Filter by date, then check the start time and ticket on the event page.',
      },
      {
        question: 'Are there free networking events in Manchester?',
        answer:
          'Free networking events in Manchester appear here when an organiser publishes a free ticket or a guest visit. Paid breakfasts and mixers stay on the same list. Use the price filter to show free and low-cost meetings, then open the listing to confirm the ticket is still available.',
      },
    ],
  },
  birmingham: {
    places: ['Colmore Row', 'Digbeth', 'Jewellery Quarter', 'Edgbaston'],
    faqs: [
      {
        question: 'Where can I find networking in Birmingham?',
        answer:
          'Networking in Birmingham is listed on this page. {inventory} The calendar runs from Colmore Row and the city centre to Digbeth, the Jewellery Quarter and Edgbaston. It includes regular groups and one-off business events. Open a listing for the date and price, or the organiser page for the next meeting.',
      },
      {
        question: 'What business networking is on in Birmingham?',
        answer:
          'Business networking in Birmingham is listed across the city centre and the districts around it. This page covers Colmore Row, Digbeth, the Jewellery Quarter and Edgbaston. Colmore Row is the business district. Digbeth and the Jewellery Quarter are the creative side of the centre. Edgbaston is where the larger conference venues sit. The format and venue are on the listing.',
      },
      {
        question: 'Can I visit a networking group in Birmingham before I join?',
        answer:
          'Yes, when the organiser offers a guest visit. Open the organiser page to see the next Birmingham meeting, the format and whether a guest ticket is listed. One-off mixers and exhibitions can be booked without joining a group. A guest visit is the straightforward way to judge a weekly or monthly group before you commit.',
      },
      {
        question: 'Are there free networking events in Birmingham?',
        answer:
          'Free networking in Birmingham is listed beside paid events. Filter by price to show free and low-cost meetings, including guest visits where the organiser has published one. Confirm the ticket on the event page before you travel.',
      },
    ],
  },
  cardiff: {
    places: ['Cardiff Bay', 'South Wales'],
    faqs: [
      {
        question: 'Where can I find networking in Cardiff?',
        answer:
          'Networking in Cardiff is listed on this page. {inventory} Meetings run from Cardiff Bay and the city centre out towards the wider South Wales business community. You will see breakfasts, lunches, evening mixers and industry groups. Open an event for the venue and price, or an organiser page for that group’s next sessions.',
      },
      {
        question: 'Where do networking events meet in Cardiff?',
        answer:
          'Networking events in Cardiff are listed in Cardiff Bay and the city centre. Some groups also draw people from across South Wales. Bay meetings and city-centre meetings sit on the same page. Each listing shows the venue, so you can choose a room that is easy to reach.',
      },
      {
        question: 'What types of business networking happen in Cardiff?',
        answer:
          'Business networking in Cardiff on this page covers referral-style breakfast groups, coffee meetups, lunch events and evening mixers, plus workshops and conferences when organisers publish them. Hybrid meetings you can join from Cardiff are included. Filter by format, date and price to see what is actually coming up.',
      },
      {
        question: 'Are there free networking events in Cardiff?',
        answer:
          'Free networking events in Cardiff show up when an organiser lists a free ticket or a guest visit. Paid meetings stay on the same page. Use the price filter, then check the event page so you know whether the ticket is free, a one-off guest place, or a paid seat.',
      },
    ],
  },
  liverpool: {
    places: ['Albert Dock', 'Baltic Triangle', 'Merseyside'],
    faqs: [
      {
        question: 'Where can I find networking events in Liverpool?',
        answer:
          'Networking events in Liverpool are listed on this page. {inventory} Coverage runs from the Albert Dock and the Baltic Triangle to the wider Merseyside business community. Open a listing for the date, venue and price.',
      },
      {
        question: 'Which parts of Liverpool have business networking?',
        answer:
          'Business networking in Liverpool is published across the waterfront and the city centre. This page covers the Albert Dock and the Baltic Triangle, plus other Merseyside meetings when the organiser sets Liverpool as the city. The Albert Dock is the waterfront. The Baltic Triangle is the creative district just inland. Check the venue line before you book.',
      },
      {
        question: 'Is there breakfast networking in Liverpool?',
        answer:
          'Breakfast networking in Liverpool is listed when a group publishes a morning meeting. Evening events around the dock and the Baltic sit on the same calendar. Filter by date and look at the start time on the event page. A guest visit, where offered, lets you try a regular group once.',
      },
      {
        question: 'Can I attend a Liverpool networking group as a guest?',
        answer:
          'Often, yes. Many Liverpool groups publish a guest visit so you can attend once before you join. The organiser page shows the next date and whether a guest ticket is open. One-off mixers do not need a membership. Book from the event page either way.',
      },
    ],
  },
  leeds: {
    places: ['West Yorkshire'],
    faqs: [
      {
        question: 'Where can I find networking events in Leeds?',
        answer:
          'Networking events in Leeds are listed on this page. {inventory} The page covers the city centre and groups that draw people from the wider West Yorkshire business community. Open a listing for the format, date and price.',
      },
      {
        question: 'Does Leeds networking cover West Yorkshire?',
        answer:
          'The Leeds page is the city calendar first. Meetings in the city centre are listed here, and so are groups that describe themselves as Leeds but welcome the wider West Yorkshire business community. If a meeting is in another town, the venue line makes that clear. Use it when you need a room you can actually get to.',
      },
      {
        question: 'What formats of networking are there in Leeds?',
        answer:
          'Networking in Leeds includes breakfast meetings, lunch events, evening mixers, workshops and conferences, depending on what organisers have published. Industry groups and hybrid sessions you can join from Leeds are listed too. Filter by format and date rather than assuming every week has the same kind of room.',
      },
      {
        question: 'Are there free networking events in Leeds?',
        answer:
          'Free networking events in Leeds are listed when the ticket price is free or the organiser has opened a guest visit. Use the price filter to hide paid meetings, then confirm the ticket on the event page.',
      },
    ],
  },
  glasgow: {
    places: ['Clyde', 'city centre'],
    faqs: [
      {
        question: 'Where can I find business networking events in Glasgow?',
        answer:
          'Business networking events in Glasgow are listed on this page. {inventory} Meetings are published across the city centre and along the Clyde. Open an event for the date and price, or an organiser page for that group’s next session.',
      },
      {
        question: 'Where do networking groups meet in Glasgow?',
        answer:
          'Networking groups in Glasgow meet in the city centre and in rooms along the Clyde. The listing shows the venue, so you can tell a central breakfast from a waterfront evening event. Filter by date if you only want what is on this week.',
      },
      {
        question: 'What is the difference between a Glasgow networking group and a one-off event?',
        answer:
          'A networking group in Glasgow meets on a repeating pattern, and each date stays on that group’s listing. A one-off event is a single mixer, workshop or conference. Guest visits, where the organiser offers them, apply to groups. One-off events are booked as a ticket. Both appear on this page.',
      },
      {
        question: 'Are there free business networking events in Glasgow?',
        answer:
          'Free business networking events in Glasgow appear when an organiser publishes a free ticket or a guest visit. Paid meetings remain on the list. Filter by price, then open the event to confirm what you would pay.',
      },
    ],
  },
  edinburgh: {
    places: ['Old Town', 'New Town', 'Leith'],
    faqs: [
      {
        question: 'Where can I find networking events in Edinburgh?',
        answer:
          'Networking events in Edinburgh are listed on this page. {inventory} Coverage runs from the Old Town and New Town to Leith and the wider Lothians. Open a listing for the venue, date and price.',
      },
      {
        question: 'Where in Edinburgh do business networking meetings run?',
        answer:
          'Business networking meetings in Edinburgh are published in the Old Town, the New Town and Leith, plus groups that draw the wider Lothians. Old Town and New Town listings are in the centre. Leith listings are on the waterfront. The venue is on every event.',
      },
      {
        question: 'Is there morning and evening networking in Edinburgh?',
        answer:
          'Both appear on this page when organisers publish them. A morning listing is a breakfast group. An evening listing is a mixer or an industry social. The start time is on the event page. Filter by date to see which format is on the day you can attend.',
      },
      {
        question: 'Can I try a networking group in Edinburgh before I join?',
        answer:
          'Yes, if that group offers a guest visit. The organiser page for an Edinburgh group shows the next meeting and whether a guest ticket is open. Festivals, conferences and one-off mixers are booked as a normal ticket, without a membership.',
      },
    ],
  },
  bristol: {
    places: ['Harbourside', 'Temple Meads', 'Clifton'],
    faqs: [
      {
        question: 'Where can I find business networking events in Bristol?',
        answer:
          'Business networking events in Bristol are listed on this page. {inventory} The calendar covers Temple Meads, the Harbourside and Clifton. Open a listing for the date, format and price.',
      },
      {
        question: 'Which Bristol neighbourhoods have networking events?',
        answer:
          'Networking events in Bristol are published around Temple Meads, the Harbourside and Clifton, and in the city centre between them. All three are in scope for this page. The venue line tells you which side of the city the meeting is on.',
      },
      {
        question: 'What kinds of networking groups meet in Bristol?',
        answer:
          'Networking groups in Bristol on this page include breakfast clubs, industry groups, workshops and evening mixers. Creative and independent businesses are a large part of the city’s calendar, alongside professional services. Check the format on the listing rather than assuming every group is a referral breakfast.',
      },
      {
        question: 'Are there free networking events in Bristol?',
        answer:
          'Free networking events in Bristol are listed when the organiser sets a free ticket or a guest visit. Use the price filter, then open the event to confirm you can attend without paying.',
      },
    ],
  },
  newcastle: {
    places: ['Quayside', 'North East'],
    faqs: [
      {
        question: 'Where can I find networking events in Newcastle?',
        answer:
          'Networking events in Newcastle are listed on this page. {inventory} Meetings are published on the Quayside, in the city centre, and for groups that serve the wider North East. Open a listing for the venue and price.',
      },
      {
        question: 'Do Newcastle networking events cover the wider North East?',
        answer:
          'This page is the Newcastle calendar. City-centre and Quayside meetings are listed here. So are groups that meet in Newcastle and draw people from the wider North East. If the venue is outside the centre, it is named on the listing. Use that when a Quayside room and a regional meeting are both on the same day.',
      },
      {
        question: 'Is there Quayside and city-centre networking in Newcastle?',
        answer:
          'Quayside and city-centre networking in Newcastle are both listed when organisers publish them. The Quayside is the river. The city centre is the rooms above it. The address is on the event, so you can pick the one you can walk to.',
      },
      {
        question: 'Are there free networking events in Newcastle?',
        answer:
          'Free networking events in Newcastle appear beside paid ones. Filter by price to see free tickets and low-cost guest visits, then confirm the ticket on the event page.',
      },
    ],
  },
  nottingham: {
    places: ['Lace Market', 'East Midlands'],
    faqs: [
      {
        question: 'Where can I find networking in Nottingham?',
        answer:
          'Networking in Nottingham is listed on this page. {inventory} Coverage runs from the Lace Market and the city centre to groups that serve the wider East Midlands. Open an event for the date and price.',
      },
      {
        question: 'Where do Nottingham business networking events meet?',
        answer:
          'Business networking events in Nottingham are published in the Lace Market and the city centre. The Lace Market is the historic quarter beside the centre. A listing names its venue, so you can tell a Lace Market room from a city-centre one.',
      },
      {
        question: 'Does networking in Nottingham cover the East Midlands?',
        answer:
          'The page lists Nottingham meetings first. Groups that welcome the wider East Midlands still appear when Nottingham is the city on the event. Meetings based in another East Midlands city are not mixed in. Check the venue if you need to stay in the centre.',
      },
      {
        question: 'Can I visit a Nottingham networking group once before I join?',
        answer:
          'You can, when the organiser has published a guest visit. The organiser page shows the next Nottingham date and whether that guest ticket is open. One-off mixers and workshops are booked as a ticket, with no membership.',
      },
    ],
  },
  sheffield: {
    places: ['South Yorkshire'],
    faqs: [
      {
        question: 'Where can I find networking events in Sheffield?',
        answer:
          'Networking events in Sheffield are listed on this page. {inventory} The calendar covers the city centre and groups that draw the wider South Yorkshire business community. Open a listing for the format, date and price.',
      },
      {
        question: 'Does Sheffield networking include South Yorkshire?',
        answer:
          'Sheffield networking on this page is the city calendar, plus groups that describe their room as Sheffield and welcome people from across South Yorkshire. A meeting in another South Yorkshire town is only listed here when the organiser has set Sheffield as the city. The venue line is the check.',
      },
      {
        question: 'What business networking formats are listed in Sheffield?',
        answer:
          'Business networking in Sheffield includes breakfast groups, evening mixers, workshops and industry events, as organisers publish them. Manufacturing, professional services and digital meetups can all appear. The format is on the card. Filter by date and price to narrow the list.',
      },
      {
        question: 'Are there free networking events in Sheffield?',
        answer:
          'Free networking events in Sheffield are listed when a ticket is free or a guest visit is open. Use the price filter so paid meetings drop out, then confirm on the event page.',
      },
    ],
  },
  brighton: {
    places: ['seafront', 'creative quarter', 'Sussex'],
    faqs: [
      {
        question: 'Where can I find networking in Brighton?',
        answer:
          'Networking in Brighton is listed on this page. {inventory} Meetings are published along the seafront, in the creative quarter, and for groups that draw the wider Sussex coast. Open a listing for the venue and price.',
      },
      {
        question: 'Where do Brighton networking events meet?',
        answer:
          'Brighton networking events meet on the seafront and in the creative quarter, which covers the Lanes and the streets just inland. Agency, freelance and independent groups are listed here with general business events. The venue is on each event.',
      },
      {
        question: 'Is there creative and freelance networking in Brighton?',
        answer:
          'Creative and freelance networking in Brighton is listed when those organisers publish a meeting. You will also see general business breakfasts and coast-wide groups. Read the event title and format. A guest visit, where offered, is a way to test a regular room before you join.',
      },
      {
        question: 'Are there free networking events in Brighton?',
        answer:
          'Free networking events in Brighton appear when the organiser sets a free price or a guest visit. Filter by price, then check the event page before you go.',
      },
    ],
  },
  cambridge: {
    places: ['science park', 'Cambridgeshire'],
    faqs: [
      {
        question: 'Where can I find networking events in Cambridge?',
        answer:
          'Networking events in Cambridge are listed on this page. {inventory} Coverage runs from the science park and the city centre to the wider Cambridgeshire network. Open a listing for the date, venue and price.',
      },
      {
        question: 'Is there networking at Cambridge Science Park and in the city centre?',
        answer:
          'Both are in scope for this page. Science-park networking in Cambridge is listed when the venue is on the park or the group describes itself that way. City-centre meetings are listed separately. The venue line shows which you are booking, which matters if you are travelling from the station.',
      },
      {
        question: 'What networking suits founders in Cambridge?',
        answer:
          'Founders use this page to compare science-park meetups, city-centre breakfasts and one-off workshops. Listings show the format, date and price. A guest visit, where the organiser offers one, is how you try a regular group before joining. Filter by date if you only want this month.',
      },
      {
        question: 'Can I attend a Cambridge networking group as a guest?',
        answer:
          'Yes, when a guest visit is published. The organiser page lists the next Cambridge meeting and whether a guest ticket is open. Conferences and one-off events are booked as a normal ticket.',
      },
    ],
  },
  oxford: {
    places: ['Oxfordshire'],
    faqs: [
      {
        question: 'Where can I find networking in Oxford?',
        answer:
          'Networking in Oxford is listed on this page. {inventory} It covers the city centre and groups that serve business communities across Oxfordshire. Open an event for the venue, date and price.',
      },
      {
        question: 'Does Oxford networking include the wider Oxfordshire towns?',
        answer:
          'This page lists Oxford meetings. A group based in the city that welcomes the wider county still appears here. Towns such as Banbury, Abingdon and Bicester are not added unless the organiser has set Oxford as the city. Read the venue. County-wide coverage sits on the Oxfordshire networking page.',
      },
      {
        question: 'What types of business networking happen in Oxford?',
        answer:
          'Business networking in Oxford includes professional breakfasts, research and startup meetups, workshops and evening events, depending on what is published. The format is on the listing. Hybrid meetings you can join from Oxford are included.',
      },
      {
        question: 'Are there free networking events in Oxford?',
        answer:
          'Free networking events in Oxford are listed when the ticket is free or a guest visit is available. Use the price filter, then confirm the ticket on the event page.',
      },
    ],
  },
  chester: {
    places: ['Rows', 'Cheshire'],
    faqs: [
      {
        question: 'Where can I find networking in Chester?',
        answer:
          'Networking in Chester is listed on this page. {inventory} Meetings are published around the city walls and the Rows, and for groups that sit in the wider Cheshire business network. Open a listing for the venue and price.',
      },
      {
        question: 'Where do Chester networking groups meet?',
        answer:
          'Chester networking groups meet in the city centre, including rooms by the Rows and the walls. That is separate from groups in Crewe, Warrington and the rest of Cheshire, which are on the Cheshire page. If you want a meeting you can walk to from the station, stay on this Chester list and read the venue.',
      },
      {
        question: 'Is Chester networking separate from the wider Cheshire calendar?',
        answer:
          'Yes. This page is Chester. The Cheshire networking page covers Chester plus Crewe, Warrington and the rest of the county. Use Chester when you want the city. Use Cheshire when a county-wide group is a better fit. A guest visit, where offered, lets you try a Chester group once.',
      },
      {
        question: 'Can I try a networking group in Chester before I join?',
        answer:
          'You can when the organiser publishes a guest visit. The organiser page shows the next Chester date and whether that ticket is open. One-off lunches and mixers are booked without joining.',
      },
    ],
  },
  belfast: {
    places: ['Cathedral Quarter', 'Titanic Quarter'],
    faqs: [
      {
        question: 'Where can I find networking events in Belfast?',
        answer:
          'Networking events in Belfast are listed on this page. {inventory} Coverage runs from the Cathedral Quarter and the Titanic Quarter across the city’s business networks. Open a listing for the date, venue and price.',
      },
      {
        question: 'Where do business networking groups meet in Belfast?',
        answer:
          'Business networking groups in Belfast are published in the Cathedral Quarter and the Titanic Quarter, plus city-centre rooms between them. The Cathedral Quarter is the centre. The Titanic Quarter is the waterfront to the east. The venue is on the event page.',
      },
      {
        question: 'What kinds of networking are listed in Belfast?',
        answer:
          'Networking in Belfast on this page includes breakfast groups, evening mixers, workshops and conferences. Professional services, founders and sector groups can all appear. Filter by format and date. Hybrid meetings you can join from Belfast are listed too.',
      },
      {
        question: 'Are there free networking events in Belfast?',
        answer:
          'Free networking events in Belfast are listed when an organiser publishes a free ticket or a guest visit. Filter by price, then confirm on the event page before you book.',
      },
    ],
  },
  reading: {
    places: ['Thames Valley', 'Berkshire'],
    faqs: [
      {
        question: 'Where can I find networking events in Reading?',
        answer:
          'Networking events in Reading are listed on this page. {inventory} The calendar covers the town centre, the Thames Valley and groups that draw Berkshire. Open a listing for the venue, date and price.',
      },
      {
        question: 'Does Reading networking cover the Thames Valley?',
        answer:
          'Reading is the Thames Valley’s main listed town on this page. Town-centre meetings are here. So are groups that meet in Reading and welcome the wider Thames Valley. Maidenhead, Newbury and the rest of the county are not folded in unless Reading is the city on the event. The Berkshire page is the county-wide list.',
      },
      {
        question: 'What business networking is listed in Reading?',
        answer:
          'Business networking in Reading includes commuter-friendly breakfasts, lunch groups, professional mixers and occasional conferences. Tech and corporate groups sit alongside independent businesses. The format and start time are on the listing, which matters if you are coming from the station.',
      },
      {
        question: 'Are there free networking events in Reading?',
        answer:
          'Free networking events in Reading appear when the ticket is free or a guest visit is open. Use the price filter, then check the event page.',
      },
    ],
  },
  leicester: {
    places: ['Golden Mile', 'Leicestershire'],
    faqs: [
      {
        question: 'Where can I find networking in Leicester?',
        answer:
          'Networking in Leicester is listed on this page. {inventory} Coverage runs from the Golden Mile and the city centre to the wider Leicestershire network. Open an event for the date and price.',
      },
      {
        question: 'Where do Leicester networking events meet?',
        answer:
          'Leicester networking events meet in the city centre and along the Golden Mile. City-centre rooms cover breakfasts and professional groups. Golden Mile listings are part of the same calendar when the organiser sets Leicester as the city. The venue line shows which part of town you are going to.',
      },
      {
        question: 'Does the Leicester page include Leicestershire?',
        answer:
          'This page lists Leicester. Groups that meet in the city and welcome the wider county appear here. A meeting in another Leicestershire town is not added unless Leicester is the city on the event. County-wide groups are on the Leicestershire networking page. Read the venue either way.',
      },
      {
        question: 'Can I visit a Leicester networking group before I join?',
        answer:
          'Yes, when a guest visit is published. The organiser page shows the next Leicester meeting and whether a guest ticket is open. One-off mixers are booked as a ticket, without a membership.',
      },
    ],
  },
  bournemouth: {
    places: ['seafront', 'BIC', 'Dorset'],
    faqs: [
      {
        question: 'Where can I find networking events in Bournemouth?',
        answer:
          'Networking events in Bournemouth are listed on this page. {inventory} Meetings are published along the seafront and at the BIC, and for groups that serve the wider Dorset business community. Open a listing for the venue and price.',
      },
      {
        question: 'Where do Bournemouth networking meetings run?',
        answer:
          'Bournemouth networking meetings run on the seafront and at the BIC, and in the town centre when an organiser publishes a meeting there. Seafront, BIC and town-centre events share this page. The venue is on the event.',
      },
      {
        question: 'Does Bournemouth networking include the rest of Dorset?',
        answer:
          'This page is Bournemouth. Groups that meet in the town and draw Poole and the wider Dorset coast can appear here. Meetings based in another Dorset town belong on the Dorset networking page unless Bournemouth is the city on the listing. Check the venue if you need to stay on the seafront.',
      },
      {
        question: 'Are there free networking events in Bournemouth?',
        answer:
          'Free networking events in Bournemouth are listed when an organiser publishes a free ticket or a guest visit. Filter by price, then confirm the ticket on the event page.',
      },
    ],
  },
  'central-london': {
    places: ['the City', 'Westminster', 'West End'],
    faqs: [
      {
        question: 'Where can I find networking in Central London?',
        answer:
          'Networking in Central London is listed on this page. {inventory} Coverage runs from the City to Westminster and the West End. Open a listing for the venue, date and price, or an organiser page for that group’s next meeting.',
      },
      {
        question: 'Where do Central London business networking events meet?',
        answer:
          'Business networking events in Central London meet in the City, Westminster and the West End. The City is the business district to the east. Westminster sits between the City and the parks. The West End is the streets west of that. The venue and postcode are on the event, which is the useful filter in central London.',
      },
      {
        question: 'Is there breakfast networking in Central London?',
        answer:
          'Breakfast networking in Central London is listed when a group publishes a morning meeting. Check City and West End venues, and use the start time to separate breakfasts from the lunch and after-work events on the same page. Many groups offer a guest visit so you can try one meeting before you join.',
      },
      {
        question: 'Are there free networking events in Central London?',
        answer:
          'Free networking events in Central London appear when the ticket is free or a guest visit is open. Paid events stay listed. Use the price filter, then confirm the ticket before you travel.',
      },
    ],
  },
  'north-london': {
    places: ['Camden', 'Islington', 'Hampstead', 'Highgate'],
    faqs: [
      {
        question: 'Where can I find networking events in North London?',
        answer:
          'Networking events in North London are listed on this page. {inventory} Coverage runs from Camden and Islington to Hampstead and Highgate. Open a listing for the neighbourhood, date and price.',
      },
      {
        question: 'Which North London neighbourhoods have networking?',
        answer:
          'North London networking on this page covers Camden, Islington, Hampstead and Highgate, and the neighbourhoods between them. Camden and Islington are the inner neighbourhoods. Hampstead and Highgate are further north. The venue tells you which it is. City and West End meetings are on the Central London page.',
      },
      {
        question: 'How is North London networking different from the City and West End?',
        answer:
          'North London networking is local groups in Camden, Islington, Hampstead and Highgate, rather than City breakfasts or West End mixers. Use this page if you want a meeting near home or a north-London office. Use Central London if you want the City or the West End. The same group is not listed on both.',
      },
      {
        question: 'Can I attend a North London networking group as a guest?',
        answer:
          'Yes, when the organiser offers a guest visit. The organiser page shows the next meeting and whether a guest ticket is open. One-off mixers in Camden or Islington are booked as a ticket, without joining.',
      },
    ],
  },
  'south-london': {
    places: ['South Bank', 'Brixton', 'Greenwich', 'Croydon'],
    faqs: [
      {
        question: 'Where can I find networking in South London?',
        answer:
          'Networking in South London is listed on this page. {inventory} Coverage runs from the South Bank and Brixton to Greenwich and Croydon. Open a listing for the area, date and price.',
      },
      {
        question: 'Where do South London networking events meet?',
        answer:
          'South London networking events meet on the South Bank, in Brixton, in Greenwich and in Croydon, plus the neighbourhoods between them. The South Bank is the river. Brixton and Greenwich are their own centres. Croydon has its town-centre meetings on this same page. The venue is the way to tell them apart.',
      },
      {
        question: 'Should I look at South London or Central London for networking?',
        answer:
          'Use South London for the South Bank, Brixton, Greenwich and Croydon. Use Central London for the City, Westminster and the West End. A South Bank event is on this page. A City breakfast is not. Pick the page that matches where you will actually travel.',
      },
      {
        question: 'Are there free networking events in South London?',
        answer:
          'Free networking events in South London are listed when an organiser publishes a free ticket or a guest visit. Filter by price, then confirm the ticket on the event page.',
      },
    ],
  },
  'east-london': {
    places: ['Shoreditch', 'Canary Wharf', 'Stratford'],
    faqs: [
      {
        question: 'Where can I find networking events in East London?',
        answer:
          'Networking events in East London are listed on this page. {inventory} Coverage runs from Shoreditch and Canary Wharf to Stratford and the docks. Open a listing for the venue, date and price.',
      },
      {
        question: 'Where do East London business networking groups meet?',
        answer:
          'Business networking groups in East London meet in Shoreditch, Canary Wharf, Stratford and the docks. Shoreditch is the inner east. Canary Wharf is the business district on the Isle of Dogs. Stratford and the docks cover the Olympic Park and the river. The venue shows which side of east London you are booking.',
      },
      {
        question: 'Is there startup networking in East London?',
        answer:
          'Startup networking in East London is listed when those organisers publish a meetup. Shoreditch is the neighbourhood to read first. Corporate networking around Canary Wharf is on the same page, so read the title and format before you book. A guest visit, where offered, lets you try a regular group once.',
      },
      {
        question: 'Are there free networking events in East London?',
        answer:
          'Free networking events in East London appear when the ticket is free or a guest visit is open. Use the price filter, then check the event page. Paid mixers stay on the list until you filter them out.',
      },
    ],
  },
  'west-london': {
    places: ['Kensington', 'Notting Hill', 'Hammersmith', 'Heathrow'],
    faqs: [
      {
        question: 'Where can I find networking in West London?',
        answer:
          'Networking in West London is listed on this page. {inventory} Coverage runs from Kensington and Notting Hill to Hammersmith and the Heathrow corridor. Open a listing for the neighbourhood, date and price.',
      },
      {
        question: 'Which parts of West London have business networking?',
        answer:
          'Business networking in West London is published in Kensington, Notting Hill, Hammersmith and along the Heathrow corridor. Kensington and Notting Hill are the inner west. Hammersmith is the town centre further out. Heathrow-corridor meetings are listed when the organiser sets a west-London venue near the airport. Check the address before you travel.',
      },
      {
        question: 'Is there West London networking along the Heathrow corridor as well as in town?',
        answer:
          'Yes, when organisers publish it. In-town networking in West London is Kensington, Notting Hill and Hammersmith. Heathrow-corridor networking is the meetings further west, towards the airport and the business parks. They share this page. The venue line is how you separate a Hammersmith breakfast from a corridor lunch.',
      },
      {
        question: 'Can I try a West London networking group before I join?',
        answer:
          'You can when a guest visit is listed. The organiser page shows the next West London meeting and whether a guest ticket is open. One-off mixers and conferences are booked as a ticket, with no membership.',
      },
    ],
  },
};

function getCityNetworkingFaqs(slug, listingCount, dateCount) {
  const entry = CITY_FAQS[String(slug || '').trim().toLowerCase()];
  if (!entry || !entry.faqs) return null;
  return entry.faqs.map(function (item) {
    return {
      question: item.question,
      answer: fillInventory(item.answer, listingCount, dateCount),
    };
  });
}

function getCityFaqLocalTerms(slug) {
  const entry = CITY_FAQS[String(slug || '').trim().toLowerCase()];
  if (!entry || !entry.places) return null;
  return entry.places.slice();
}

module.exports = {
  CITY_FAQS,
  getCityNetworkingFaqs,
  getCityFaqLocalTerms,
  inventorySentence,
};
