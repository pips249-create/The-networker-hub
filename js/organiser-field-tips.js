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
        'Allow newcomers to try your organiser page for free (up to 3 visits). After that, we invite them to join your membership at the price you set. Join and renew are automated, and you keep 100% of the membership fee.',
      hubertPrompt: 'What are free trial visits?',
    },
    'pay-how': {
      title: 'How will people book?',
      body:
        'Ticket for this event = ticket types only. Convert free visits into members = trial visits, then join your group so you keep history and reports. Ticket and membership = both. Open “How do these booking options work?” for a plain-English walkthrough.',
      hubertPrompt: 'Should I use tickets or membership for my networking event?',
    },
    'pay-how-membership': {
      title: 'Convert free visits into members',
      body:
        'Free visits let people try your meetings. When they join, they become members of your group — you can see who came, who joined, and their history. Set a member ticket for this meeting, then the monthly or annual fee after visits are used. Full walkthrough: How booking options work in your organiser workspace.',
      hubertPrompt: 'How does converting free visits into membership work?',
    },
    'pay-how-both': {
      title: 'Ticket and membership',
      body:
        'Newcomers buy a ticket for this event. Regulars join the group and book at a member rate (often £0) so they are not charged the ticket again.',
      hubertPrompt: 'When should I offer both tickets and membership?',
    },
    'member-only-event': {
      title: 'Member-only for this event',
      body:
        'Turns off complimentary guest passes on this date only. Paid member tickets stay on sale and anyone can book them directly — even if they still have free visits left on your organiser page. Your free trial visits continue on your other events.',
      hubertPrompt: 'What does Member-only for this event do on the tickets step?',
    },
    'members-only-ticket': {
      title: 'Members pay less',
      body:
        'People on your member list book free or cheaper when signed in. Everyone else still uses the public ticket. Use £0 when membership already covers attendance.',
      hubertPrompt: 'What is list-member booking?',
    },
    'ce-member-price': {
      title: 'Members pay less',
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
        'What people pay to join your group after free visits. Once they are members, you keep their attendance history and reports. People already on your list book this meeting with the member ticket (usually £0).',
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
