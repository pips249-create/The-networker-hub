/**
 * Inline field tips — shared copy for organiser forms and Hubert.
 * Keep in sync with api/_lib/hubert-knowledge.js organiser sections.
 */
(function (global) {
  global.OrganiserFieldTips = {
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
    'private-ticket-code': {
      title: 'Private ticket with a code',
      body:
        'Adds a ticket that the public cannot see. You share one access code with members; they enter it on the event page and the private ticket unlocks. Use for member rates, VIP lists, or invite-only pricing — without putting the price on the public listing.',
      hubertPrompt: 'How do I set up a private ticket with an access code?',
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
        'Optional hidden ticket for previous attendees of a past event. Send locked booking links from your dashboard after publish — great for repeat conferences.',
      hubertPrompt: 'What is Previous Attendees for repeat events?',
    },
    'vat-treatment': {
      title: 'VAT on ticket prices',
      body:
        'Required before publishing. Choose whether your listed price includes VAT or whether VAT is added at checkout. Shown on your public listing so attendees know what to expect.',
      hubertPrompt: 'Should VAT be included in my ticket price or added at checkout?',
    },
    'stripe-refunds': {
      title: 'Refunds & Stripe Connect',
      body:
        'Ticket revenue goes to your connected Stripe account at checkout. Refunds are debited from that balance. Paid tickets require Stripe Connect under Revenue before publish.',
      hubertPrompt: 'How do Stripe Connect payouts and refunds work for organisers?',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
