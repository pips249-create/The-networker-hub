/**
 * Hubert FAQ — single source for AEO/SEO schema, llms.txt, and page copy.
 * Keep aligned with faq.html and api/_lib/hubert-knowledge.js.
 *
 * category: general | buyers | organisers
 */
const FAQ_AEO_ENTRIES = [
  {
    question: 'What is The Networker UK?',
    answer:
      'The Networker UK is the platform chapter of The Networker — operated by The Networker Group Ltd (Company No. 15252227). Rosie McGilvray and Catherine Hancher run the Hub today. The original Networker directory was started by Rosie and Sue Turmel; Sue is no longer a company director. It is a UK hub for networking meetings, exhibitions, conferences, and business opportunities. Members browse and book; organisers list events and reach new audiences. Same brand as the-networker.co.uk.',
    category: 'general',
    icon: '🌐',
  },
  {
    question: 'How do I find events on The Networker UK?',
    answer:
      'Use Browse events in the top navigation or visit the events listing at /events/. You can filter by type, date, industry, and location, and use map view on supported pages.',
    category: 'general',
    icon: '🔍',
  },
  {
    question: 'Do I need an account to browse The Networker UK?',
    answer:
      'No — browsing is completely free. You can explore events and business opportunities without signing in. You only need a free account when you want to buy a ticket or enquire about a business opportunity. Sign-up takes about 2 minutes.',
    category: 'general',
    icon: '👤',
  },
  {
    question: 'How do I book a ticket on The Networker UK?',
    answer:
      'Create a free account first, then open an event from the listing page, choose your ticket type, and complete secure Stripe checkout. You can add guest names at checkout and view bookings in My account.',
    category: 'buyers',
    icon: '🎫',
  },
  {
    question: 'How do I enquire about a business opportunity?',
    answer:
      'Browse opportunities for free at /opportunities/. When you find one you are interested in, sign in or create a free account to send a direct enquiry to the lister from the opportunity page.',
    category: 'general',
    icon: '💼',
  },
  {
    question: 'How do organisers list an event on The Networker UK?',
    answer:
      'Sign in, claim your organiser page if prompted, then open the organiser dashboard at /organiser/ to create events and manage attendees. Your networking group may already be listed — search the organiser directory on /events/ and claim the page linked to your email. Email changed? Find your group and use Request access on its profile page.',
    category: 'organisers',
    icon: '📅',
  },
  {
    question: 'Where does event information on The Networker UK come from?',
    answer:
      'Listings are managed in the events database and updated by organisers and the Networker UK team. Dates, venues, and prices on each event page are the source of truth for that event.',
    category: 'general',
    icon: '📋',
  },
  {
    question: 'Who operates The Networker UK?',
    answer:
      'https://www.thenetworkeruk.com (The Networker UK) is operated only by The Networker Group Ltd, Companies House company number 15252227, VAT No. 454 4092 94. Rosie McGilvray and Catherine Hancher run the Hub. The Networker directory was started by Rosie and Sue Turmel; Sue Turmel is no longer a company director (Companies House). Official record: https://find-and-update.company-information.service.gov.uk/company/15252227. Same brand as the-networker.co.uk. Privacy, terms, and organiser terms: https://www.thenetworkeruk.com/legal-policies — not the similarly named NETWORKER UK LIMITED.',
    category: 'general',
    icon: '🏢',
  },
  {
    question: 'Do organisers need to share their members list to list on The Networker UK?',
    answer:
      'No. A free organiser page and event listing only need public group details such as name, logo, meeting dates, venue, description, and a business contact email. You do not need to upload your members’ contact database to advertise meetings. Attendee details are shared with you only when someone books or applies via the Hub.',
    category: 'organisers',
    icon: '📇',
  },
  {
    question: 'Is The Networker Group Ltd a new company?',
    answer:
      'The Networker Group Ltd was incorporated in November 2023 (Companies House 15252227). Like many early-stage UK limited companies, its published micro-entity accounts can show modest assets and negative shareholders’ funds while the platform is being built — that is not evidence of a scam. The Networker brand and directory (the-networker.co.uk) pre-date the Hub rebuild. Ticket payments for events are processed via Stripe for the organiser; they are not held as the Hub company’s trading cash. Always check the latest filings on Companies House.',
    category: 'general',
    icon: '🏛️',
  },
  {
    question: 'Who is Hubert on The Networker UK?',
    answer:
      'Hubert is the British English gentleman and concierge on The Networker UK. He is at your service for events, business opportunities, tickets, enquiries, and organiser tools. Chat with Hubert on the contact page or via the floating assistant on public pages.',
    category: 'general',
    icon: '✨',
  },
  {
    question: 'Is The Networker UK free to use?',
    answer:
      'Yes — browsing events and business opportunities is completely free with no sign-in required. You only pay when you purchase an event ticket at the price shown by the organiser.',
    category: 'general',
    icon: '✅',
  },
  {
    question: 'I forgot my password — how do I sign in?',
    answer:
      'Go to /login and use the password reset link. Enter your email and follow the instructions. If you are still stuck, email hello@thenetworkeruk.com from the address on your account.',
    category: 'general',
    icon: '🔑',
  },
  {
    question: 'I did not receive my booking confirmation email',
    answer:
      'Check your spam or junk folder and confirm your account email is correct. Your tickets also appear in My account at /account/. If you still cannot find your booking, email hello@thenetworkeruk.com with the event name and email address used at checkout.',
    category: 'buyers',
    icon: '📧',
  },
  {
    question: 'Can I transfer my ticket to someone else?',
    answer:
      'Tickets are generally non-transferable without the organiser\'s consent. Contact the organiser via the event listing page to ask. For help, email hello@thenetworkeruk.com with your order reference.',
    category: 'buyers',
    icon: '🎟️',
  },
  {
    question: 'What happens if an organiser cancels an event?',
    answer:
      'If an organiser cancels, you should receive a full refund of the ticket price paid, including mandatory booking fees shown at checkout, typically within 14 days via Stripe to your original payment method.',
    category: 'buyers',
    icon: '💸',
  },
  {
    question: 'Are there free networking events?',
    answer:
      'Yes — many events on The Networker UK are free to attend. Browse /events/ and check each event page for pricing. Some free events still require registration or a free account to complete sign-up.',
    category: 'buyers',
    icon: '🎉',
  },
  {
    question: 'Who owns my group logo and photos on The Networker UK?',
    answer:
      'You keep ownership of your group name, logo, photos, and copy. By publishing a profile or listing you give The Networker Group Ltd a licence to display that content on the Hub so people can find you. While your page is public we may also show your group name and logo in Hub marketing that promotes the directory (for example founding-organiser strips or social round-ups of listed groups). We do not sell your logo as a standalone asset. Email hello@thenetworkeruk.com to ask us to stop featuring your logo in new Hub marketing. Full detail: /legal-policies#organisers',
    category: 'organisers',
    icon: '🖼️',
  },
  {
    question: 'Does The Networker UK sell organiser or member data to third parties?',
    answer:
      'No. We do not sell organiser or member contact lists to third parties for their own marketing. We use processors such as Stripe, Supabase, Resend and Vercel to run the platform, listed in our Privacy policy. When someone books your event we share the minimum attendee details you need to run it — you must not use that for unrelated marketing without their consent. See /legal-policies#privacy and /legal-policies#organisers',
    category: 'organisers',
    icon: '🔒',
  },
  {
    question: 'Will my free organiser listing become a paid featured listing?',
    answer:
      'No. Standard organiser pages and event listings are free to publish. Featured or premium placements and advertising packages are optional and only apply if you choose and pay for them — never automatically. See /advertising and /legal-policies#organisers',
    category: 'organisers',
    icon: '🆓',
  },
  {
    question: 'What happens if I remove my group from The Networker UK?',
    answer:
      'You can unpublish events and ask us to unpublish your organiser page from the public directory (via your dashboard where available, or hello@thenetworkeruk.com). Once unpublished, your page and events are no longer shown on public browse. We may retain account, booking and payment records where the law or disputes require it. Attendee data you already downloaded remains your responsibility to delete when no longer needed. See /legal-policies#organisers',
    category: 'organisers',
    icon: '🚪',
  },
  {
    question: 'Why should I list my networking group on The Networker UK?',
    answer:
      'The Networker UK is built for UK business networking — not generic ticketing. You get a permanent organiser profile, your events in a searchable directory members use to find networking meetings and exhibitions, optional business opportunity listings, team editors, and attendee reviews. Networking-specific tools include Free trial visits (1–3 free visits before paid member tickets), visit tracking on your attendee list (1st visit vs returning, with filters and CSV export), Category Exclusivity for application-based events, and Previous Attendees to invite past attendees to exclusive returning rates on repeat events. You receive the full ticket price you set; attendees pay one booking fee (4.5% + 20p per ticket) at checkout. Free events are supported without Stripe. Step-by-step organiser guides are on the guides page.',
    category: 'organisers',
    icon: '⭐',
  },
  {
    question: 'Can I list on The Networker UK if I already use another event platform?',
    answer:
      'Yes — many organisers use The Networker UK alongside other tools. There is no exclusivity requirement. List here to reach members who browse specifically for UK networking events, build your organiser profile here, and optionally publish business opportunities. You can list the same events you run elsewhere.',
    category: 'organisers',
    icon: '🔄',
  },
  {
    question: 'How much does it cost to list an event as an organiser?',
    answer:
      'There is no monthly subscription to list events. Use the organiser dashboard at /organiser/ to publish free or paid events. For paid tickets, attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before payment), which covers platform and payment processing — you receive the full ticket price. Free events do not require Stripe. Email hello@thenetworkeruk.com for onboarding help.',
    category: 'organisers',
    icon: '💷',
  },
  {
    question: 'Why is my event not showing on the browse events page?',
    answer:
      'Public browse only shows events that are Published (not Draft), Approved, and linked to a published organiser profile. Complete tickets, refund policy, and publish in /organiser/. Email hello@thenetworkeruk.com with the event title if it is still missing.',
    category: 'organisers',
    icon: '👁️',
  },
  {
    question: 'How can I advertise my business on The Networker UK?',
    answer:
      'Paid hero sponsor placements are available on the events directory, organisers browse, and business opportunities — labelled Powered by on browse pages — see /advertising for guide pricing. Email rosie@thenetworkeruk.com. You can also list events or business opportunities to reach the network organically.',
    category: 'organisers',
    icon: '📣',
  },
  {
    question: 'How do organisers download attendee lists?',
    answer:
      'Sign in to /organiser/, open Events → Attendees. See each person\'s visit count (1st visit, 2 visits, etc.), filter by new or returning, filter by event, and click Download attendees CSV. Export printable name badges (PDF, standard A4 sticker sheets) from the same screen — badges use each guest\'s name, company, and job title from their account when set.',
    category: 'organisers',
    icon: '📊',
  },
  {
    question: 'What are free trial visits?',
    answer:
      'On Set up tickets, choose General ticketing or Application based, then pick how people book. Turn on Free trial visits (1–3 per visitor). After visits, people join monthly/annual membership or buy a ticket. For groups with no event ticket, pick Free visits, then membership. Closed meeting (member list only, no visits) is available under General when membership is on.',
    category: 'organisers',
    icon: '🎫',
  },
  {
    question: 'What is Category Exclusivity?',
    answer:
      'Application based (also called Category Exclusivity): prospective attendees apply with industry and job title; you approve or decline from your organiser dashboard. You can charge a ticket after approval, or use free trial visits then monthly membership with no event ticket. People already on your membership list can book without applying when you enable list-member booking.',
    category: 'organisers',
    icon: '🪑',
  },
  {
    question: 'Can I save business opportunities on The Networker UK?',
    answer:
      'Yes — sign in and tap the heart on any opportunity listing. Saved opportunities appear in My account (/account/). You can get an email when a saved listing is closing soon, save search alerts for new matching listings, and compare up to 3 saved opportunities side by side.',
    category: 'buyers',
    icon: '💼',
  },
  {
    question: 'When do organisers receive payouts for ticket sales?',
    answer:
      'Payouts are not instant. A 7-day settlement period applies after the event ends. Archive the event, then request a payout from the organiser dashboard when eligible. Stripe onboarding is required.',
    category: 'organisers',
    icon: '💰',
    helpLink: '/help/organiser-payouts',
  },
  {
    question: 'What fees does The Networker UK charge on tickets?',
    answer:
      'Attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before payment), which covers platform and payment processing. Organisers receive the full ticket price.',
    category: 'organisers',
    icon: '💳',
    helpLink: '/help/pricing-fees',
  },
  {
    question: 'Why did The Networker UK start?',
    answer:
      'Rosie McGilvray and Sue Turmel started The Networker directory because UK networking was scattered across the web. With Catherine Hancher, the brand grew into The Networker UK Hub — one trusted platform for events, organiser profiles, and business opportunities. Rosie and Catherine run the Hub today.',
    category: 'general',
    icon: '💡',
  },
];

const FAQ_CATEGORIES = {
  general: {
    id: 'general',
    label: 'General & Accounts',
    lede: 'Hubert, passwords, browsing, and what The Networker UK is.',
  },
  buyers: {
    id: 'buyers',
    label: 'For Ticket Buyers',
    lede: 'Refunds, transfers, booking issues, and confirmations.',
  },
  organisers: {
    id: 'organisers',
    label: 'For Organisers',
    lede: 'Payouts, attendee lists, advertising, and fees.',
  },
};

module.exports = {
  FAQ_AEO_ENTRIES,
  FAQ_CATEGORIES,
};
