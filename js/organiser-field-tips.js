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
      title: 'Attendance modes',
      body:
        'General Ticket Booking — anyone buys a ticket (optional guest visits, member rates, early bird, VIP, etc.). Networking group meeting — free trial visits for newcomers, free member booking for your list, then join Hub monthly/annual membership (no public ticket). Application Based / Category Exclusivity — guests apply with industry and job title; you approve before they pay (optional guest visits and membership).',
      hubertPrompt: 'What is the difference between General Ticket Booking, networking group meeting, and Application Based Category Exclusivity?',
    },
    'guest-visit-programme': {
      title: 'Guest visit programme',
      body:
        'Offer 1–3 complimentary visits so newcomers can try your group. On open booking, paid member tickets unlock afterwards. On Networking group meeting, guests join your monthly membership after visits. Use “Member-only for this event” on open booking to skip guest passes on a specific date.',
      hubertPrompt: 'What is the guest visit programme for networking groups?',
    },
    'member-only-event': {
      title: 'Member-only for this event',
      body:
        'Turns off complimentary guest passes on this date only. Paid member tickets stay on sale and anyone can book them directly — even if they still have free visits left on your organiser page. Your guest visit programme continues on your other events. Use for conferences, member evenings, or any date where you want paying attendees only.',
      hubertPrompt: 'What does Member-only for this event do on the tickets step?',
    },
    'members-only-ticket': {
      title: 'Member price (public can still book)',
      body:
        'Add a free or cheaper ticket that only people on your member list see when they sign in. Public tickets above stay on sale for everyone else. It does not make the event members-only. For monthly membership + complimentary guests with no public ticket, choose Networking group meeting in Step 1.',
      hubertPrompt: 'What is the difference between a members-only rate and a members-only event?',
    },
    'ce-member-price': {
      title: 'Member price on Category Exclusivity',
      body:
        'Optional rate for people already on your membership list. They book without applying. Guests still apply for Category Exclusivity — this does not turn the event into a members-only listing.',
      hubertPrompt: 'How does Member price work on a Category Exclusivity event?',
    },
    'members-only-event-listing': {
      title: 'Closed meeting — member list only',
      body:
        'Your event stays on the directory, but only people on your member list can book — no public ticket and no complimentary guest visits. For monthly membership groups that also offer guest visits, choose Networking group meeting in Step 1 instead.',
      hubertPrompt: 'How do I make an event members only with no public ticket?',
    },
    'hub-membership-prices': {
      title: 'Monthly / annual membership',
      body:
        'Set Hub membership prices on the tickets step. After complimentary visits, newcomers join on your organiser page. People on your member list book the member ticket. Prices also appear under Memberships and can be edited there anytime.',
      hubertPrompt: 'How do I set monthly membership prices when setting up tickets?',
    },
    'category-exclusivity': {
      title: 'Category Exclusivity',
      body:
        'Alternative to open ticket sales. Attendees apply instead of buying straight away. They answer two fixed questions — industry and job title. You approve or deny from your dashboard; approved applicants receive a payment link. You can also enable guest visits and Hub monthly/annual membership so newcomers try a free visit, then join membership.',
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
