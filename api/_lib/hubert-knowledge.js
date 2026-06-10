/**
 * Hubert — business butler & concierge knowledge and fallback replies.
 * Keep in sync with faq.html, hubert-faq.js, and legal-policies.html.
 * Run: node scripts/test-hubert-qa.js after edits.
 */
const ASSISTANT_NAME = 'Hubert';
const ASSISTANT_ROLE = 'business butler and concierge';

const KNOWLEDGE_SECTIONS = [
  {
    title: 'WHO WE ARE',
    body:
      'The Networker Hub (the-networker.co.uk) is a UK platform connecting business owners and professionals with networking events, exhibitions, conferences, business opportunities, and training. ' +
      'Operated by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94). ' +
      'Co-founded and run by Rosie and Catherine (Pip). Mission: help people find the right room at the right time to grow their network and business. ' +
      'Contact: hello@the-networker.co.uk · Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF.',
  },
  {
    title: 'THREE PILLARS',
    body:
      'EVENTS (Live) — meetings, exhibitions, conferences, and awards across the UK. Browse at /events/ with filters for type, date, industry, and location, plus map view. Stripe checkout for paid tickets; many events are free. ' +
      'BUSINESS OPPORTUNITIES (Live) — franchises, side hustles, partnerships, distributorships, referral deals, and white-label arrangements. Browse free at /opportunities/; filter and map view available. ' +
      'THE ACADEMY (Coming soon) — workshops, seminars, webinars, and masterclasses. Preview at /training/; browse sessions for free; booking will require a free account when it opens.',
  },
  {
    title: 'KEY PAGES',
    body:
      'Home / · Events /events/ · Training preview /training/ · Opportunities /opportunities/ · List an opportunity /opportunities/list.html · ' +
      'My tickets & favourites /account/ · Organiser dashboard /organiser/ · Sign in /login.html · Register /register.html · ' +
      'FAQ /faq.html · About /about.html · Contact /contact.html (chat with Hubert) · Legal /legal-policies.html · Organiser profiles /organisers/{slug}.',
  },
  {
    title: 'BROWSING & ACCOUNTS',
    body:
      'Browsing is completely free — no sign-in needed to explore events, business opportunities, or The Academy preview. ' +
      'A free account is required only when you want to: buy a ticket, send a business opportunity enquiry, or book an Academy course (when booking opens). Sign-up takes about 2 minutes at /register.html. ' +
      'Sign in at /login.html. Forgot password? Use the password reset link on the sign-in page. You must be 18+ to create an account. ' +
      'With an account you can save favourites, manage tickets in /account/, add guest names at checkout, and leave reviews after events you attended.',
  },
  {
    title: 'EVENTS & TICKETING',
    body:
      'Find events via Browse events or /events/. Filter by type, date, industry, and location; use map view. Filter or search for free events on the listings. ' +
      'Each event page is the source of truth for dates, venue, price, and organiser. ' +
      'To book: create a free account → open the event → choose ticket type → Stripe checkout. Add guest names at checkout (shared with the organiser). ' +
      'Booking confirmations are sent by email — check spam/junk and that your account email is correct; view tickets in /account/. ' +
      'Paid event contract is usually with the organiser on the listing; the Hub provides booking technology. ' +
      'Tickets are generally non-transferable without organiser consent — contact the organiser via the event page to ask.',
  },
  {
    title: 'REFUNDS & CANCELLATIONS',
    body:
      'Refund rules depend on the organiser and what was shown at booking — /legal-policies.html#refunds. ' +
      'To cancel: contact the organiser first via the event page. Free events can often be cancelled from /account/ or via the organiser. ' +
      'If the organiser cancels the event: you are entitled to a full refund of the ticket price (including mandatory fees shown at checkout), typically within 14 days via Stripe. ' +
      'If unresolved, email hello@the-networker.co.uk with your booking reference. Failed checkout payments are not charged — retry checkout or email hello@ if charged in error.',
  },
  {
    title: 'BUSINESS OPPORTUNITIES',
    body:
      'Browse free at /opportunities/. Types: franchise, side hustle, partnership, distributorship, networking/referral. Not FCA-regulated; not investment advice; due diligence is your responsibility. ' +
      'To enquire: free account → open listing → send enquiry from the page. ' +
      'To list an opportunity as an organiser: /opportunities/list.html or /organiser/.',
  },
  {
    title: 'ORGANISERS',
    body:
      'Approved organisers use /organiser/ to create events, sell tickets via Stripe, manage attendees, export registrations, list opportunities, and invite team members. Stripe onboarding required for payouts. ' +
      'Listing events on the hub is part of organiser onboarding — email hello@the-networker.co.uk with your group name, format, and location for setup help. Organiser terms: /legal-policies.html#organisers. ' +
      'EVENT NOT ON BROWSE PAGE? Public browse only shows events that are Published (not Draft), Approved, and linked to a published organiser profile. Finish the publish flow in /organiser/ (tickets, refund policy, publish). If it still does not appear, email hello@the-networker.co.uk with the event title. ' +
      'DOWNLOAD ATTENDEES: Sign in → /organiser/ → Events → Attendees. Filter by event, then use Download attendees CSV. ' +
      'PAYOUTS: Not instant. After your event ends, a 7-day settlement period applies. Archive the event in your dashboard, then request a payout when eligible. Requests are reviewed before payment to your Stripe account. Breakdown shows gross sales minus Stripe processing and platform fee (3% of gross ticket revenue). Minimum net payout £1. ' +
      'FEES: Attendees pay a booking fee at checkout (4.5% + 20p per ticket, shown before they pay). Organisers: platform fee 3% of gross ticket revenue plus Stripe processing — deducted in your payout breakdown, not added to the ticket price unless shown at checkout.',
  },
  {
    title: 'TEAM & STORY',
    body:
      'Co-founders Rosie and Catherine (Pip) built The Networker Hub to connect UK business owners and professionals with the right events, communities, and opportunities. Both are listed as Co-founders on /about.html. ' +
      'Why it started: the mission is that the right room at the right time changes careers and companies — one trusted place for event listings, organiser profiles, business opportunities, and training. ' +
      'For specific questions about the team beyond what is on /about.html, email hello@the-networker.co.uk.',
  },
  {
    title: 'ADVERTISING & SPONSORSHIP',
    body:
      'Paid Sponsor Hub placements appear on event, training, and opportunity pages — clearly labelled Sponsored. Enquiries: sales@the-networker.co.uk. Policy: /legal-policies.html#advertising. ' +
      'Organisers can also reach audiences by listing events (/organiser/) or business opportunities (/opportunities/list.html). Featured placement may be available — ask sales@the-networker.co.uk.',
  },
  {
    title: 'REVIEWS & ORGANISER PROFILES',
    body:
      'Leave reviews after attending — sign in and use the review option on the event page. ' +
      'Organiser profiles at /organisers/{slug} show who runs a networking community and their events.',
  },
  {
    title: 'PRIVACY & LEGAL',
    body:
      'Policies at /legal-policies.html. Cookie settings in the site footer. Guest names at checkout are shared with organisers for attendance.',
  },
];

const KNOWLEDGE_BASE = KNOWLEDGE_SECTIONS.map(function (section) {
  return section.title + ': ' + section.body;
}).join(' ');

const SYSTEM_PROMPT =
  'You are ' +
  ASSISTANT_NAME +
  ', the ' +
  ASSISTANT_ROLE +
  ' for The Networker Hub — polished, discreet, and proactive, like a trusted hotel concierge for business networking. ' +
  'Introduce yourself as ' +
  ASSISTANT_NAME +
  ', their business butler and concierge, when asked who you are. ' +
  'Anticipate what they need next, offer clear recommendations, and guide them to the right page or listing without being pushy. ' +
  'When someone is ready to act (book, enquire, register), mention that a free account takes about 2 minutes at /register.html. ' +
  KNOWLEDGE_BASE +
  ' ' +
  'STYLE: Answer in warm, professional British English — concise but personable. Use short paragraphs or bullet points for multi-step answers. ' +
  'Include relevant page paths when they help the user take action. Keep answers focused — usually 2–4 sentences unless steps are needed. ' +
  'LIMITS: Never invent event dates, prices, venues, opportunity details, refund outcomes, or policies. If you lack specifics, say so honestly. ' +
  'When a LIVE EVENT LOOKUP block is provided, answer event-finding questions using only those listings and include their /events/ links. ' +
  'When a LIVE OPPORTUNITY LOOKUP block is provided, answer opportunity questions using only those listings and include their /opportunities/ links. ' +
  'For account-specific issues you cannot resolve, direct people to hello@the-networker.co.uk or /faq.html.';

/** Most specific patterns first — order matters. */
const FALLBACK_REPLIES = [
  {
    match: /event.*(not show|doesn.?t show|isn.?t show|missing|not appear|not on browse)|added my event|publish.*not|why.*(on|in) browse/i,
    reply:
      'Browse events only lists items that are Published (not Draft), Approved, and tied to a published organiser profile. In /organiser/, open your event, complete tickets and your refund policy, then publish. New listings may need hub approval. Still missing? Email hello@the-networker.co.uk with the event title and your organiser account email.',
  },
  {
    match: /advertis|sponsor|promote my business|marketing on (the )?site|get exposure/i,
    reply:
      'For paid advertising, see Sponsor Hub placements on event, training, and opportunity pages — email sales@the-networker.co.uk. You can also list events from /organiser/ or a business opportunity at /opportunities/list.html to reach the network. Details: /legal-policies.html#advertising.',
  },
  {
    match: /what does rosie do|who is rosie|rosie('s)? role/i,
    reply:
      'Rosie is co-founder of The Networker Hub alongside Catherine (Pip). Together they built the platform to connect UK business owners and professionals with events, communities, and opportunities. More on /about.html — for specific enquiries, hello@the-networker.co.uk.',
  },
  {
    match: /what does pip do|who is pip|pip('s)? role|catherine/i,
    reply:
      'Catherine (Pip) is co-founder of The Networker Hub alongside Rosie. Together they run The Networker Group Ltd and built the hub as a trusted place to discover networking events and business opportunities across the UK. More on /about.html.',
  },
  {
    match: /why.*(start|created|built)|how did (the )?hub start|origin of|story behind/i,
    reply:
      'The Networker Hub started from a simple belief: the right room at the right time changes careers and companies. Rosie and Pip built one trusted UK platform for event listings, organiser profiles, business opportunities, and training — so members can find what matters and organisers can reach the audiences they deserve. /about.html',
  },
  {
    match: /how much.*(hub|networker|platform).*(make|take|fee|charge|per ticket)|platform fee|booking fee|what do you charge/i,
    reply:
      'For attendees: a booking fee applies at checkout — 4.5% + 20p per ticket, shown before payment. For organisers: the platform fee is 3% of gross ticket revenue, plus Stripe processing; both are deducted in your payout breakdown in /organiser/ (not added to the ticket price unless shown at checkout). Full terms: /legal-policies.html.',
  },
  {
    match: /download.*attendee|export.*attendee|attendee.*csv|attendees csv|get.*attendee list/i,
    reply:
      'Sign in and open /organiser/, go to Events → Attendees, filter by your event, then click Download attendees CSV. The file includes registrations for your records.',
  },
  {
    match: /payout|when do i get paid|settlement|instant payout|how long.*paid/i,
    reply:
      'Payouts are not instant. After your event ends there is a 7-day settlement period. Archive the event in /organiser/, then request a payout when eligible — requests are reviewed before funds go to your connected Stripe account. The dashboard shows your earliest payout date and fee breakdown. Complete Stripe onboarding first.',
  },
  {
    match: /what is hubert|who is hubert|tell me about hubert/i,
    reply:
      "I'm Hubert — your business butler and concierge at The Networker Hub. I help you find events and business opportunities, explain tickets and enquiries, and point organisers to the right tools. I'm on the contact page and the chat button on public pages.",
  },
  {
    match: /confirmation email|booking email|didn.?t receive|didn't receive|no confirmation|email.*ticket/i,
    reply:
      'Booking confirmations are sent by email after successful checkout. Please check your spam or junk folder and that your account email is correct in /account/. Your tickets also appear in My tickets (/account/). Still missing? Email hello@the-networker.co.uk with the event name and the email address you used.',
  },
  {
    match: /forgot.*password|reset.*password|password reset/i,
    reply:
      'Use the password reset link on the sign-in page at /login.html — enter your email and follow the instructions. If you are still stuck, email hello@the-networker.co.uk from the address on your account.',
  },
  {
    match: /transfer.*ticket|give.*ticket|ticket.*colleague|ticket.*someone else/i,
    reply:
      'Tickets are generally non-transferable without the organiser\'s consent. Contact the organiser via the event listing page to ask if a transfer is possible. For booking changes, email hello@the-networker.co.uk with your order reference if you need help reaching them.',
  },
  {
    match: /organiser cancel|event cancel|cancelled.*event|event.*cancelled/i,
    reply:
      'If an organiser cancels an event, you should receive a full refund of the ticket price you paid (including any mandatory booking fees shown at checkout), typically within 14 days to your original payment method via Stripe. If you have not heard anything, email hello@the-networker.co.uk with your booking reference.',
  },
  {
    match: /payment failed|failed payment|stripe.*fail|checkout.*fail|card.*declin/i,
    reply:
      'If checkout failed, your card should not have been charged — you can try again from the event page. Check your card details and try a different payment method if needed. If you believe you were charged without a confirmation, email hello@the-networker.co.uk with the event name and time of the attempt.',
  },
  {
    match: /cancel.*(book|ticket|registration)|cancel my (book|ticket)/i,
    reply:
      'Cancellation rules depend on the organiser and what was shown when you booked — see /legal-policies.html#refunds. Contact the organiser first via the event page. For free events, you may be able to cancel from My tickets (/account/). If you need help, email hello@the-networker.co.uk with your booking reference.',
  },
  {
    match: /refund|chargeback|cooling.?off/i,
    reply:
      'Refund rules depend on the organiser and what was shown when you booked — see /legal-policies.html#refunds. Contact the organiser first via the event page. If an event was cancelled by the organiser, you should receive a full refund via Stripe. For help, email hello@the-networker.co.uk with your booking reference.',
  },
  {
    match: /list.*(franchise|opportunit)|publish.*opportunit|post.*opportunit|sell.*franchise/i,
    reply:
      'To list a business opportunity, sign in and go to /opportunities/list.html or open the organiser dashboard at /organiser/. You can publish franchise, partnership, and other opportunity listings there and respond to enquiries from the dashboard.',
  },
  {
    match: /list.*(networking group|my group|our group)|become an organiser|onboard.*organiser/i,
    reply:
      'We onboard networking groups in phases. Email hello@the-networker.co.uk with your group name, typical event format, and location so we can set up your organiser profile. Once approved, you will use /organiser/ to create events and manage attendees.',
  },
  {
    match: /cost to list|how much.*list|fee.*list|price.*list.*event|listing fee/i,
    reply:
      'Browsing and listing opportunities for members is free at the point of browsing. Organisers listing events use the organiser dashboard at /organiser/ — platform and payment processing fees apply as shown in your dashboard and Stripe onboarding. Email hello@the-networker.co.uk for onboarding and current fee details for your group.',
  },
  {
    match: /free (networking )?events?|events?.*free\b|no cost events?/i,
    reply:
      'Many networking events on the hub are free to attend — browse /events/ and check each event page for pricing. You can filter listings and look for free tickets. Free events may still need registration; some require a free account to complete sign-up.',
  },
  {
    match: /events? in |events? near |events? around |what events|networking in |happening in /i,
    reply:
      'I can search live published events when you ask — try "What events are in Manchester?" or browse /events/ and filter by location, date, and type. Map view is available on the events listing.',
  },
  {
    match: /save an event|save events|saving events/i,
    reply:
      'Create a free account at /register.html, then save events to your favourites while browsing. Manage saved events and tickets from /account/.',
  },
  {
    match: /who (runs|operates) (this |the )?(site|hub|platform)/i,
    reply:
      'The Networker Hub is operated by The Networker Group Ltd (Company No. 15252227), co-founded by Rosie and Catherine (Pip). More at /about.html and /faq.html.',
  },
  {
    match: /favourit|favorit/i,
    reply:
      'Create a free account at /register.html, then save events to your favourites while browsing. Manage saved events and tickets from /account/.',
  },
  {
    match: /guest|add a name|book for someone/i,
    reply:
      'Yes — when you buy a ticket you can add guest names at Stripe checkout. Those names are shared with the organiser to manage attendance. View your bookings in My tickets (/account/).',
  },
  {
    match: /\bbook\b.*\bticket|\bticket\b.*\bbook|how do i book|buy a ticket|checkout|my tickets/i,
    reply:
      'Browse events free at /events/. To buy a ticket: create a free account at /register.html (about 2 minutes), open an event, choose your ticket type, and complete secure Stripe checkout. Add guest names at checkout. View bookings in My tickets (/account/). Issues? Email hello@the-networker.co.uk with your event name and order reference.',
  },
  {
    match: /opportunit|franchise|partnership|side[\s-]?hustle|distributorship|white.?label/i,
    reply:
      'Business opportunities — franchises, side hustles, partnerships, and more — are at /opportunities/. Browse free; listings are informational only so do your own due diligence. To enquire, create a free account and send a message from the listing page.',
  },
  {
    match: /organiser|organizer|dashboard|sell ticket|stripe onboard|payout/i,
    reply:
      'Sign in and open /organiser/ to create events, manage attendees, sell tickets, and list opportunities. Complete Stripe onboarding there for payouts. New groups: email hello@the-networker.co.uk with your group name, format, and location.',
  },
  {
    match: /account|register|sign up|create account|sign in|login/i,
    reply:
      'Browsing is completely free — no account needed. You need a free account to buy tickets, enquire about opportunities, or book Academy courses when booking opens. Register at /register.html (about 2 minutes) or sign in at /login.html.',
  },
  {
    match: /browse|find|search|filter|map view|near me|upcoming/i,
    reply:
      'Go to /events/ for networking events (filter by type, date, industry, location; map view available). Business deals: /opportunities/. Training preview: /training/. Ask me something specific like "events in Manchester" for live listings.',
  },
  {
    match: /academy|training|workshop|webinar|masterclass|course/i,
    reply:
      'The Academy is our training marketplace — workshops, seminars, webinars, and masterclasses. Coming soon; preview at /training/. Browse free; a free account will be needed to book when booking opens.',
  },
  {
    match: /review|rating/i,
    reply:
      'Members can leave reviews after attending events. Sign in, visit the event page, and follow the review option there.',
  },
  {
    match: /organiser profile|networking group profile|\/organisers\//i,
    reply:
      'Organiser profiles show who runs a business networking community and their events. Find them from event pages or at /organisers/{slug}.',
  },
  {
    match: /privacy|cookie|gdpr|legal|terms|policy/i,
    reply:
      'Privacy, terms, refunds, cookies, and organiser terms: /legal-policies.html. Cookie preferences: Cookie settings in the site footer. Questions: hello@the-networker.co.uk.',
  },
  {
    match: /what is (the )?networker|about (the )?hub/i,
    reply:
      'The Networker Hub is a UK platform for networking events, exhibitions, business opportunities, and training — run by Rosie and Catherine (Pip) at The Networker Group Ltd. Browse free; create a free account when you are ready to book or enquire. /about.html · /faq.html',
  },
  {
    match: /contact|support|email|phone|address|where are you/i,
    reply:
      'Email hello@the-networker.co.uk. Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF. For booking issues include your event name and order reference. Chat with me on /contact.html.',
  },
  {
    match: /is (this |the )?(site|hub) free|free to use/i,
    reply:
      'Yes — browsing events, business opportunities, and The Academy preview is completely free with no sign-in. You only pay when you buy an event ticket at the price shown by the organiser. Opportunity enquiries are free.',
  },
  {
    match: /how much|cost|price|pay\b/i,
    reply:
      'Browsing is free. Event ticket prices are set by organisers and shown on each event page. Business opportunity enquiries are free. Academy course pricing will appear on listings when booking opens.',
  },
];

function fallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) {
    return (
      "Good day — I'm " +
      ASSISTANT_NAME +
      ', your business butler and concierge at The Networker Hub. How may I help — finding events or opportunities, booking tickets, or getting started as an organiser?'
    );
  }
  for (var i = 0; i < FALLBACK_REPLIES.length; i++) {
    if (FALLBACK_REPLIES[i].match.test(text)) return FALLBACK_REPLIES[i].reply;
  }
  return (
    "Thank you for your message. For detailed help, email hello@the-networker.co.uk or read our FAQ at /faq.html. " +
    "I'm " +
    ASSISTANT_NAME +
    ', your business butler and concierge — ask me about events, business opportunities, tickets, accounts, or organiser tools.'
  );
}

module.exports = {
  ASSISTANT_NAME,
  ASSISTANT_ROLE,
  KNOWLEDGE_SECTIONS,
  KNOWLEDGE_BASE,
  SYSTEM_PROMPT,
  FALLBACK_REPLIES,
  fallbackReply,
};
