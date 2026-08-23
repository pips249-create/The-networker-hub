/**
 * Hubert — British English gentleman & concierge knowledge and fallback replies.
 * Keep in sync with faq.html, hubert-faq.js, and legal-policies.html.
 * Run: node scripts/test-hubert-qa.js after edits.
 */
const ASSISTANT_NAME = 'Hubert';
const ASSISTANT_ROLE = 'British English gentleman and concierge';

const HUBERT_VOICE_GUIDE =
  'VOICE: You are Hubert — a courteous British English gentleman in the mould of a trusted club steward or discreet hotel concierge. ' +
  'Use British spelling (organise, favour, centre, enquiry). Polite and unhurried, never stiff, sarcastic, or servile. ' +
  'Natural phrasing: "Good afternoon", "Allow me to", "I\'m afraid", "Do bear in mind", "If I may suggest", "At your service", "Delighted to help", "Certainly", "Quite right". ' +
  'Address the reader as "you". Avoid Americanisms, slang, and excessive exclamation marks. ' +
  'Be concise — a gentleman is helpful, not verbose. One light touch of warmth per reply is enough. ' +
  'Never play a caricature (no "old sport", "top hole", or mock posh). Sound refined, calm, and genuinely helpful.';

const KNOWLEDGE_SECTIONS = [
  {
    title: 'WHO WE ARE',
    body:
      'The Networker UK (www.thenetworkeruk.com; formerly the-networker.co.uk) is a UK platform connecting business owners and professionals with networking events, exhibitions, conferences, and business opportunities. ' +
      'Operated by The Networker Group Ltd (Company No. 15252227, VAT No. 454 4092 94). ' +
      'Co-founded and run by Rosie and Catherine. Mission: help people find the right room at the right time to grow their network and business. ' +
      'Contact: hello@thenetworkeruk.com · Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF.',
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
      'My account /account/ · For networkers /for-networkers · For organisers /for-organisers · Organiser workspace /organiser/ · Organiser guides /guides · ' +
      'Sign in /login · Register /register · FAQ /faq · Help: organiser payouts /help/organiser-payouts · ticket fees /help/pricing-fees · ' +
      'About /about · Contact /contact (chat with Hubert) · Advertising /advertising · Legal /legal-policies · Organiser profiles /organisers/{slug}.',
  },
  {
    title: 'BROWSING & ACCOUNTS',
    body:
      'Browsing is completely free — no sign-in needed to explore events and business opportunities. ' +
      'A free account is required only when you want to: buy a ticket or send a business opportunity enquiry. Sign-up takes about 2 minutes at /register. ' +
      'Sign in at /login. Forgot password? Use the password reset link on the sign-in page. You must be 18+ to create an account. ' +
      'With an account you can save event and opportunity favourites, follow organisers (saving an event also saves its organiser), get email alerts when tickets go on sale for saved events, receive booking reminders before events you booked, generate "I\'m going" share cards after booking, set up saved opportunity search alerts in My account (/account/), manage tickets and track opportunity enquiries, and leave reviews after events you attended. Add your company and job title in account settings — they appear on printable name badges when organisers export them.',
  },
  {
    title: 'EVENTS & TICKETING',
    body:
      'Find events via Browse events or /events/. Filter by type, date, industry, and location; use map view. Filter or search for free events on the listings. ' +
      'Each event page is the source of truth for dates, venue, price, and organiser. ' +
      'To book: create a free account → open the event → choose ticket type → Stripe checkout. Add guest names at checkout (shared with the organiser). ' +
      'Booking confirmations are sent by email — check spam/junk and that your account email is correct; view tickets in /account/. ' +
      'Paid event contract is usually with the organiser on the listing; the platform provides booking technology. ' +
      'Tickets are generally non-transferable without organiser consent — contact the organiser via the event page to ask.',
  },
  {
    title: 'REFUNDS & CANCELLATIONS',
    body:
      'Refund rules depend on the organiser and what was shown at booking — /legal-policies#refunds. ' +
      'To cancel: contact the organiser first via the event page. Free events can often be cancelled from /account/ or via the organiser. ' +
      'If the organiser cancels the event: you are entitled to a full refund of the ticket price (including mandatory fees shown at checkout), typically within 14 days via Stripe. ' +
      'If unresolved, email hello@thenetworkeruk.com with your booking reference. Failed checkout payments are not charged — retry checkout or email hello@ if charged in error.',
  },
  {
    title: 'BUSINESS OPPORTUNITIES',
    body:
      'Browse free at /opportunities/. Types: franchise, side hustle, partnership, distributorship, networking/referral. Not FCA-regulated; not investment advice; due diligence is your responsibility. ' +
      'To enquire: free account → open listing → send enquiry from the page. ' +
      'SAVE & ALERTS: signed-in members can heart-save listings in My account → Saved Opportunities, get email when a saved listing is closing soon, and save search criteria for email alerts when new matching listings publish. Compare up to 3 saved opportunities side by side. ' +
      'To list an opportunity as an organiser: /opportunities/list or /organiser/.',
  },
  {
    title: 'ORGANISERS',
    body:
      'Approved organisers use /organiser/ to create events, sell tickets via Stripe, manage attendees, export registrations, list opportunities, and invite team members. Stripe Connect onboarding under Revenue is required before publishing paid tickets. ' +
      'CLAIM YOUR PAGE: many UK networking groups already have a directory page from the legacy Networker site. Browse organisers on /events/, sign in with the email linked to your group — when it matches, a claim prompt appears on Overview automatically — guide at /guides/claim-your-organiser-page. Email changed or no prompt? Find your group on /events/ (organisers tab) and use Request access on its profile page, or email hello@thenetworkeruk.com with your group name and current contact email. New groups without a listing: email hello@thenetworkeruk.com with your group name, format, and location. Organiser terms: /legal-policies#organisers. Platform rules (plain-English standards for organisers): /legal-policies#hub-rules. ' +
      'EVENT NOT ON BROWSE PAGE? Public browse only shows events that are Published (not Draft), Approved, and linked to a published organiser profile. Finish the publish flow in /organiser/ (tickets, refund policy, publish). If it still does not appear, email hello@thenetworkeruk.com with the event title. ' +
      'DOWNLOAD ATTENDEES: Sign in → /organiser/ → Events → Attendees. Filter by event, then use Download attendees CSV. Export printable name badges (PDF for standard or large A4 sticker sheets) from the same screen — badges use each guest’s name, company, and job title from their Account when set. ' +
      'PAYOUTS: With Stripe Connect (standard), ticket revenue goes to your connected Stripe account when attendees pay — open Stripe Express from Revenue for balance, refunds, and bank payouts. Events archive automatically after they end. Legacy manual payouts (if Connect is off): 7-day settlement after the event, then request payout from Revenue when net amount is above £1. Minimum payout £1. Full guide: /help/organiser-payouts. ' +
      'FEES: Attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before they pay). This covers platform and payment processing — organisers receive the full ticket price, with no separate platform or Stripe deductions. Worked examples: /help/pricing-fees.',
  },
  {
    title: 'ORGANISER EVENT LISTING',
    body:
      'Creating a listing: /organiser/ → create event → choose group and format (in person or online) → event-edit.html for title, type, description, photo, venue or join link, and dates → event-tickets.html for tiers, VAT, refund policy, publish. ' +
      'EVENT TYPE (Meeting, Events, Conference, Exhibition, Awards, Webinar, Workshop, Seminar, Masterclass): this is a browse filter, not whether something counts as an event. Meeting covers breakfasts, netwalking, women-only sessions, and most regular networking. Events is for larger one-offs (lunch & learns and similar). Conference is for multi-day summits and delegate events. Exhibition and Awards are for trade shows and ceremonies. Webinar, Workshop, Seminar and Masterclass help people find online talks, hands-on training, expert-led seminars, and masterclasses. ' +
      'MULTI-DATE SERIES: click multiple days on the calendar — the same UK start time, end time, and venue (or online link) apply to every date (Europe/London). Ideal for a recurring meeting on different weeks. The clock time stays the same when British Summer Time starts or ends — for example 10:15 on every date. To remove a date, click the highlighted day again on the calendar. ' +
      'SAME TITLE, DIFFERENT TIME OR LOCATION: create separate listings — one per session — from My Events. You can reuse the same title; each listing gets its own dates, times, and venue. ' +
      'COVER PHOTO: upload, drag-and-drop, paste (Ctrl+V), or paste a URL. Files over 2MB are compressed automatically; if that fails, resize the file or use a hosted URL. For a sharp browse listing, use a landscape photo at least 1200×750px. After upload, drag the preview to recentre how the image is cropped on listing cards (Reset position clears the crop). Use Remove to clear a photo and upload again.',
  },
  {
    title: 'ORGANISER TICKETS & ATTENDEES',
    body:
      'TICKET SETUP (event-tickets.html): choose Ticket types (open booking) or Category Exclusivity — these two attendance modes are mutually exclusive. ' +
      'OPEN BOOKING: add one row per ticket tier (Standard, Early bird, etc.) with price, quantity, and sale dates. Optionally enable Free trial visits: visitors get 1–3 free visits (maximum 3) before paid member tickets unlock — either on this organiser page only, or shared across all your organiser pages. Use “Pause free visits on this date only” to skip free visits on a specific date (e.g. conferences) while keeping paid tickets available. NETWORKING GROUP MEETING: for groups with monthly/annual membership — free visits for visitors, a free member ticket for people on your member list, then join membership after visits (no public event ticket). “Closed meeting — member list only” is different: no public ticket and no free visits. The optional member ticket price adds a hidden rate for your member list while public tickets stay on sale. Previous Attendees is an optional add-on: a returning ticket for past attendees, with invites sent from your dashboard after publish. ' +
      'CATEGORY EXCLUSIVITY: prospective attendees apply instead of buying straight away. They answer two fixed questions — their industry and job title. You approve or deny each application from your organiser dashboard; approved applicants receive a payment link to complete booking. Set an optional price (leave at £0 for free), places limit, and application closing date. Cannot be combined with open ticket types on the same event. ' +
      'APPLICATION QUESTIONS: under Category Exclusivity, industry and job title are fixed and cannot be changed. For open ticket booking, you can optionally tick boxes under Attendee information at booking to note food is included or to collect dietary or accessibility requirements at checkout. ' +
      'VIEW REGISTRATIONS: sign in → /organiser/ → Events → Attendees. Filter by event or by new vs returning. Each row shows visit count (1st visit, 2 visits, etc.) based on platform bookings with your organiser page. After the event starts, mark Didn’t attend on anyone who no-showed — they skip the review email and cannot leave a review for that event. Download attendees CSV or export printable name badges (PDF).',
  },
  {
    title: 'MEMBER LIST',
    body:
      'Per networking group (organiser page), organisers maintain a Member list at /organiser/member-roster — name, email, and optional membership expiry. ' +
      'PURPOSE: unlock Members only ticket tiers. The public never sees those tickets; people on the list see them automatically when signed in with the same email — no access codes. ' +
      'SETUP: open your organiser page → Member list (or group-edit → Manage member list). Add members one by one or import CSV (columns: email required, name, expires or membership expiry). Optionally send invite emails — The Networker UK users get a sign-up invite; existing members get a welcome email with the group’s next meeting. ' +
      'When you publish a new Approved event, people on the member list are queued for a daily digest email (Members only rates apply when they sign in with that email). ' +
      'REPORTS on the member list page: membership health (active, signed up vs not yet, expiring soon), booked vs not booked for a selected upcoming event, new vs returning among your uploaded members only, members who missed recent meetings, memberships expiring within 14 days. Reports never include non-members who booked the event — use Attendees for full event lists. Download members CSV or an event report CSV. Email booking reminders to members who have not booked; members are also auto-emailed when you publish Approved events. ' +
      'MEMBERS: when added, they see the group under My account → My memberships (/account/#memberships). Sign in with the membership email to book member-only tickets. ' +
      'RENEWALS: organisers can collect monthly or annual membership dues through The Networker UK (Stripe Connect) — members pay the published price plus a booking fee (4.5% + 20p, same as tickets); the group receives 100% of the membership price. Members join from the organiser page or renew/manage from My account → Memberships (update card or cancel via Stripe Customer Portal). Organisers can also Invite to pay from the member list, and can still renew people off-platform by updating expiry dates. ' +
      'TICKETS: on event-tickets.html, add a Members only ticket tier — access is enforced via the member list.',
  },
  {
    title: 'ORGANISER GUIDES',
    body:
      'Organiser guides live at /guides — getting started with events (/guides/list-an-event, then open /organiser/ for the in-app checklist), claim your organiser page (/guides/claim-your-organiser-page), list a conference or exhibition (/guides/list-a-conference-or-exhibition), export attendees and track visits (/guides/export-attendees-and-visits), list a business opportunity (/guides/list-a-business-opportunity), invite team members (/guides/invite-your-team). Attendees should use the FAQ or Hubert chat instead.',
  },
  {
    title: 'ORGANISER TEAM & EDITORS',
    body:
      'Team invites live under /organiser/ → Team & invites. Only the account owner can invite or remove editors (up to 100 editors per organiser account). When inviting, the owner can grant access to all groups or selected networking groups only. ' +
      'INVITE FLOW: owner enters colleague email, chooses group access, invite email is sent → colleague signs in with that exact email → they become Active and see only their assigned groups (or all groups if the owner chose that). ' +
      'EDITOR ACCESS: manage assigned groups (or all groups); create and edit events, tickets, and attendees; view revenue and reviews for those groups; reply publicly to attendee reviews; manage business opportunities. ' +
      'EDITORS CANNOT: invite or remove team members; create or duplicate networking groups; add bank details or request payouts; delete events (cancel instead if needed). ' +
      'If someone already runs their own organiser account with claimed groups, their own workspace takes priority over an editor invite.',
  },
  {
    title: 'TEAM & STORY',
    body:
      'Co-founders Rosie and Catherine built The Networker UK to connect UK business owners and professionals with the right events, communities, and opportunities. Both are listed as Co-founders on /about. ' +
      'Why it started: the mission is that the right room at the right time changes careers and companies — one trusted place for event listings, organiser profiles, and business opportunities. ' +
      'For specific questions about the team beyond what is on /about, email hello@thenetworkeruk.com.',
  },
  {
    title: 'ADVERTISING & SPONSORSHIP',
    body:
      'Paid hero sponsor placements appear on event and opportunity pages — labelled Powered by on browse pages and clearly labelled Sponsored elsewhere. Rate card at /advertising (events main sponsor £2,000/mo, mini sponsors £600/slot ×3, featured events £55 one-time; organisers main sponsor £1,000/mo, mini £300/slot ×3, featured profiles £27.50 one-time; opportunities main sponsor £2,000/mo, mini £600/slot ×3, listings £25/mo + VAT, premium spotlight £55 one-time; City Partner from £29/mo per city + VAT, £75 for 3 cities). Most sponsorship packages offer monthly billing or prepaid 1 / 3 / 6 / 12 months (save 5% / 10% / 15% on longer prepaid terms). Enquiries: rosie@thenetworkeruk.com. Policy: /legal-policies#advertising. ' +
      'Organisers can also reach audiences by listing events (/organiser/) or business opportunities (/opportunities/list). Featured placement may be available — ask rosie@thenetworkeruk.com.',
  },
  {
    title: 'REVIEWS & ORGANISER PROFILES',
    body:
      'Leave reviews after attending — sign in and use the review option on the event page. Top networking groups earn ranking badges from attendee feedback. ' +
      'Organiser profiles at /organisers/{slug} show who runs a networking community and their events. Follow an organiser from their profile or by saving one of their events — they appear under My account → Saved organisers, and you get alerts when they publish new listings. ' +
      'Report a listing: use Report listing on an event, organiser, or opportunity page if something looks wrong — our team reviews reports.',
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
  ' for The Networker UK — polished, discreet, and quietly proactive. ' +
  'Introduce yourself as ' +
  ASSISTANT_NAME +
  ', at your service on The Networker UK, when asked who you are. ' +
  'Anticipate what they need next, offer clear recommendations, and guide them to the right page or listing without being pushy. ' +
  'When someone is ready to act (book, enquire, register), mention that a free account takes about two minutes at /register. ' +
  KNOWLEDGE_BASE +
  ' ' +
  HUBERT_VOICE_GUIDE +
  ' ' +
  'STYLE: Lead with a direct answer (Yes or No when appropriate), then explain what to do. Use short paragraphs or bullet points for steps. ' +
  'Include relevant page paths when they help the reader take action. Keep answers focused — usually two to four sentences unless steps are needed. ' +
  'LIMITS: Never invent event dates, prices, venues, opportunity details, refund outcomes, or policies. If you lack specifics, say so honestly — "I\'m afraid I don\'t have that detail to hand." ' +
  'When a LIVE EVENT LOOKUP block is provided, answer event-finding questions using only those listings and include the full URL link shown for each event. ' +
  'When a LIVE OPPORTUNITY LOOKUP block is provided, answer opportunity questions using only those listings and include the full URL link shown for each listing. ' +
  'For account-specific issues you cannot resolve, direct people politely to hello@thenetworkeruk.com or /faq.';

/** Most specific patterns first — order matters. */
const FALLBACK_REPLIES = [
  {
    match: /event.*(not show|doesn.?t show|isn.?t show|missing|not appear|not on browse)|added my event|publish.*not|why.*(on|in) browse/i,
    reply:
      'Browse events only lists items that are Published (not Draft), Approved, and tied to a published organiser profile. In /organiser/, open your event, complete tickets and your refund policy, then publish. New listings may need platform approval. Still missing? Email hello@thenetworkeruk.com with the event title and your organiser account email.',
  },
  {
    match: /advertis|sponsor|promote my business|marketing on (the )?site|get exposure|city partner|city sponsor/i,
    reply:
      'For paid advertising, see /advertising — events main sponsor £2,000/mo, mini sponsors £600/slot (max 3), featured events £55 one-time; organisers directory main sponsor £1,000/mo, mini £300/slot (max 3), featured profiles £27.50 one-time; opportunities main sponsor £2,000/mo, mini £600/slot (max 3), listings £25/mo + VAT, premium spotlight £55 one-time; City Partner from £29/mo per city + VAT (£75 for 3 cities). Most packages: monthly or prepaid 1 / 3 / 6 / 12 months (save up to 15% yearly). Email rosie@thenetworkeruk.com. You can also list events from /organiser/ or a business opportunity at /opportunities/list. Policy: /legal-policies#advertising.',
  },
  {
    match: /what does rosie do|who is rosie|rosie('s)? role/i,
    reply:
      'Rosie is co-founder of The Networker UK alongside Catherine. Together they built the platform to connect UK business owners and professionals with events, communities, and opportunities. More on /about — for specific enquiries, hello@thenetworkeruk.com.',
  },
  {
    match: /who is catherine|catherine.*co-founder|what does catherine do/i,
    reply:
      'Catherine is co-founder of The Networker UK alongside Rosie. Together they run The Networker Group Ltd and built The Networker UK as a trusted place to discover networking events and business opportunities across the UK. More on /about.',
  },
  {
    match: /why.*(start|created|built)|how did (the )?hub start|origin of|story behind/i,
    reply:
      'The Networker UK started from a simple belief: the right room at the right time changes careers and companies. Rosie and Catherine built one trusted UK platform for event listings, organiser profiles, and business opportunities — so members can find what matters and organisers can reach the audiences they deserve. /about',
  },
  {
    match: /how much.*(hub|networker|platform).*(make|take|fee|charge|per ticket)|platform fee|booking fee|what do you charge/i,
    reply:
      'Attendees pay one booking fee at checkout — 4.5% + 20p per ticket, shown before payment. This single fee covers platform and payment processing. Organisers receive the full ticket price (no separate platform or Stripe deductions). Worked examples: /help/pricing-fees · Full terms: /legal-policies.',
  },
  {
    match: /download.*attendee|export.*attendee|attendee.*csv|attendees csv|get.*attendee list/i,
    reply:
      'Sign in and open /organiser/, go to Events → Attendees, filter by your event, then click Download attendees CSV. The file includes name, email, ticket type, visit count, and booking date. Export printable name badges (PDF for standard or large A4 sticker sheets) from the same screen.',
  },
  {
    match: /payout|when do i get paid|settlement|instant payout|how long.*paid|stripe express|connect stripe/i,
    reply:
      'With Stripe Connect (standard), paid ticket revenue goes to your connected Stripe account when attendees pay — open Stripe Express from Revenue in /organiser/ for balance, refunds, and bank payouts. Complete Connect Stripe under Revenue before publishing paid tickets. Events archive automatically after they end. If you use legacy manual payouts, a 7-day settlement applies before you can request payout from Revenue (minimum £1). Full guide: /help/organiser-payouts.',
  },
  {
    match: /what is hubert|who is hubert|tell me about hubert/i,
    reply:
      "Good afternoon — I'm Hubert, your host and concierge at The Networker UK. I'm at your service for events, business opportunities, tickets, enquiries, and organiser tools. You'll find me on the contact page and via the chat button on public pages.",
  },
  {
    match: /confirmation email|booking email|didn.?t receive|didn't receive|no confirmation|email.*ticket/i,
    reply:
      'Booking confirmations are sent by email after successful checkout. Please check your spam or junk folder and that your account email is correct in /account/. Your tickets also appear in My account (/account/). Still missing? Email hello@thenetworkeruk.com with the event name and the email address you used.',
  },
  {
    match: /forgot.*password|reset.*password|password reset/i,
    reply:
      'Use the password reset link on the sign-in page at /login — enter your email and follow the instructions. If you are still stuck, email hello@thenetworkeruk.com from the address on your account.',
  },
  {
    match: /transfer.*ticket|give.*ticket|ticket.*colleague|ticket.*someone else/i,
    reply:
      'Tickets are generally non-transferable without the organiser\'s consent. Contact the organiser via the event listing page to ask if a transfer is possible. For booking changes, email hello@thenetworkeruk.com with your order reference if you need help reaching them.',
  },
  {
    match: /organiser cancel|event cancel|cancelled.*event|event.*cancelled/i,
    reply:
      'If an organiser cancels an event, you should receive a full refund of the ticket price you paid (including any mandatory booking fees shown at checkout), typically within 14 days to your original payment method via Stripe. If you have not heard anything, email hello@thenetworkeruk.com with your booking reference.',
  },
  {
    match: /payment failed|failed payment|stripe.*fail|checkout.*fail|card.*declin/i,
    reply:
      'If checkout failed, your card should not have been charged — you can try again from the event page. Check your card details and try a different payment method if needed. If you believe you were charged without a confirmation, email hello@thenetworkeruk.com with the event name and time of the attempt.',
  },
  {
    match: /cancel.*(book|ticket|registration)|cancel my (book|ticket)/i,
    reply:
      'Cancellation rules depend on the organiser and what was shown when you booked — see /legal-policies#refunds. Contact the organiser first via the event page. For free events, you may be able to cancel from My account (/account/). If you need help, email hello@thenetworkeruk.com with your booking reference.',
  },
  {
    match: /refund|chargeback|cooling.?off/i,
    reply:
      'Refund rules depend on the organiser and what was shown when you booked — see /legal-policies#refunds. Contact the organiser first via the event page. If an event was cancelled by the organiser, you should receive a full refund via Stripe. For help, email hello@thenetworkeruk.com with your booking reference.',
  },
  {
    match: /list.*(franchise|opportunit)|publish.*opportunit|post.*opportunit|sell.*franchise/i,
    reply:
      'Sign in → /organiser/ → Business opportunities → List a listing. Complete the form — title, type, summary, investment notes, images — and submit for review. Listings are checked before going live. Full guide: /guides/list-a-business-opportunity.',
  },
  {
    match: /why (list|use|choose).*(hub|networker)|why should i list|benefits of listing/i,
    reply:
      'The Networker UK is built for UK business networking. You get a permanent organiser profile, events in a directory members use to find networking meetings, optional business opportunity listings, team editors, and reviews. Networking-specific tools include Free trial visits (1–3 free visits before paid member tickets), visit tracking on your attendee list (1st visit vs returning, with filters and CSV export), Category Exclusivity for application-based events, and Previous Attendees to invite past attendees to exclusive returning rates on repeat events. You receive the full ticket price; attendees pay one booking fee (4.5% + 20p per ticket) at checkout. Free events need no Stripe. Guides: /guides · Organisers: /for-organisers',
  },
  {
    match: /(paid|member).*(ticket|tier).*(guest visit|complimentary visit|guest programme|free trial visit)|(guest visit|complimentary visit|guest programme|free trial visit).*(paid|member).*(ticket|tier)/i,
    reply:
      'Yes — enable the guest visit programme (Complimentary visits) on Set up tickets alongside your tickets (paid, free, or both). Visitors use complimentary visits first; once used, they buy a paid ticket or join membership. You can still offer a free ticket and a paid ticket. Do not add a ticket named First Meeting for a first visit — that can be booked on every remaining date with no visit limit. For monthly membership with no event ticket, choose Free visits, then membership.',
  },
  {
    match: /difference.*(ticket type|guest visit|category exclusiv|application based|general ticket)|ticket type.*guest visit.*category|guest visit.*category exclusiv|attendance mode|how (do|should) people get in|networking group meeting|booking options|how will people book|convert free visits/i,
    reply:
      'Two ways in: Ticket types (General ticketing — anyone can book) or Category Exclusivity (application based — you approve seats). Complimentary visits are an optional add-on — first visit, then they pay or join. Then choose how people book — Ticket for this event, Free visits, then membership, or Ticket and membership. Full walkthrough: /organiser/booking-options.',
  },
  {
    match: /\bvat\b|value added tax/i,
    reply:
      'Choose the VAT option that matches your position: VAT included means the displayed price is the attendee’s final ticket price including VAT; VAT added at checkout means it is added on top; Not VAT registered means no VAT is charged and the listed price is what attendees pay. You must select one before publishing paid tickets. The organiser remains responsible for its own VAT position—check with your accountant if you are unsure.',
  },
  {
    match: /already use|eventbrite|meetup|other platform|alongside|as well as|in addition to/i,
    reply:
      'Yes — you can list on The Networker UK alongside other event platforms. There is no exclusivity requirement. Many organisers use The Networker UK to reach members browsing specifically for UK networking events and to build their organiser profile here. List the same events you run elsewhere if you like.',
  },
  {
    match: /list.*(networking group|my group|our group)|become an organiser|onboard.*organiser/i,
    reply:
      'Many UK networking groups already have a page on the platform. Browse organisers on /events/, sign in with the email linked to your group, and confirm the claim prompt on Overview — step-by-step guide at /guides/claim-your-organiser-page. Brand-new group not listed yet? Email hello@thenetworkeruk.com with your group name, typical format, and location. Once approved, use /organiser/ to create events and manage attendees.',
  },
  {
    match: /cost to list|how much.*list|fee.*list|price.*list.*event|listing fee/i,
    reply:
      'There is no monthly subscription to list events. Use /organiser/ to publish free or paid events. For paid tickets, attendees pay one booking fee at checkout (4.5% + 20p per ticket) — you receive the full ticket price. Free events do not require Stripe. Email hello@thenetworkeruk.com for onboarding help.',
  },
  {
    match: /free (networking )?events?|events?.*free\b|no cost events?/i,
    reply:
      'Many networking events on the platform are free to attend — browse /events/ and check each event page for pricing. You can filter listings and look for free tickets. Free events may still need registration; some require a free account to complete sign-up.',
  },
  {
    match: /email changed|wrong email|different email|no claim prompt|request access.*(organiser|group|page)/i,
    reply:
      'If your contact email has changed, sign in will not match the listing on file. Find your group on /events/ (organisers tab), open its profile, and use Request access — we verify you and send a claim link to your current email. Already signed in with no prompt? Check Overview for a notice, or follow the same Request access path. Guide: /guides/claim-your-organiser-page.',
  },
  {
    match: /claim.*(organiser|page|profile|group)|take over.*(page|profile|listing)|already listed|legacy networker|old networker site/i,
    reply:
      'To claim your organiser page: browse organisers on /events/ and find your group → sign in at /login with the email linked to your group → confirm the claim prompt on Overview in /organiser/ (appears automatically when your email matches). Update your logo, description, and guest visit settings, then list your next event. Full guide: /guides/claim-your-organiser-page. No claim prompt? Your email may have changed — open your group\'s public profile and use Request access, or email hello@thenetworkeruk.com with your group name and current contact email.',
  },
  {
    match: /invite.*team|team member|add.*editor|editor access|team & invites|remove.*team member/i,
    reply:
      'Only the account owner can invite team members. Sign in → /organiser/ → Team & invites → enter their email, choose all groups or selected groups, and send (up to 100 editors). They sign in with that exact email to become Active. Editors can manage events and view revenue but cannot invite others, add bank details, or delete events. Guide: /guides/invite-your-team.',
  },
  {
    match: /respond to.*enquir|reply to.*enquir|manage.*opportunity enquir|enquir.*as organiser|prospect enquir/i,
    reply:
      'When someone enquires on your listing, you receive an email notification. Reply directly to the prospect and track enquiries under Business opportunities in /organiser/. Attendees can also view sent enquiries in My account (/account/).',
  },
  {
    match: /what happens when i publish|after i publish|publish my event|how long.*approv|listing review|when will my event go live|event approval/i,
    reply:
      'When you publish, your event is submitted for platform approval — typically within one working day. Once Approved and tied to a published organiser profile, it appears on /events/ and attendees can book. People on your member list get a daily digest email about new Approved events (not an instant blast on publish).',
  },
  {
    match: /venue step|event location step|where do i (set|add) the venue|online join link|postcode.*event/i,
    reply:
      'On the location step, add your venue name and address for in-person events, or paste your online join link for webinars. The postcode helps attendees find you on the map. Attendees see the full venue or link after booking — online links also appear in My account (/account/).',
  },
  {
    match: /how do i find events|where (can|do) i (find|browse|search) events|discover events/i,
    reply:
      'Browse all events free at /events/ — filter by type, date, industry, and location, or use map view. Ask me something specific like "What events are in Leeds?" and I will search live listings for you.',
  },
  {
    match: /ticket.*(alert|on sale|go on sale)|alert.*ticket|notify.*ticket|when tickets (open|go on sale)/i,
    reply:
      'Save an event while signed in (heart icon on the listing). If tickets are not on sale yet, we email you when they open. You can also follow organisers — saving one of their events adds them under My account → Saved organisers, and you get alerts when they publish new listings.',
  },
  {
    match: /follow.*organiser|save.*organiser|favourite organiser|favorite organiser|saved organiser/i,
    reply:
      'Follow an organiser from their profile page, or save any of their events — the organiser is added under My account → Saved organisers. You will get email alerts when they publish new events. Browse organisers from /events/ (organisers tab).',
  },
  {
    match: /share card|i.?m going|linkedin.*(event|going|attending)|social.*(share|post).*event/i,
    reply:
      'After you book, open My account (/account/) → your upcoming event → use the share option to generate an "I\'m going" card for LinkedIn or social media. Booking references and online meeting links are also in My account.',
  },
  {
    match: /booking reminder|remind me before|email before (the )?event|event reminder/i,
    reply:
      'We send booking reminder emails before events you have booked — check your inbox (and spam folder). Your tickets and meeting links are always in My account (/account/).',
  },
  {
    match: /track.*enquir|my enquir|opportunity enquir|enquiries i sent/i,
    reply:
      'Sign in and open My account (/account/) → My opportunity enquiries to see enquiries you have sent and any replies from listers. Browse opportunities at /opportunities/.',
  },
  {
    match: /report.*(listing|event|organiser|opportunit)|flag.*(listing|event|page|inappropriate)/i,
    reply:
      'Use Report listing on the event, organiser profile, or opportunity page. Choose a reason and optional details — our team reviews reports. For urgent booking issues, email hello@thenetworkeruk.com with the listing name.',
  },
  {
    match: /connect stripe|stripe connect|stripe onboarding|set up (stripe|bank|payout)|bank details.*organiser/i,
    reply:
      'Sign in → /organiser/ → Revenue → Connect Stripe. Complete Stripe onboarding before publishing paid tickets — this links your bank account so ticket revenue can reach you. Free events do not need Stripe. Guide: /help/organiser-payouts.',
  },
  {
    match: /cancel.*(my )?event as organiser|organiser.*cancel.*event|how do i cancel an event/i,
    reply:
      'Sign in → /organiser/ → My events → open the event → Cancel event. Attendees are notified and eligible for refunds per your refund policy and /legal-policies#refunds. Refunds are deducted from event revenue before any payout.',
  },
  {
    match: /hub rules|organiser rules|listing standards/i,
    reply:
      'Organiser standards and listing rules are in plain English at /legal-policies#hub-rules — covering accurate listings, respectful conduct, and what happens if a listing is removed. Full organiser terms: /legal-policies#organisers.',
  },
  {
    match: /save an event|save events|saving events/i,
    reply:
      'Create a free account at /register, then tap the heart on any event while browsing. Saved events appear in My account (/account/). If tickets are not on sale yet, we email you when they open. Saving an event also saves its organiser.',
  },
  {
    match: /who (runs|operates) (this |the )?(site|hub|platform)/i,
    reply:
      'The Networker UK is operated by The Networker Group Ltd (Company No. 15252227), co-founded by Rosie and Catherine. More at /about and /faq.',
  },
  {
    match: /favourit|favorit/i,
    reply:
      'Create a free account at /register, then save events and business opportunities to your favourites while browsing. Manage saved items in My account (/account/) — events under Saved events, opportunities under Saved Opportunities with optional closing-soon email alerts.',
  },
  {
    match: /guest|add a name|book for someone/i,
    reply:
      'Yes — when you buy a ticket you can add guest names at Stripe checkout. Those names are shared with the organiser to manage attendance. View your bookings in My account (/account/).',
  },
  {
    match: /\bbook\b.*\bticket|\bticket\b.*\bbook|how do i book|buy a ticket|checkout|my tickets/i,
    reply:
      'Browse events free at /events/. To buy a ticket: create a free account at /register (about 2 minutes), open an event, choose your ticket type, and complete secure Stripe checkout. Add guest names at checkout. View bookings in My account (/account/). Issues? Email hello@thenetworkeruk.com with your event name and order reference.',
  },
  {
    match: /save.*opportunit|opportunit.*favourit|heart.*opportunit|saved opportunit/i,
    reply:
      'Sign in and tap the heart on any opportunity listing, or open My account (/account/) → Saved → Saved Opportunities. You can get an email when a saved listing is closing soon. Compare up to 3 saved opportunities side by side from My account.',
  },
  {
    match: /saved search.*opportunit|opportunit.*saved search|alert.*new opportunit|notify.*new listing/i,
    reply:
      'On /opportunities/, set your filters, then save the search while signed in. Matching new listings trigger email alerts in My account. Manage saved searches from /account/ under Saved.',
  },
  {
    match: /compare.*opportunit|opportunit.*compare|side by side/i,
    reply:
      'Save two or more opportunities to My account, then use Compare to view up to 3 listings side by side — useful for weighing franchise or partnership options.',
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
    match: /difference.*(event|meeting)|meeting vs|event vs|what.*(event type|type of event)|meeting or event|conference or exhibition/i,
    reply:
      'Every listing is an event — the Event type dropdown is a browse filter. Meeting covers breakfasts, netwalking, women-only sessions, and most regular networking. Events is for larger one-offs such as lunch & learns. Conference is for summits and multi-day delegate events. Exhibition and Awards are for trade shows and ceremonies. Webinar, Workshop, Seminar and Masterclass help people find online talks, hands-on training, expert-led seminars, and masterclasses. Pick the type that best matches how people will search for it on /events/. Conferences guide: /guides/list-a-conference-or-exhibition.',
  },
  {
    match: /image.*(crop|cut off|cut.?off|position|reposition|recentre|reframe|framing|heads? cut)|photo.*(crop|cut off|position|reposition)|cover.*(crop|cut off|position)/i,
    reply:
      'After you upload your event photo, drag the preview to recentre how it is cropped on listing cards — the preview matches the browse-page crop. Use Reset position to centre it again. For the sharpest result, start with a landscape image at least 1200×750px.',
  },
  {
    match: /image.*(too small|blurry|low.?res|pixelat)|photo.*(too small|blurry|low.?res)|cover.*(too small|blurry)|logo.*too small/i,
    reply:
      'Use a higher-resolution landscape photo — aim for at least 1200×750px so your listing stays sharp on the browse page. Re-export from your original file, or paste a URL to a larger hosted image. After upload, drag the preview to recentre the crop if faces or logos are clipped.',
  },
  {
    match: /image.*(too (big|large)|won.?t upload)|photo.*(too (big|large)|won.?t upload)|cover.*too (big|large)|file.*too large|could not compress/i,
    reply:
      'Files over 2MB are compressed automatically when you upload. If that fails, resize the image on your computer first, or paste a hosted image URL in the URL field instead. PNG and JPG work best. You can also drag-and-drop or paste (Ctrl+V) a smaller file into the upload zone.',
  },
  {
    match: /remove.*(date|day)|delete.*(date|day)|get rid of.*(date|day)|accident.*(date|day)|extra date|wrong date|deselect.*(date|day)/i,
    reply:
      'Click the highlighted date again on the calendar to deselect it — selected days show as highlighted and appear in the date list below. You need at least one date to continue to tickets. If you already saved and need to drop a date from a published series, open the listing from My Events — if ticket sales are locked, email hello@thenetworkeruk.com.',
  },
  {
    match: /same (name|title).*(different|another).*(time|location|venue|place)|different (time|location|venue).*(same name|same title)|several (session|event).*same name|multiple (event|session|listing).*(different time|different location|different venue)/i,
    reply:
      'A multi-date series on one listing shares the same UK start time, end time, and venue (or online link) for every date — use that for a recurring meeting on different weeks. The clock time stays the same when BST starts or ends. If your sessions have different start times or locations, create separate listings from My Events (Create event). You can reuse the same title on each; set the dates, times, and venue for that session individually.',
  },
  {
    match: /category exclusivity|one seat only|osop\b|application.?based (ticket|attend|booking)|application to attend/i,
    reply:
      'Application based (Category Exclusivity) is on the tickets step. People apply with industry and job title; you approve or decline. You do not have to sell a ticket — choose Free visits, then membership so visitors try the group then join. Or charge a ticket after approval, or Ticket and membership. List-member booking lets people on your Membership list book without applying (or use Invite members after publish). It cannot be mixed with General ticketing on the same event.',
  },
  {
    match: /change.*application question|custom.*application question|edit.*application question|different application question|application question.*change|can i change.*question/i,
    reply:
      'For Application based (Category Exclusivity) events, the application questions are fixed: (1) What industry are you in? and (2) What is your job title? These cannot be changed. For General ticketing, you can optionally turn on extra fields under Attendee information at booking on the tickets step — tick the boxes to note food is included, or to collect dietary or accessibility requirements at checkout.',
  },
  {
    match: /guest visit|complimentary visit|trial visit|visitor ticket|free trial visit|member ticket/i,
    reply:
      'Free trial visits: on Set up tickets, choose General ticketing or Application based, then pick how people book and turn on Free trial visits (1–3 per visitor). After visits, people need a ticket or monthly/annual membership. Allowance can apply to this organiser page only, or across all your organiser pages. Closed meeting (member list only, no visits) is under General when membership is on.',
  },
  {
    match: /how do i set up a members only ticket with the member (list|roster)/i,
    reply:
      'On the event tickets step, add a Members only ticket tier. It stays off the public event page. Upload your member list first at /organiser/member-roster (or group-edit → Manage member list) — name and email per member. When someone on that list signs in with their membership email, they see the member ticket automatically. No access codes.',
  },
  {
    match: /what is (a |the )?member (list|roster)|how does (the )?member (list|roster) work|explain.*member (list|roster)|member (list|roster) do/i,
    reply:
      'A Member list is your per-group list of members (name, email, optional expiry) at /organiser/#memberships. It unlocks Members only tickets — people on the list see those rates when signed in with their membership email; the public does not. Add members individually or import CSV, track who has signed up, and use reports for bookings and expiring memberships. You can collect dues through The Networker UK (monthly/annual prices on Memberships) or renew off-platform and update expiry dates.',
  },
  {
    match: /added (me|to my).*member (list|roster)|on (a|the) member (list|roster)|member (lists|rosters) in my hub|why.*member (list|roster) email|group added me/i,
    reply:
      'A networking group added your email to their member list so you can book member-only ticket rates. Sign in at /login with that exact email — the group appears under My account → My memberships (/account/#memberships). Open their event and you will see member tickets the public cannot.',
  },
  {
    match: /import.*(member|list|roster).*csv|csv.*member (list|roster)|upload.*member list|bulk.*member (list|roster)|import.*(spreadsheet|excel).*member/i,
    reply:
      'On /organiser/member-roster, use Import CSV — drop a spreadsheet saved as CSV from Excel or Google Sheets, or paste CSV text. Required column: email. Optional: name, expires (or membership expiry). Example row: jane@example.com,Jane Smith,2026-12-31. Max 5,000 rows / 512 KB per import. Invite emails are queued by default after import (untick to skip) — new accounts get a sign-up link; existing Accounts get a sign-in link. Sends gradually over about 2 hours.',
  },
  {
    match: /add.*(to|someone).*(member list|member roster|roster)|manage member (list|roster)|set up member (list|roster)|open member (list|roster)|where.*member (list|roster)/i,
    reply:
      'Open /organiser/member-roster?id=YOUR_GROUP_ID (or your organiser page → Manage member list). Add name and email, optionally set membership expiry, then Add to list. Use this list before or after adding a Members only ticket on your events.',
  },
  {
    match: /member.*(email|notif|alert).*event|email.*member.*(new )?event|notify.*member.*list|when.*(publish|add).*event.*member/i,
    reply:
      'When you publish an Approved event, people on that organiser page’s member list are queued for a daily digest — they can sign in with their membership email to see Members only tickets. Multiple new listings from the same group are bundled into one email. This is separate from the invite email sent when you first add someone to the list.',
  },
  {
    match: /membership expir|expiring membership|renew.*membership.*(list|roster)|(list|roster).*expir/i,
    reply:
      'Optional expiry dates on /organiser/#memberships flag memberships expiring soon in your reports. Groups can also bill monthly or annual dues through The Networker UK — set prices on Memberships, then members pay from the public Join section or My account → Memberships. Use Invite to pay (or bulk invite) for renewals; failed card payments show as Payment failed on the list.',
  },
  {
    match: /access code|private ticket|members? only ticket|member (list|roster) ticket|hidden ticket/i,
    reply:
      'Use a Members only ticket on the tickets step. It stays off the public event page; people on your member list see it automatically when they sign in with their membership email. Manage the list under Member list on your organiser page — there are no access codes.',
  },
  {
    match: /disallow guest|guest pass.*(off|disable|opt)|member.?only (date|event|evening)|no guest (pass|visit).*conference/i,
    reply:
      'On the tickets step, turn on Free trial visits, then tick “Pause free visits on this date only”. Paid member tickets stay available and visitors can book them directly — free visits are hidden for that date. Useful for conferences or closed evenings.',
  },
  {
    match: /name badge|printable badge|avery l?7160|avery l?7163|sticker sheet|badge pdf/i,
    reply:
      'Sign in → /organiser/ → Events → Attendees, then choose your sheet size (standard — 63.5 × 38.1 mm, 21 per sheet; or large — 99.1 × 38.1 mm, 14 per sheet) and click Export name badges (PDF). Each badge shows the guest’s name, company, and job title from their Account when set — ask attendees to update these in account settings before the event.',
  },
  {
    match: /job title.*(badge|profile|account)|update.*job title|company.*badge/i,
    reply:
      'Add your company and job title in account settings (/account/settings). They appear on printable name badges when organisers export them, and on organiser attendee lists. Category Exclusivity applicants also share industry and job title at application time.',
  },
  {
    match: /add.*(more than one|multiple).*(date|day)|multiple dates|recurring (event|meeting|series)|event series|repeat.*date/i,
    reply:
      'Use the calendar on the listing details step and click every date you want to include. All selected dates form one series and share the same UK start time, end time, venue or online link, and ticket tiers (Europe/London — the same clock time on every date, including when the clocks change). This suits recurring meetings on different weeks. If any session has a different time or location, create it as a separate listing instead.',
  },
  {
    match: /(start )?times? (change|changed|wrong|shift|shifted|jump|jumped)|hour (out|off|wrong)|clocks? (change|go back|go forward)|daylight saving|british summer|why.*(different|wrong).*time.*(date|series|recurring)|recurring.*time.*(wrong|change|hour)/i,
    reply:
      'Event times are always UK local time (Europe/London). On a multi-date series, the start and end time you set applies as the same clock time on every date — for example 10:15 stays 10:15 before and after the clocks change. If an older series shows a one-hour difference across autumn or spring (for example November an hour earlier than September), refresh My Events — the platform realigns those dates to the same UK wall-clock time automatically — or open Edit event, confirm the start time, and save again. Need a different time on one day? Create that session as its own listing.',
  },
  {
    match: /can i set different times|different (start )?times?.*(date|day|session)|same time every (date|day)/i,
    reply:
      'A multi-date series uses one UK start and end time for every selected date. You cannot set a different time per day on the same listing. If one session needs a different time, create it as a separate listing from My Events (you can reuse the same title).',
  },
  {
    match: /conference.*(pass|ticket|multi.?day|3 day|three day)|multi.?day conference|one ticket.*all (day|date)|full conference|delegate pass/i,
    reply:
      'For a multi-day conference, select every date on the calendar, then on the tickets step tick Full series pass on a tier — one price at checkout covers every day (e.g. £299 for all three days). Per-session tiers with the same price still work with Book all remaining dates (price × number of days). Different prices or schedules per day? Use separate listings.',
  },
  {
    match: /series pass|full series pass|one price.*all (date|day|session)/i,
    reply:
      'On a multi-date listing, tick Full series pass when adding a ticket tier — one checkout price covers every date in the series. Quantity caps how many passes you sell (not per-day seats). Per-session tiers with matching names and prices can still use Book all remaining dates instead.',
  },
  {
    match: /book all (date|day|session)|all remaining date|bundle checkout|checkout.*every date/i,
    reply:
      'When your listing has multiple dates with the same ticket price on each day, signed-in attendees see Book all remaining dates on the event page — one payment, registrations on every upcoming session they have not booked yet. Every tier must match by name and price on each date. Guest visit, alumni, member-only, and application tickets are excluded.',
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
      'Open /organiser/ → Events → Attendees. Each registration shows a visit count (1st visit, 2 visits, etc.) based on platform bookings with your organiser page — not annual membership records. Filter by new or returning, filter by event, and export a CSV with visit counts. Use this to welcome visitors and spot regulars.',
  },
  {
    match: /previous attendees?|alumni ticket|alumni rate|past attendee invite/i,
    reply:
      'Previous Attendees lets you invite past confirmed attendees to an exclusive returning ticket rate on a new event — ideal for annual conferences or repeat summits. Enable it on the event tickets step, set your previous attendee price, and send invites from the organiser dashboard. Only invited past attendees can book the returning ticket.',
  },
  {
    match: /email who attended|attendee list email|who else (was|attended)|share attendee (emails|list)|email.*who attended|email attendee list|attendee round-?up|who.?s going|who is going/i,
    reply:
      'Open Communicate under My events in the organiser sidebar. Before the event starts you can send “Who’s going” (confirmed bookings). After it starts, send “Who attended”. Untick anyone who did not attend — they are left off the round-up and marked as did not attend so they skip the review email. Add who the email is from and an optional note — your group logo is included. One free send per organiser page; extra sends are paid (£9 for 1, £22 for 3). Use the Analytics tab for opens and clicks.',
  },
  {
    match: /who (has |)(attended|registered|booked)|see (who|my) (attendee|registration|book)|view.*attendee|who is coming|attendee list|see registrations/i,
    reply:
      'Sign in and open /organiser/ → Events → Attendees. You will see everyone registered for your events — name, email, ticket type, visit count (1st visit vs returning), quantity, and booking date. Filter by event or by new vs returning, or click Download attendees CSV to export. After the event starts, use Didn’t attend on a row so that person does not get a review request — or untick them when you send the Attendee round-up; that marks them as did not attend too. After the event, use Attendee round-up (with one event selected) to share who attended with the other guests — no-shows are left off that list.',
  },
  {
    match: /organiser|organizer|dashboard|sell ticket|stripe onboard|payout/i,
    reply:
      'Sign in and open /organiser/ to create events, manage attendees, sell tickets, and list opportunities. Complete Stripe onboarding there for payouts. New groups: email hello@thenetworkeruk.com with your group name, format, and location.',
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
      'The Networker UK focuses on networking events and business opportunities. Browse events at /events/ or opportunities at /opportunities/. For seminars and learning-style meetups, filter the events directory by Seminar, Workshop or Masterclass.',
  },
  {
    match: /review|rating/i,
    reply:
      'Members can leave a review after each event they attend. After five event reviews they\'re recognised as a Top contributor in My account — that helps groups climb the monthly rankings. Sign in, visit My account or the group page, and follow the review option. Organisers can reply from their dashboard under Reviews — replies appear on the public group profile.',
  },
  {
    match: /organiser profile|networking group profile|\/organisers\//i,
    reply:
      'Organiser profiles show who runs a business networking community and their events. Find them from event pages or at /organisers/{slug}.',
  },
  {
    match: /privacy|cookie|gdpr|legal|terms|policy/i,
    reply:
      'Privacy, terms, refunds, cookies, and organiser terms: /legal-policies. Cookie preferences: Cookie settings in the site footer. Questions: hello@thenetworkeruk.com.',
  },
  {
    match: /what is (the )?networker|about (the )?hub/i,
    reply:
      'The Networker UK is a UK platform for networking events, exhibitions, and business opportunities — run by Rosie and Catherine at The Networker Group Ltd. Browse free; create a free account when you are ready to book or enquire. /about · /faq',
  },
  {
    match: /contact|support|email|phone|address|where are you/i,
    reply:
      'Email hello@thenetworkeruk.com. Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF. For booking issues include your event name and order reference. Chat with me on /contact.',
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
    'The user is on the event listing details step (title, type, description, photo with drag-to-reposition crop, location, dates). Answer listing-setup questions from your organiser knowledge. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'event-location':
    'The user is on the event location step (venue address, postcode, or online join link). Help with in-person vs online setup, venue fields, and what appears on the public listing. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'event-tickets':
    'The user is on the ticket setup step. Two attendance modes: Ticket types (open booking) or Category Exclusivity. Guest visit programme is an optional checkbox on both modes (under Optional extras). On Category Exclusivity you can also set an optional Member price for people on your membership list. Previous Attendees is optional. Members only tickets use the Member list. Answer organiser ticketing questions. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'event-review':
    'The user is on the publish review step before their event goes live. Explain what happens on publish, approval timing, and what they can still edit. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'member-roster':
    'The user is managing a Member list for their networking group. Explain what the list is, how to add or import members, optional expiry dates, invite emails, Members only tickets, and the reports on this page. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'group-edit':
    'The user is editing their organiser page. Answer organiser-page questions about logo, description, guest visit limit, and contact details. Do NOT list browse-page events unless they explicitly ask to find events to attend.',
  'organiser-dashboard':
    'The user is on the organiser dashboard. Answer questions about claiming their page, groups, events, attendees, revenue, payouts, business opportunity listings, and team invites. Team editors can manage events and view revenue but cannot invite others or delete events; up to 100 editors per account. Do NOT list browse-page events or public opportunity listings unless they explicitly ask.',
  guides:
    'The user is on the organiser guides / onboarding checklist page. Give concise answers (about 2 sentences) with direct links to /organiser/ routes, guide pages under /guides/, or specific dashboard sections. Focus on organiser setup tasks like listing events, Stripe, CSV export, team invites, and business opportunities.',
  opportunities:
    'The user is browsing business opportunities at /opportunities/. Help them find franchises, partnerships, side hustles, and deals — use LIVE OPPORTUNITY LOOKUP when they ask discovery questions. Explain saving listings (heart icon), search alerts, compare (up to 3), and sending enquiries (free account required). For listing an opportunity as an organiser, direct them to /guides/list-a-business-opportunity or /organiser/ → Business opportunities.',
};

const ORGANISER_PAGE_KEYS = Object.keys(ORGANISER_PAGE_CONTEXT);

function buildPageContextAddendum(pageContext) {
  const key = String(pageContext || '').trim();
  if (!key || !ORGANISER_PAGE_CONTEXT[key]) return '';
  return '\n\nPAGE CONTEXT: ' + ORGANISER_PAGE_CONTEXT[key];
}

function buildOrganiserContextAddendum(pageContext) {
  return buildPageContextAddendum(pageContext);
}

function matchedFallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) return null;
  for (var i = 0; i < FALLBACK_REPLIES.length; i++) {
    if (FALLBACK_REPLIES[i].match.test(text)) return FALLBACK_REPLIES[i].reply;
  }
  return null;
}

function applyGentlemanTone(reply) {
  const text = String(reply || '').trim();
  if (!text) return text;
  if (
    /^(Good (morning|afternoon|evening|day)|Allow me|I'm afraid|Certainly\.|Indeed\.|Delighted|Very good|Thank you for your enquiry|A pleasure|Good afternoon —)/i.test(
      text
    )
  ) {
    return text;
  }

  const replacements = [
    [/^Yes —/i, 'Yes, indeed —'],
    [/^Yes,/i, 'Yes, indeed —'],
    [/^No —/i, "I'm afraid not —"],
    [/^I've checked our live listings and couldn't find upcoming events/i, "I've checked our live listings, and I'm afraid there aren't any upcoming events"],
    [/^I couldn't find upcoming events matching that/i, "I'm afraid I couldn't find upcoming events matching that"],
    [/^I couldn't find published business opportunities/i, "I'm afraid I couldn't find published business opportunities"],
    [/^Here are upcoming events/i, 'Allow me to share a few upcoming events'],
    [/^Here are some upcoming events/i, 'Allow me to share a few upcoming events'],
    [/^Here are some business opportunities/i, 'Allow me to highlight a few business opportunities'],
    [/^Thank you for your message/i, 'Thank you for your enquiry'],
  ];

  for (let i = 0; i < replacements.length; i++) {
    if (replacements[i][0].test(text)) {
      return text.replace(replacements[i][0], replacements[i][1]);
    }
  }

  if (!text.includes('\n') && text.length > 48) {
    return 'Certainly. ' + text.charAt(0).toLowerCase() + text.slice(1);
  }
  return text;
}

function buildOrganiserContextAddendum(pageContext) {
  const key = String(pageContext || '').trim();
  if (!key || !ORGANISER_PAGE_CONTEXT[key]) return '';
  return '\n\nORGANISER LISTING CONTEXT: ' + ORGANISER_PAGE_CONTEXT[key];
}

function fallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) {
    return applyGentlemanTone(
      "Good afternoon. I'm " +
        ASSISTANT_NAME +
        ", at your service on The Networker UK. How may I assist you today — finding events or opportunities, booking tickets, or getting started as an organiser?"
    );
  }
  const matched = matchedFallbackReply(text);
  if (matched) return applyGentlemanTone(matched);
  return applyGentlemanTone(
    "Thank you for your enquiry. I'm afraid I don't have quite enough detail to answer that precisely — do email hello@thenetworkeruk.com, or browse our FAQ at /faq. " +
      "Otherwise, ask me about events, business opportunities, tickets, accounts, or organiser tools and I'll do my best to help."
  );
}

module.exports = {
  ASSISTANT_NAME,
  ASSISTANT_ROLE,
  HUBERT_VOICE_GUIDE,
  KNOWLEDGE_SECTIONS,
  KNOWLEDGE_BASE,
  SYSTEM_PROMPT,
  FALLBACK_REPLIES,
  ORGANISER_PAGE_CONTEXT,
  ORGANISER_PAGE_KEYS,
  matchedFallbackReply,
  applyGentlemanTone,
  buildPageContextAddendum,
  buildOrganiserContextAddendum,
  fallbackReply,
};
