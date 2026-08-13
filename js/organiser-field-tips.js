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
      title: 'Free trial visits',
      body:
        'Let newcomers visit for free (up to 3) before they join membership or buy a ticket. After visits are used, they need membership or a paid ticket to keep attending.',
      hubertPrompt: 'What are free trial visits?',
    },
    'pay-how': {
      title: 'How do you get paid?',
      body:
        'Choose tickets for this event (paid or free), monthly/annual membership for your group, or both. Free trial visits are optional and work with either path.',
      hubertPrompt: 'Should I use tickets or membership for my networking event?',
    },
    'pay-how-money': {
      title: 'Money for this event',
      body:
        'Tickets are one-off for this listing — including free tickets at £0. Membership is your group dues on the organiser page. Both means guests can buy a ticket or join membership.',
      hubertPrompt: 'What is the difference between tickets and membership?',
    },
    'pay-how-membership': {
      title: 'Monthly / annual membership',
      body:
        'People join your group membership instead of buying a one-off event ticket. You can still offer free trial visits, or tick Members only so only signed-in members can book.',
      hubertPrompt: 'How does monthly membership work with events?',
    },
    'pay-how-both': {
      title: 'Tickets and membership',
      body:
        'Offer public tickets for this event and monthly/annual membership. Guests can buy a ticket, use free trial visits if you offer them, or join membership.',
      hubertPrompt: 'When should I offer both tickets and membership?',
    },
    'member-only-event': {
      title: 'Member-only for this event',
      body:
        'Turns off complimentary guest passes on this date only. Paid member tickets stay on sale and anyone can book them directly — even if they still have free visits left on your organiser page. Your free trial visits continue on your other events.',
      hubertPrompt: 'What does Member-only for this event do on the tickets step?',
    },
    'members-only-ticket': {
      title: 'List-member booking (public can still book)',
      body:
        'People on your member list book free or cheaper when signed in. Public tickets stay on sale for everyone else. Use £0 when membership already covers attendance — members should not pay again.',
      hubertPrompt: 'What is list-member booking?',
    },
    'ce-member-price': {
      title: 'List-member booking',
      body:
        'Optional booking for people already on your membership list. They book without applying. Guests still apply. Use £0 when monthly membership covers attendance.',
      hubertPrompt: 'How does list-member booking work on an application-based event?',
    },
    'members-only-event-listing': {
      title: 'Members only',
      body:
        'Only signed-in members can book — no public booking and no free trial visits. Untick this to offer free trial visits for newcomers. Use under General ticketing when membership is on.',
      hubertPrompt: 'How do I make an event members only with no public ticket?',
    },
    'hub-membership-prices': {
      title: 'Group membership fee',
      body:
        'What people pay to join your group — not a ticket for this one event. After free trial visits, newcomers join on your organiser page. Use £0 if membership is free and you manage the list yourself. People already on your member list book the meeting without buying a public ticket again (usually £0). Amounts also appear under Memberships.',
      hubertPrompt: 'How do I set monthly membership when setting up tickets?',
    },
    'category-exclusivity': {
      title: 'Application based',
      body:
        'You approve who gets the seat (e.g. one per industry). Guests apply with industry and job title. Add tickets after approval, free trial visits, and/or monthly membership — you must have tickets or membership.',
      hubertPrompt: 'What is application based ticketing?',
    },
    'alumni-fast-pass': {
      title: 'Previous Attendees',
      body:
        'Optional returning ticket for previous attendees of a past event. Send locked booking links from your dashboard after publish — great for repeat conferences.',
      hubertPrompt: 'What is Previous Attendees for repeat events?',
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
      title: 'Full series pass',
      body:
        'One checkout price covers every date in this listing — ideal for a 3-day conference pass. Quantity limits how many passes you sell overall. Add separate per-day tiers (without this tick) if you also want single-session tickets or Book all remaining dates.',
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
