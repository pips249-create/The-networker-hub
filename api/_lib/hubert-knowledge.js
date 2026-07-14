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
      'The Networker Hub (www.thenetworkerhub.com; formerly the-networker.co.uk) is a UK platform connecting business owners and professionals with networking events, exhibitions, conferences, and business opportunities. ' +
      'Operated by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94). ' +
      'Co-founded and run by Rosie and Catherine. Mission: help people find the right room at the right time to grow their network and business. ' +
      'Contact: hello@thenetworkerhub.com · Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF.',
  },
  {
    title: 'TWO PILLARS',
    body:
      'EVENTS (Live) — meetings, webinars, workshops, exhibitions, conferences, and awards across the UK. Browse at /events/ with filters for type, date, industry, and location, plus map view. Stripe checkout for paid tickets; many events are free. ' +
      'BUSINESS OPPORTUNITIES (Live) — franchises, side hustles, partnerships, distributorships, referral deals, and white-label arrangements. Browse free at /opportunities/; filter and map view available.',
  },
  {
    title: 'KEY PAGES',
    body:
      'Home / · Events /events/ · Opportunities /opportunities/ · List an opportunity /opportunities/list · ' +
      'My tickets & favourites /account/ · Organiser dashboard /organiser/ · Sign in /login · Register /register · ' +
      'FAQ /faq · About /about · Contact /contact (chat with Hubert) · Legal /legal-policies · Organiser profiles /organisers/{slug}.',
  },
  {
    title: 'BROWSING & ACCOUNTS',
    body:
      'Browsing is completely free — no sign-in needed to explore events and business opportunities. ' +
      'A free account is required only when you want to: buy a ticket or send a business opportunity enquiry. Sign-up takes about 2 minutes at /register. ' +
      'Sign in at /login. Forgot password? Use the password reset link on the sign-in page. You must be 18+ to create an account. ' +
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
      'Refund rules depend on the organiser and what was shown at booking — /legal-policies#refunds. ' +
      'To cancel: contact the organiser first via the event page. Free events can often be cancelled from /account/ or via the organiser. ' +
      'If the organiser cancels the event: you are entitled to a full refund of the ticket price (including mandatory fees shown at checkout), typically within 14 days via Stripe. ' +
      'If unresolved, email hello@thenetworkerhub.com with your booking reference. Failed checkout payments are not charged — retry checkout or email hello@ if charged in error.',
  },
  {
    title: 'BUSINESS OPPORTUNITIES',
    body:
      'Browse free at /opportunities/. Types: franchise, side hustle, partnership, distributorship, networking/referral. Not FCA-regulated; not investment advice; due diligence is your responsibility. ' +
      'To enquire: free account → open listing → send enquiry from the page. ' +
      'To list an opportunity as an organiser: /opportunities/list or /organiser/.',
  },
  {
    title: 'ORGANISERS',
    body:
      'Approved organisers use /organiser/ to create events, sell tickets via Stripe, manage attendees, export registrations, list opportunities, and invite team members. Stripe onboarding required for payouts. ' +
      'Listing events on the hub is part of organiser onboarding — email hello@thenetworkerhub.com with your group name, format, and location for setup help. Organiser terms: /legal-policies#organisers. ' +
      'EVENT NOT ON BROWSE PAGE? Public browse only shows events that are Published (not Draft), Approved, and linked to a published organiser profile. Finish the publish flow in /organiser/ (tickets, refund policy, publish). If it still does not appear, email hello@thenetworkerhub.com with the event title. ' +
      'DOWNLOAD ATTENDEES: Sign in → /organiser/ → Events → Attendees. Filter by event, then use Download attendees CSV. ' +
      'PAYOUTS: With Stripe Connect, you receive the full ticket price in your connected account when attendees pay. Legacy manual payouts (if Connect is off) pay out your gross ticket sales after the event is archived and a 7-day settlement period. Minimum payout £1. ' +
      'FEES: Attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before they pay). This covers platform and payment processing — organisers receive the full ticket price, with no separate platform or Stripe deductions.',
  },
  {
    title: 'ORGANISER EVENT LISTING',
    body:
      'Creating a listing: /organiser/ → create event → choose group and format (in person or online) → event-edit.html for title, type, description, photo, venue or join link, and dates → event-tickets.html for tiers, VAT, refund policy, publish. ' +
      'EVENT TYPE (Meeting, Events, Exhibition, Awards, Webinar, Workshop, Session): this is a browse filter, not whether something counts as an event. Meeting covers breakfasts, netwalking, women-only sessions, and most regular networking. Events is for larger one-offs (seminars, lunch & learns). Exhibition and Awards are for trade shows and ceremonies. Webinar, Workshop and Session help people find online talks, hands-on training, and shorter focused sessions. ' +
      'MULTI-DATE SERIES: click multiple days on the calendar — the same start time, end time, and venue (or online link) apply to every date. Ideal for a recurring meeting on different weeks. To remove a date, click the highlighted day again on the calendar. ' +
      'SAME TITLE, DIFFERENT TIME OR LOCATION: create separate listings — one per session — from My Events. You can reuse the same title; each listing gets its own dates, times, and venue. ' +
      'COVER PHOTO: upload, drag-and-drop, paste (Ctrl+V), or paste a URL. Files over 2MB are compressed automatically; if that fails, resize the file or use a hosted URL. For a sharp listing card, aim for at least 800px on the longest side (400px on the shortest). Use Remove to clear a photo and upload again.',
  },
  {
    title: 'ORGANISER TICKETS & ATTENDEES',
    body:
      'TICKET SETUP (event-tickets.html): choose Standard ticket types for open booking, or Category Exclusivity for application-based attendance. With open booking you can optionally enable the guest visit programme alongside your paid ticket types — newcomers use their 1–2 complimentary visits first, then paid member tickets unlock. Alumni Fast-Pass can also be enabled on open-booking events to invite past attendees to an exclusive alumni ticket rate. ' +
      'CATEGORY EXCLUSIVITY: prospective attendees apply to join instead of buying straight away. They answer two fixed questions — their industry and job title. You approve or deny each application from your organiser dashboard; approved applicants receive a payment link to complete booking. Set an optional price (leave at £0 for free), places limit, and application closing date. ' +
      'APPLICATION QUESTIONS: under Category Exclusivity, the two questions (industry and job title) are fixed and cannot be changed. For standard open tickets, you can optionally tick boxes under Attendee information at booking to note food is included or to collect dietary or accessibility requirements at checkout. ' +
      'VIEW REGISTRATIONS: sign in → /organiser/ → Events → Attendees. Filter by event or by new vs returning. Each row shows visit count (1st visit, 2 visits, etc.) based on Hub bookings with your organiser page. Download attendees CSV to export. This shows ticket registrations — not on-the-day check-in.',
  },
  {
    title: 'ORGANISER GUIDES',
    body:
      'Organiser step-by-step guides live at /guides — list an event (/guides/list-an-event), list a conference or exhibition (/guides/list-a-conference-or-exhibition), list a business opportunity (/guides/list-a-business-opportunity), invite team editors (/guides/invite-your-team). Attendees should use the FAQ or Hubert chat instead.',
  },
  {
    title: 'ORGANISER TEAM & EDITORS',
    body:
      'Team invites live under /organiser/ → Team & invites. Only the account owner can invite or remove editors (up to 10 editors per organiser account). ' +
      'INVITE FLOW: owner enters colleague email → invite email is sent → colleague signs in with that exact email → they become Active and see the same networking groups and events on that account. ' +
      'EDITOR ACCESS: view all groups on the account; create and edit events, tickets, and attendees; view revenue and reviews; reply publicly to attendee reviews; manage business opportunities. ' +
      'EDITORS CANNOT: invite or remove team members; delete events (cancel instead if needed). Access is account-wide — not limited to one group. ' +
      'If someone already runs their own organiser account with claimed groups, their own workspace takes priority over an editor invite.',
  },
  {
    title: 'TEAM & STORY',
    body:
      'Co-founders Rosie and Catherine built The Networker Hub to connect UK business owners and professionals with the right events, communities, and opportunities. Both are listed as Co-founders on /about. ' +
      'Why it started: the mission is that the right room at the right time changes careers and companies — one trusted place for event listings, organiser profiles, and business opportunities. ' +
      'For specific questions about the team beyond what is on /about, email hello@thenetworkerhub.com.',
  },
  {
    title: 'ADVERTISING & SPONSORSHIP',
    body:
      'Paid Sponsor Hub placements appear on event and opportunity pages — clearly labelled Sponsored. Rate card at /advertising (events main sponsor £2,000/mo, mini sponsors £600/slot ×3, featured events £55/mo; organisers main sponsor £1,000/mo, mini £300/slot ×3, featured profiles £27.50/mo; opportunities main sponsor £2,000/mo, mini £600/slot ×3, listings £25/mo + VAT, premium £55/mo). Enquiries: rosie@thenetworkerhub.com. Policy: /legal-policies#advertising. ' +
      'Organisers can also reach audiences by listing events (/organiser/) or business opportunities (/opportunities/list). Featured placement may be available — ask rosie@thenetworkerhub.com.',
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
      'Policies at /legal-policies. Cookie settings in the site footer. Guest names at checkout are shared with organisers for attendance.',
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
  'When someone is ready to act (book, enquire, register), mention that a free account takes about 2 minutes at /register. ' +
  KNOWLEDGE_BASE +
  ' ' +
  'STYLE: Answer in warm, professional British English — concise but personable. Use short paragraphs or bullet points for multi-step answers. ' +
  'Lead with a direct answer to the exact question (for example, Yes or No when appropriate), then explain what to do. ' +
  'Include relevant page paths when they help the user take action. Keep answers focused — usually 2–4 sentences unless steps are needed. ' +
  'LIMITS: Never invent event dates, prices, venues, opportunity details, refund outcomes, or policies. If you lack specifics, say so honestly. ' +
  'When a LIVE EVENT LOOKUP block is provided, answer event-finding questions using only those listings and include their /events/ links. ' +
  'When a LIVE OPPORTUNITY LOOKUP block is provided, answer opportunity questions using only those listings and include their /opportunities/ links. ' +
  'For account-specific issues you cannot resolve, direct people to hello@thenetworkerhub.com or /faq.';

/** Most specific patterns first — order matters. */
const FALLBACK_REPLIES = [
  {
    match: /event.*(not show|doesn.?t show|isn.?t show|missing|not appear|not on browse)|added my event|publish.*not|why.*(on|in) browse/i,
    reply:
      'Browse events only lists items that are Published (not Draft), Approved, and tied to a published organiser profile. In /organiser/, open your event, complete tickets and your refund policy, then publish. New listings may need hub approval. Still missing? Email hello@thenetworkerhub.com with the event title and your organiser account email.',
  },
  {
    match: /advertis|sponsor|promote my business|marketing on (the )?site|get exposure/i,
    reply:
      'For paid advertising, see /advertising — events main sponsor £2,000/mo, mini sponsors £600/slot (max 3), featured events £55/mo; organisers directory main sponsor £1,000/mo, mini £300/slot (max 3), featured profiles £27.50/mo; opportunities main sponsor £2,000/mo, mini £600/slot (max 3), listings £25/mo + VAT, premium £55/mo. Email rosie@thenetworkerhub.com. You can also list events from /organiser/ or a business opportunity at /opportunities/list. Policy: /legal-policies#advertising.',
  },
  {
    match: /what does rosie do|who is rosie|rosie('s)? role/i,
    reply:
      'Rosie is co-founder of The Networker Hub alongside Catherine. Together they built the platform to connect UK business owners and professionals with events, communities, and opportunities. More on /about — for specific enquiries, hello@thenetworkerhub.com.',
  },
  {
    match: /who is catherine|catherine.*co-founder|what does catherine do/i,
    reply:
      'Catherine is co-founder of The Networker Hub alongside Rosie. Together they run The Networker Group Ltd and built the hub as a trusted place to discover networking events and business opportunities across the UK. More on /about.',
  },
  {
    match: /why.*(start|created|built)|how did (the )?hub start|origin of|story behind/i,
    reply:
      'The Networker Hub started from a simple belief: the right room at the right time changes careers and companies. Rosie and Catherine built one trusted UK platform for event listings, organiser profiles, and business opportunities — so members can find what matters and organisers can reach the audiences they deserve. /about',
  },
  {
    match: /how much.*(hub|networker|platform).*(make|take|fee|charge|per ticket)|platform fee|booking fee|what do you charge/i,
    reply:
      'Attendees pay one booking fee at checkout — 4.5% + 20p per ticket, shown before payment. This single fee covers platform and payment processing. Organisers receive the full ticket price (no separate platform or Stripe deductions). Full terms: /legal-policies.',
  },
  {
    match: /download.*attendee|export.*attendee|attendee.*csv|attendees csv|get.*attendee list/i,
    reply:
      'Sign in and open /organiser/, go to Events → Attendees, filter by your event, then click Download attendees CSV. The file includes name, email, ticket type, and booking date for each registration.',
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
      'Booking confirmations are sent by email after successful checkout. Please check your spam or junk folder and that your account email is correct in /account/. Your tickets also appear in My tickets (/account/). Still missing? Email hello@thenetworkerhub.com with the event name and the email address you used.',
  },
  {
    match: /forgot.*password|reset.*password|password reset/i,
    reply:
      'Use the password reset link on the sign-in page at /login — enter your email and follow the instructions. If you are still stuck, email hello@thenetworkerhub.com from the address on your account.',
  },
  {
    match: /transfer.*ticket|give.*ticket|ticket.*colleague|ticket.*someone else/i,
    reply:
      'Tickets are generally non-transferable without the organiser\'s consent. Contact the organiser via the event listing page to ask if a transfer is possible. For booking changes, email hello@thenetworkerhub.com with your order reference if you need help reaching them.',
  },
  {
    match: /organiser cancel|event cancel|cancelled.*event|event.*cancelled/i,
    reply:
      'If an organiser cancels an event, you should receive a full refund of the ticket price you paid (including any mandatory booking fees shown at checkout), typically within 14 days to your original payment method via Stripe. If you have not heard anything, email hello@thenetworkerhub.com with your booking reference.',
  },
  {
    match: /payment failed|failed payment|stripe.*fail|checkout.*fail|card.*declin/i,
    reply:
      'If checkout failed, your card should not have been charged — you can try again from the event page. Check your card details and try a different payment method if needed. If you believe you were charged without a confirmation, email hello@thenetworkerhub.com with the event name and time of the attempt.',
  },
  {
    match: /cancel.*(book|ticket|registration)|cancel my (book|ticket)/i,
    reply:
      'Cancellation rules depend on the organiser and what was shown when you booked — see /legal-policies#refunds. Contact the organiser first via the event page. For free events, you may be able to cancel from My tickets (/account/). If you need help, email hello@thenetworkerhub.com with your booking reference.',
  },
  {
    match: /refund|chargeback|cooling.?off/i,
    reply:
      'Refund rules depend on the organiser and what was shown when you booked — see /legal-policies#refunds. Contact the organiser first via the event page. If an event was cancelled by the organiser, you should receive a full refund via Stripe. For help, email hello@thenetworkerhub.com with your booking reference.',
  },
  {
    match: /list.*(franchise|opportunit)|publish.*opportunit|post.*opportunit|sell.*franchise/i,
    reply:
      'To list a business opportunity, sign in and go to /opportunities/list or open the organiser dashboard at /organiser/. You can publish franchise, partnership, and other opportunity listings there and respond to enquiries from the dashboard.',
  },
  {
    match: /why (list|use|choose).*(hub|networker)|why should i list|benefits of listing/i,
    reply:
      'The Networker Hub is built for UK business networking. You get a permanent organiser profile, events in a directory members use to find networking meetings, optional business opportunity listings, team editors, and reviews. Networking-specific tools include the guest visit programme (1–2 complimentary trial visits before paid member tickets), visit tracking on your attendee list (1st visit vs returning, with filters and CSV export), Category Exclusivity for application-based events, and Alumni Fast-Pass to invite past attendees to exclusive alumni rates on repeat events. You receive the full ticket price; attendees pay one booking fee (4.5% + 20p per ticket) at checkout. Free events need no Stripe. Guides: /guides · Organisers: /for-organisers',
  },
  {
    match: /(paid|member).*(ticket|tier).*(guest visit|complimentary visit|guest programme)|(guest visit|complimentary visit|guest programme).*(paid|member).*(ticket|tier)/i,
    reply:
      'Yes — choose Guest visit programme on the tickets step, then add your paid member ticket type(s) underneath. New attendees use the complimentary visit allowance set on your organiser page first; once they have used it, the paid member tickets unlock. Guest visit programme and standard open booking are separate modes, but paid member tiers belong inside the guest programme.',
  },
  {
    match: /\bvat\b|value added tax/i,
    reply:
      'Choose the VAT option that matches how you advertise the ticket price: VAT included means the displayed price is the attendee’s ticket price; VAT added at checkout means it is added on top. You must select one before publishing, and the organiser remains responsible for its own VAT position—check with your accountant if you are unsure.',
  },
  {
    match: /already use|eventbrite|meetup|other platform|alongside|as well as|in addition to/i,
    reply:
      'Yes — you can list on The Networker Hub alongside other event platforms. There is no exclusivity requirement. Many organisers use the hub to reach members browsing specifically for UK networking events and to build their organiser profile here. List the same events you run elsewhere if you like.',
  },
  {
    match: /list.*(networking group|my group|our group)|become an organiser|onboard.*organiser/i,
    reply:
      'We onboard networking groups in phases. Email hello@thenetworkerhub.com with your group name, typical event format, and location so we can set up your organiser profile. Once approved, you will use /organiser/ to create events and manage attendees.',
  },
  {
    match: /cost to list|how much.*list|fee.*list|price.*list.*event|listing fee/i,
    reply:
      'There is no monthly subscription to list events. Use /organiser/ to publish free or paid events. For paid tickets, attendees pay one booking fee at checkout (4.5% + 20p per ticket) — you receive the full ticket price. Free events do not require Stripe. Email hello@thenetworkerhub.com for onboarding help.',
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
      'Create a free account at /register, then save events to your favourites while browsing. Manage saved events and tickets from /account/.',
  },
  {
    match: /who (runs|operates) (this |the )?(site|hub|platform)/i,
    reply:
      'The Networker Hub is operated by The Networker Group Ltd (Company No. 15252227), co-founded by Rosie and Catherine. More at /about and /faq.',
  },
  {
    match: /favourit|favorit/i,
    reply:
      'Create a free account at /register, then save events to your favourites while browsing. Manage saved events and tickets from /account/.',
  },
  {
    match: /guest|add a name|book for someone/i,
    reply:
      'Yes — when you buy a ticket you can add guest names at Stripe checkout. Those names are shared with the organiser to manage attendance. View your bookings in My tickets (/account/).',
  },
  {
    match: /\bbook\b.*\bticket|\bticket\b.*\bbook|how do i book|buy a ticket|checkout|my tickets/i,
    reply:
      'Browse events free at /events/. To buy a ticket: create a free account at /register (about 2 minutes), open an event, choose your ticket type, and complete secure Stripe checkout. Add guest names at checkout. View bookings in My tickets (/account/). Issues? Email hello@thenetworkerhub.com with your event name and order reference.',
  },
  {
    match: /opportunit|franchise|partnership|side[\s-]?hustle|distributorship|white.?label/i,
    reply:
      'Business opportunities — franchises, side hustles, partnerships, and more — are at /opportunities/. Browse free; listings are informational only so do your own due diligence. To enquire, create a free account and send a message from the listing page.',
  },
  {
    match: /after choosing.*format|what do i fill in|fill in after|what happens next|after event format/i,
    reply:
      'After choosing your group and format (in person or online), you go to the listing details page: event title, event type, description, cover photo, venue or join link, and dates on the calendar. Save as draft anytime, then continue to tickets for pricing, VAT, refund policy, and publish.',
  },
  {
    match: /event description|write.*description|description tips|what should i write/i,
    reply:
      'Include who the event is for, what happens on the day, and useful keywords people search for — location, industry, format, and who should come. Attendees filter listings using this text, so be specific rather than generic. You can also copy from your organiser page using the button on the form.',
  },
  {
    match: /difference.*(event|meeting)|meeting vs|event vs|what.*(event type|type of event)|meeting or event/i,
    reply:
      'Every listing is an event — the Event type dropdown is a browse filter. Meeting covers breakfasts, netwalking, women-only sessions, and most regular networking. Events is for larger one-offs such as seminars or lunch & learns. Exhibition and Awards are for trade shows and ceremonies. Webinar, Workshop and Session help people find online talks, hands-on training, and shorter focused sessions. Pick the type that best matches how people will search for it on /events/.',
  },
  {
    match: /image.*(too small|blurry|low.?res|pixelat)|photo.*(too small|blurry|low.?res)|cover.*(too small|blurry)|logo.*too small/i,
    reply:
      'Use a higher-resolution photo so it stays sharp on the listing card — aim for at least 800px on the longest side and 400px on the shortest. Re-export from your original file, or paste a URL to a larger hosted image in the URL field below the upload zone. Click Remove on the preview, then upload the new file.',
  },
  {
    match: /image.*(too (big|large)|won.?t upload)|photo.*(too (big|large)|won.?t upload)|cover.*too (big|large)|file.*too large|could not compress/i,
    reply:
      'Files over 2MB are compressed automatically when you upload. If that fails, resize the image on your computer first, or paste a hosted image URL in the URL field instead. PNG and JPG work best. You can also drag-and-drop or paste (Ctrl+V) a smaller file into the upload zone.',
  },
  {
    match: /remove.*(date|day)|delete.*(date|day)|get rid of.*(date|day)|accident.*(date|day)|extra date|wrong date|deselect.*(date|day)/i,
    reply:
      'Click the highlighted date again on the calendar to deselect it — selected days show as highlighted and appear in the date list below. You need at least one date to continue to tickets. If you already saved and need to drop a date from a published series, open the listing from My Events — if ticket sales are locked, email hello@thenetworkerhub.com.',
  },
  {
    match: /same (name|title).*(different|another).*(time|location|venue|place)|different (time|location|venue).*(same name|same title)|several (session|event).*same name|multiple (event|session|listing).*(different time|different location|different venue)/i,
    reply:
      'A multi-date series on one listing shares the same start time, end time, and venue (or online link) for every date — use that for a recurring meeting on different weeks. If your sessions have different start times or locations, create separate listings from My Events (Create event). You can reuse the same title on each; set the dates, times, and venue for that session individually.',
  },
  {
    match: /category exclusivity|one seat only|osop\b|application.?based (ticket|attend|booking)|application to attend/i,
    reply:
      'Category Exclusivity is an alternative to open ticket sales on the tickets step. Instead of buying straight away, prospective attendees apply to join — they answer two fixed questions (their industry and job title). You review and approve or deny each application from your organiser dashboard; approved applicants receive a payment link to complete booking. You can set an optional price (leave at £0 for free), a places limit, and an application closing date. It cannot be combined with open ticket types on the same event.',
  },
  {
    match: /change.*application question|custom.*application question|edit.*application question|different application question|application question.*change|can i change.*question/i,
    reply:
      'For Category Exclusivity events, the application questions are fixed: (1) What industry are you in? and (2) What is your job title? These cannot be changed. For standard open ticket booking, you can optionally turn on extra fields under Attendee information at booking on the tickets step — tick the boxes to note food is included, or to collect dietary or accessibility requirements at checkout.',
  },
  {
    match: /guest visit|complimentary visit|trial visit|visitor ticket|member ticket/i,
    reply:
      'The guest visit programme lets networking groups offer 1–2 complimentary trial visits per newcomer before paid member tickets unlock. Enable the allowance on your organiser page, choose Guest visit programme on the event tickets step, then add your paid member ticket type(s) below. New attendees use their free visit(s) first; returning visitors who have used them see the member pricing.',
  },
  {
    match: /add.*(more than one|multiple).*(date|day)|multiple dates|recurring (event|meeting|series)|event series|repeat.*date/i,
    reply:
      'Use the calendar on the listing details step and click every date you want to include. All selected dates form one series and share the same start time, end time, venue or online link, and ticket tiers. If any session has a different time or location, create it as a separate listing instead.',
  },
  {
    match: /early bird|early-bird/i,
    reply:
      'Add Early bird as its own ticket tier, set its lower price and quantity, then give it an earlier sales end date. Add your Standard tier as a separate row with its normal price; each tier is copied to every date in the series.',
  },
  {
    match: /save.*(draft|before publish)|draft.*(ticket|publish)|publish.*later/i,
    reply:
      'Yes — use Save as draft at any point and return from My Events in /organiser/ to finish the listing later. It will not appear on the public events browse page until you complete the ticket setup and publish it.',
  },
  {
    match: /visit count|1st visit|first visit|returning attendee|new to your group|repeat attendee/i,
    reply:
      'Open /organiser/ → Events → Attendees. Each registration shows a visit count (1st visit, 2 visits, etc.) based on Hub bookings with your organiser page — not annual membership records. Filter by new or returning, filter by event, and export a CSV with visit counts. Use this to welcome newcomers and spot regulars.',
  },
  {
    match: /alumni fast.?pass|alumni ticket|alumni rate|past attendee invite/i,
    reply:
      'Alumni Fast-Pass lets you invite past confirmed attendees to an exclusive alumni ticket rate on a new event — ideal for annual conferences or repeat summits. Enable it on the event tickets step, set your alumni price, and send invites from the organiser dashboard. Only invited past attendees can book the alumni tier.',
  },
  {
    match: /who (has |)(attended|registered|booked)|see (who|my) (attendee|registration|book)|view.*attendee|who is coming|attendee list|see registrations/i,
    reply:
      'Sign in and open /organiser/ → Events → Attendees. You will see everyone registered for your events — name, email, ticket type, visit count (1st visit vs returning), quantity, and booking date. Filter by event or by new vs returning, or click Download attendees CSV to export. The Hub tracks ticket registrations; there is no separate on-the-day check-in list.',
  },
  {
    match: /organiser|organizer|dashboard|sell ticket|stripe onboard|payout/i,
    reply:
      'Sign in and open /organiser/ to create events, manage attendees, sell tickets, and list opportunities. Complete Stripe onboarding there for payouts. New groups: email hello@thenetworkerhub.com with your group name, format, and location.',
  },
  {
    match: /account|register|sign up|create account|sign in|login/i,
    reply:
      'Browsing is completely free — no account needed. You need a free account to buy tickets or enquire about opportunities. Register at /register (about 2 minutes) or sign in at /login.',
  },
  {
    match: /browse|find|search|filter|map view|near me|upcoming/i,
    reply:
      'Go to /events/ for networking events (filter by type, date, industry, location; map view available). Business deals: /opportunities/. Ask me something specific like "events in Manchester" for live listings.',
  },
  {
    match: /academy|training|workshop|webinar|masterclass|course/i,
    reply:
      'The Networker Hub focuses on networking events and business opportunities. Browse events at /events/ or opportunities at /opportunities/. For seminars and learning-style meetups, try filtering the events directory by type.',
  },
  {
    match: /review|rating/i,
    reply:
      'Members can leave reviews after attending events. Sign in, visit My Hub or the event page, and follow the review option there. Organisers can reply from their dashboard under Reviews — replies appear on the public group profile.',
  },
  {
    match: /organiser profile|networking group profile|\/organisers\//i,
    reply:
      'Organiser profiles show who runs a business networking community and their events. Find them from event pages or at /organisers/{slug}.',
  },
  {
    match: /privacy|cookie|gdpr|legal|terms|policy/i,
    reply:
      'Privacy, terms, refunds, cookies, and organiser terms: /legal-policies. Cookie preferences: Cookie settings in the site footer. Questions: hello@thenetworkerhub.com.',
  },
  {
    match: /what is (the )?networker|about (the )?hub/i,
    reply:
      'The Networker Hub is a UK platform for networking events, exhibitions, and business opportunities — run by Rosie and Catherine at The Networker Group Ltd. Browse free; create a free account when you are ready to book or enquire. /about · /faq',
  },
  {
    match: /contact|support|email|phone|address|where are you/i,
    reply:
      'Email hello@thenetworkerhub.com. Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF. For booking issues include your event name and order reference. Chat with me on /contact.',
  },
  {
    match: /is (this |the )?(site|hub) free|free to use/i,
    reply:
      'Yes — browsing events and business opportunities is completely free with no sign-in. You only pay when you buy an event ticket at the price shown by the organiser. Opportunity enquiries are free.',
  },
  {
    match: /how much|cost|price|pay\b/i,
    reply:
      'Browsing is free. Event ticket prices are set by organisers and shown on each event page. Business opportunity enquiries are free.',
  },
];

const ORGANISER_PAGE_CONTEXT = {
  'event-format':
    'The user is creating an event and is on the format step (choose organiser page + in person or online). Answer listing-setup questions from your organiser knowledge. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'event-edit':
    'The user is on the event listing details step (title, type, description, photo, location, dates). Answer listing-setup questions from your organiser knowledge. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'event-tickets':
    'The user is on the ticket setup step (ticket types, Category Exclusivity, VAT, refund policy, publish). Answer organiser ticketing questions. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'group-edit':
    'The user is editing their organiser page. Answer organiser-page questions. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'organiser-dashboard':
    'The user is on the organiser dashboard. Answer questions about groups, events, attendees, revenue, and team invites. Team editors can manage events and view revenue but cannot invite others or delete events; up to 10 editors per account. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  guides:
    'The user is on the organiser guides / onboarding checklist page. Give concise answers (about 2 sentences) with direct links to /organiser/ routes, guide pages under /guides/, or specific dashboard sections. Focus on organiser setup tasks like listing events, Stripe, CSV export, and team invites.',
};

const ORGANISER_PAGE_KEYS = Object.keys(ORGANISER_PAGE_CONTEXT);

function matchedFallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) return null;
  for (var i = 0; i < FALLBACK_REPLIES.length; i++) {
    if (FALLBACK_REPLIES[i].match.test(text)) return FALLBACK_REPLIES[i].reply;
  }
  return null;
}

function buildOrganiserContextAddendum(pageContext) {
  const key = String(pageContext || '').trim();
  if (!key || !ORGANISER_PAGE_CONTEXT[key]) return '';
  return '\n\nORGANISER LISTING CONTEXT: ' + ORGANISER_PAGE_CONTEXT[key];
}

function fallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) {
    return (
      "Good day — I'm " +
      ASSISTANT_NAME +
      ', your business butler and concierge at The Networker Hub. How may I help — finding events or opportunities, booking tickets, or getting started as an organiser?'
    );
  }
  const matched = matchedFallbackReply(text);
  if (matched) return matched;
  return (
    "Thank you for your message. For detailed help, email hello@thenetworkerhub.com or read our FAQ at /faq. " +
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
  ORGANISER_PAGE_CONTEXT,
  ORGANISER_PAGE_KEYS,
  matchedFallbackReply,
  buildOrganiserContextAddendum,
  fallbackReply,
};
