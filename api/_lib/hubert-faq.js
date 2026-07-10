/**
 * Hubert FAQ — single source for AEO/SEO schema, llms.txt, and page copy.
 * Keep aligned with faq.html and api/_lib/hubert-knowledge.js.
 */
const FAQ_AEO_ENTRIES = [
  {
    question: 'What is The Networker Hub?',
    answer:
      'The Networker Hub is a UK platform for discovering networking meetings, exhibitions, conferences, and business opportunities. Members can search and book; organisers can list events and reach new audiences.',
  },
  {
    question: 'How do I find events on The Networker Hub?',
    answer:
      'Use Browse events in the top navigation or visit the events listing at /events/. You can filter by type, date, industry, and location, and use map view on supported pages.',
  },
  {
    question: 'Do I need an account to browse The Networker Hub?',
    answer:
      'No — browsing is completely free. You can explore events and business opportunities without signing in. You only need a free account when you want to buy a ticket or enquire about a business opportunity. Sign-up takes about 2 minutes.',
  },
  {
    question: 'How do I book a ticket on The Networker Hub?',
    answer:
      'Create a free account first, then open an event from the listing page, choose your ticket type, and complete secure Stripe checkout. You can add guest names at checkout and view bookings in My tickets.',
  },
  {
    question: 'How do I enquire about a business opportunity?',
    answer:
      'Browse opportunities for free at /opportunities/. When you find one you are interested in, sign in or create a free account to send a direct enquiry to the lister from the opportunity page.',
  },
  {
    question: 'How do organisers list an event on The Networker Hub?',
    answer:
      'Sign in, claim your organiser page if prompted, then open the organiser dashboard at /organiser/ to create events and manage attendees. Your networking group may already be listed — search the organiser directory on /events/ and claim the page linked to your email.',
  },
  {
    question: 'Where does event information on The Networker Hub come from?',
    answer:
      'Listings are managed in the events database and updated by organisers and the Networker Hub team. Dates, venues, and prices on each event page are the source of truth for that event.',
  },
  {
    question: 'Who operates The Networker Hub?',
    answer:
      'The Networker Hub is operated by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94), co-founded by Rosie and Catherine.',
  },
  {
    question: 'Who is Hubert on The Networker Hub?',
    answer:
      'Hubert is the business butler and concierge on The Networker Hub. He helps visitors find events and business opportunities, explains how tickets and enquiries work, and guides organisers to the right tools. Chat with Hubert on the contact page or via the floating assistant on public pages.',
  },
  {
    question: 'Is The Networker Hub free to use?',
    answer:
      'Yes — browsing events and business opportunities is completely free with no sign-in required. You only pay when you purchase an event ticket at the price shown by the organiser.',
  },
  {
    question: 'I forgot my password — how do I sign in?',
    answer:
      'Go to /login.html and use the password reset link. Enter your email and follow the instructions. If you are still stuck, email hello@the-networker.co.uk from the address on your account.',
  },
  {
    question: 'I did not receive my booking confirmation email',
    answer:
      'Check your spam or junk folder and confirm your account email is correct. Your tickets also appear in My tickets at /account/. If you still cannot find your booking, email hello@the-networker.co.uk with the event name and email address used at checkout.',
  },
  {
    question: 'Can I transfer my ticket to someone else?',
    answer:
      'Tickets are generally non-transferable without the organiser\'s consent. Contact the organiser via the event listing page to ask. For help, email hello@the-networker.co.uk with your order reference.',
  },
  {
    question: 'What happens if an organiser cancels an event?',
    answer:
      'If an organiser cancels, you should receive a full refund of the ticket price paid, including mandatory booking fees shown at checkout, typically within 14 days via Stripe to your original payment method.',
  },
  {
    question: 'Are there free networking events?',
    answer:
      'Yes — many events on the hub are free to attend. Browse /events/ and check each event page for pricing. Some free events still require registration or a free account to complete sign-up.',
  },
  {
    question: 'Why should I list my networking group on The Networker Hub?',
    answer:
      'The Networker Hub is built for UK business networking — not generic ticketing. You get a permanent organiser profile, your events in a searchable directory members use to find networking meetings and exhibitions, optional business opportunity listings, team editors, attendee reviews, and One Seat Only Policy for application-based events. You receive the full ticket price you set; attendees pay one booking fee (4.5% + 20p per ticket) at checkout. Free events are supported without Stripe. Step-by-step organiser guides are on the guides page.',
  },
  {
    question: 'Can I list on The Networker Hub if I already use another event platform?',
    answer:
      'Yes — many organisers use the hub alongside other tools. There is no exclusivity requirement. List here to reach members who browse specifically for UK networking events, build your organiser profile on the hub, and optionally publish business opportunities. You can list the same events you run elsewhere.',
  },
  {
    question: 'How much does it cost to list an event as an organiser?',
    answer:
      'There is no monthly subscription to list events. Use the organiser dashboard at /organiser/ to publish free or paid events. For paid tickets, attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before payment), which covers platform and payment processing — you receive the full ticket price. Free events do not require Stripe. Email hello@the-networker.co.uk for onboarding help.',
  },
  {
    question: 'Why is my event not showing on the browse events page?',
    answer:
      'Public browse only shows events that are Published (not Draft), Approved, and linked to a published organiser profile. Complete tickets, refund policy, and publish in /organiser/. Email hello@the-networker.co.uk with the event title if it is still missing.',
  },
  {
    question: 'How can I advertise my business on The Networker Hub?',
    answer:
      'Paid Sponsor Hub placements are available on the events directory, organisers browse, and business opportunities — see /advertising.html for guide pricing. Email rosie@thenetworkerhub.com. You can also list events or business opportunities to reach the network organically.',
  },
  {
    question: 'How do organisers download attendee lists?',
    answer:
      'Sign in to /organiser/, open Events → Attendees, filter by event, and click Download attendees CSV.',
  },
  {
    question: 'When do organisers receive payouts for ticket sales?',
    answer:
      'Payouts are not instant. A 7-day settlement period applies after the event ends. Archive the event, then request a payout from the organiser dashboard when eligible. Stripe onboarding is required.',
  },
  {
    question: 'What fees does The Networker Hub charge on tickets?',
    answer:
      'Attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before payment), which covers platform and payment processing. Organisers receive the full ticket price.',
  },
  {
    question: 'Why did The Networker Hub start?',
    answer:
      'Co-founders Rosie and Catherine believe the right room at the right time changes careers and companies. They built one trusted UK platform for events, organiser profiles, and business opportunities.',
  },
];

module.exports = {
  FAQ_AEO_ENTRIES,
};
