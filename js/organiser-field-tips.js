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
        'Meeting covers breakfasts, netwalking, women-only and most networking listings. Use Conference, Exhibition or Awards for summits, trade shows and dinners. Events is for other larger formats. Webinar, Workshop and Masterclass help attendees find the right style of listing.',
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
        'Select one date for a single event, or click multiple days on the calendar to create a series — the same times apply to every date you pick. Series work best for recurring meetings on different weeks (same time and venue each session).',
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
        'Same start and end time for every selected date. End time must be after start time. Pick the hour, then minutes in 15-minute steps. Different times per day? Create separate listings instead.',
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
      title: 'Attendance modes',
      body:
        'Choose open ticket booking or Category Exclusivity. With open booking you can also enable the guest visit programme so complimentary visits sit alongside your paid ticket types.',
      hubertPrompt: 'What is the difference between ticket types, guest visit programme, and Category Exclusivity?',
    },
    'guest-visit-programme': {
      title: 'Guest visit programme',
      body:
        'Offer 1–3 complimentary visits so newcomers can try your group before buying a paid member ticket. The allowance applies across your organiser page. Use “Member-only for this event” to skip guest passes on a specific date.',
      hubertPrompt: 'What is the guest visit programme for networking groups?',
    },
    'member-only-event': {
      title: 'Member-only for this event',
      body:
        'Turns off complimentary guest passes on this date only. Paid member tickets stay on sale and anyone can book them directly — even if they still have free visits left on your organiser page. Your guest visit programme continues on your other events. Use for conferences, member evenings, or any date where you want paying attendees only.',
      hubertPrompt: 'What does Member-only for this event do on the tickets step?',
    },
    'members-only-ticket': {
      title: 'Members only ticket',
      body:
        'Adds a ticket that the public cannot see. People on your member list see it automatically when they sign in with their membership email. Use for member rates or invite-only pricing — without putting the price on the public listing.',
      hubertPrompt: 'How do I set up a members only ticket with the member list?',
    },
    'category-exclusivity': {
      title: 'Category Exclusivity',
      body:
        'Alternative to open ticket sales. Attendees apply instead of buying straight away. They answer two fixed questions — industry and job title. You approve or deny from your dashboard; approved applicants receive a payment link.',
      hubertPrompt: 'What is Category Exclusivity?',
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
        'Required before publishing paid tickets. Choose whether your listed price includes VAT or whether VAT is added at checkout. Shown on your public listing so attendees know what to expect. Not needed when all tickets are free.',
      hubertPrompt: 'Should VAT be included in my ticket price or added at checkout?',
    },
    'event-series-tickets': {
      title: 'Tickets on a multi-date series',
      body:
        'Each ticket tier you add is copied to every date in the series. Keep the same price on each day if you want attendees to use Book all remaining dates (one checkout for every session). Early bird and standard tiers work — set sale end dates per tier. For one conference pass price covering all days without per-day booking, use a single paid date and explain in the description that admission includes every day.',
      hubertPrompt: 'How do tickets work when my event has multiple dates?',
    },
    'stripe-refunds': {
      title: 'Refunds & Stripe Connect',
      body:
        'Ticket revenue goes to your connected Stripe account at checkout. Refunds are debited from that balance. Paid tickets require Stripe Connect under Revenue before publish.',
      hubertPrompt: 'How do Stripe Connect payouts and refunds work for organisers?',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
