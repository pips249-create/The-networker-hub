/**
 * Inline field tips — shared copy for organiser forms and Hubert.
 * Keep in sync with api/_lib/hubert-knowledge.js organiser sections.
 */
(function (global) {
  global.OrganiserFieldTips = {
    'event-organiser': {
      title: 'Organiser page',
      body:
        'Which organiser page this event is listed under. Attendees see this name on the event and can browse other events from the same organiser.',
      hubertPrompt: 'Which organiser page should I list my event under?',
    },
    'event-type': {
      title: 'Event type',
      body:
        'Meeting covers breakfasts, netwalking, women-only and most networking listings. Use Conference, Exhibition or Awards for summits, trade shows and dinners. Events is for other larger formats. Webinar, Workshop, Seminar and Masterclass help attendees find the right style of listing.',
      hubertPrompt: 'Which event type should I choose for my networking event?',
    },
    'event-description': {
      title: 'Highlights / description',
      body:
        'Attendees search and filter events using this text — include who it is for, what happens, and useful keywords.',
      hubertPrompt: 'What should I write in the event description?',
    },
    'event-photo': {
      title: 'Event photo',
      body:
        'Upload, paste (Ctrl+V), or drop an image — or paste a URL below. Drag the crop to choose what appears on browse cards. Use a landscape photo at least 1200×750px for a sharp listing.',
      hubertPrompt: 'What size and style of photo works best for an event listing?',
    },
    'event-dates': {
      title: 'Dates',
      body:
        'Select one date for a single event, or click multiple days on the calendar to create a series — the same UK start and end time apply to every date you pick (Europe/London), including dates either side of the clocks changing. Series work best for recurring meetings on different weeks (same time and venue each session).',
      hubertPrompt: 'How do I add multiple dates or create a recurring series?',
    },
    'event-series-planning': {
      title: 'Multi-date listings',
      body:
        'Each calendar date becomes its own session with the same ticket tiers copied across the series. Attendees can book one date or use Book all remaining dates on the listing when every session shares the same price. For a small conference with one admission price covering every day, you can instead sell tickets on the first date only and state in the description that the ticket includes all days — you manage entry manually.',
      hubertPrompt: 'How should I list a multi-day conference or recurring series?',
    },
    'event-times': {
      title: 'Start and end time',
      body:
        'Same UK start and end time for every selected date (Europe/London) — 10:15 stays 10:15 even after the clocks change. End time must be after start time. Pick the hour, then minutes in 15-minute steps. Different times per day? Create separate listings instead.',
      hubertPrompt: 'Can I set different times for different dates in a series?',
    },
    'event-venue': {
      title: 'Venue & address',
      body: 'Shown on your public listing for in-person events.',
      hubertPrompt: 'What address details do I need for an in-person event?',
    },
    'event-online': {
      title: 'Online access',
      body:
        'Only shared with ticket holders — not shown on the public listing. You can add or update the join link anytime before the event; ticket holders are emailed when a link is first added. No link yet? Save your listing and paste the Zoom, Teams, or Meet URL when it is ready.',
      hubertPrompt: 'When do I add the Zoom or Teams link for an online event?',
    },
    'attendance-modes': {
      title: 'How people get in',
      body:
        'Two choices: General ticketing (anyone can book) or Application based (you approve seats, e.g. one per industry). Next you add tickets, free trial visits, and/or monthly membership — you must have tickets or membership (or both).',
      hubertPrompt: 'How should I set up tickets for my event?',
    },
    'guest-visit-programme': {
      title: 'Complimentary visits',
      body:
        'Visitors try your group with a complimentary visit (up to 3). After that they book your ticket, or join membership if you offer it. You can still have a free ticket and a paid ticket. Do not add a ticket named First Meeting for a first visit — that can be booked on every remaining date with no visit limit.',
      hubertPrompt: 'What are complimentary visits?',
    },
    'pay-how': {
      title: 'How will people book?',
      body:
        '1 = everyone books a ticket. 2 = new group: try free, then join. 3 = already have members: guest ticket, members pay less or nothing. Open “How do these booking options work?” for examples.',
      hubertPrompt: 'Should I use tickets or membership for my networking event?',
    },
    'pay-how-membership': {
      title: 'Free visits, then membership',
      body:
        'New group. People try a meeting free, then join. You stay on this option when they become members.',
      hubertPrompt: 'How does Free visits, then membership work?',
    },
    'pay-how-both': {
      title: 'Ticket and membership',
      body:
        'You already have members. Guests buy a ticket. Members pay a different price, or nothing.',
      hubertPrompt: 'When should I offer both tickets and membership?',
    },
    'member-only-event': {
      title: 'Pause free visits on this date',
      body:
        'Hides free trial visits for this event only. Public or member tickets stay available as you set them.',
      hubertPrompt: 'How do I turn off free visits for one event?',
    },
    'event-capacity': {
      title: 'Event capacity',
      body:
        'One room total for this date. Public tickets, member tickets, and free visits all count toward it. Per-ticket “how many available” stays optional as a sub-limit (e.g. only 10 public of 50 seats).',
      hubertPrompt: 'How do I set a maximum capacity with member and public tickets?',
    },
    'members-only-ticket': {
      title: 'Member ticket price',
      body:
        'People on your member list book at this price when signed in. Visitors still use the public ticket. Use £0 when membership covers attendance.',
      hubertPrompt: 'What is list-member booking?',
    },
    'ce-member-price': {
      title: 'Member ticket price',
      body:
        'Optional booking for people already on your membership list. They book without applying. Visitors still apply. Use £0 when membership covers attendance.',
      hubertPrompt: 'How does list-member booking work on an application-based event?',
    },
    'members-only-event-listing': {
      title: 'Closed meeting',
      body:
        'Only signed-in members can book — no public booking and no free trial visits. Leave unticked to keep free trial visits.',
      hubertPrompt: 'How do I make an event members only with no public ticket?',
    },
    'hub-membership-prices': {
      title: 'Group membership fee',
      body:
        'Monthly or annual fee to belong to your group — not the ticket for this meeting. Members already on your list book with the member ticket (usually £0). Change amounts later under Memberships.',
      hubertPrompt: 'How do I set monthly membership when setting up tickets?',
    },
    'category-exclusivity': {
      title: 'Application based',
      body:
        'You approve who gets the seat (e.g. one per industry). Guests apply with industry and job title. Add tickets after approval, free trial visits, and/or monthly membership — you must have tickets or membership.',
      hubertPrompt: 'What is application based ticketing?',
    },
    'vat-treatment': {
      title: 'VAT on ticket prices',
      body:
        'Required before publishing paid tickets. Choose VAT included, VAT added at checkout, or Not VAT registered if you do not charge VAT. Shown on your public listing so attendees know what to expect. Not needed when all tickets are free.',
      hubertPrompt: 'Should VAT be included in my ticket price or added at checkout?',
    },
    'event-series-tickets': {
      title: 'Tickets on a multi-date series',
      body:
        'Each ticket tier is copied to every date. For a conference pass at one price (e.g. £299 for all three days), tick Full series pass on that tier. For the same per-session price on every day, leave it unchecked — attendees can use Book all remaining dates (one checkout, price × number of days). Early bird and standard tiers work — set sale end dates per tier.',
      hubertPrompt: 'How do tickets work when my event has multiple dates?',
    },
    'event-series-pass-tier': {
      title: 'Multiple dates (full series pass)',
      body:
        'Shown when this listing has more than one date. Tick it only if one purchase should cover every date (e.g. a 3-day conference). Leave it unticked for weekly networking meetings — each date keeps its own ticket, and attendees can still book all remaining dates in one checkout when prices match.',
      hubertPrompt: 'How do I sell one conference pass price for all days?',
    },
    'stripe-refunds': {
      title: 'Refunds & Stripe Connect',
      body:
        'Ticket revenue goes to your connected Stripe account at checkout. Refunds are debited from that balance. Paid tickets require Stripe Connect under Revenue before publish.',
      hubertPrompt: 'How do Stripe Connect payouts and refunds work for organisers?',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
