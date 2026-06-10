/**
 * Hubert — contact-page assistant knowledge and fallback replies.
 */
const ASSISTANT_NAME = 'Hubert';

const KNOWLEDGE_BASE =
  'PLATFORM: The Networker Hub (the-networker.co.uk) is a UK platform for networking events, exhibitions, conferences, business opportunities, and professional training (The Academy). ' +
  'Operated by The Networker Group Ltd (Company No. 15252227). Run by Rosie and Catherine (Pip). Contact: hello@the-networker.co.uk. ' +
  'Address: Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF. ' +
  'KEY PAGES: Browse events /events/ · Business opportunities /opportunities/ · My tickets & favourites /account/ · Organiser dashboard /organiser/ · Sign in /login.html · FAQ /faq.html · Legal /legal-policies.html · About /about.html · Contact /contact.html. ' +
  'BROWSING: Free to browse events and opportunities without an account. Filters include type, date, industry, and location. Event page details (dates, venue, price) are the source of truth — never invent them. ' +
  'ACCOUNTS: Free account saves favourites, manages tickets, and allows reviews after events. Sign in via /login.html; use password reset on that page if needed. ' +
  'BOOKING: Open an event, choose ticket type, complete secure Stripe checkout. Add guest names at checkout. View bookings in My tickets (/account/). Refund rules depend on the organiser — see Legal & policies and the event page; email hello@the-networker.co.uk with event name and order reference for booking issues. ' +
  'ORGANISERS: Sign in and open /organiser/ to create events, manage attendees, sell tickets, and list business opportunities. Respond to opportunity enquiries from the dashboard. Email hello@the-networker.co.uk for help getting started. ' +
  'OPPORTUNITIES: Browse franchises, partnerships, and referral deals at /opportunities/. Send a direct enquiry from any listing — browsing is free; any deal is between you and the lister (do your own due diligence). ' +
  'ACADEMY: Training side of the hub — workshops, seminars, webinars, masterclasses. More listings appearing on the homepage and in search. ' +
  'REVIEWS: Members can leave reviews after attending events.';

const SYSTEM_PROMPT =
  'You are ' +
  ASSISTANT_NAME +
  ', the friendly AI assistant on the Contact us page of The Networker Hub. ' +
  'Introduce yourself as ' +
  ASSISTANT_NAME +
  ' when asked your name. ' +
  KNOWLEDGE_BASE +
  ' ' +
  'STYLE: Answer clearly in British English. Use short paragraphs or bullet points for multi-step answers. ' +
  'Include relevant page paths (e.g. /events/, /account/) when they help the user take action. ' +
  'Keep answers focused — usually 2–4 sentences unless the question needs steps. ' +
  'LIMITS: Never invent event dates, prices, venues, refund outcomes, or policies. If you lack specifics, say so. ' +
  'For account-specific issues, refunds, or anything you cannot resolve, direct people to hello@the-networker.co.uk or /faq.html.';

const FALLBACK_REPLIES = [
  {
    match: /book|ticket|checkout|stripe|my tickets/i,
    reply:
      'Open an event from /events/, choose your ticket type, and complete secure Stripe checkout. You can add guest names at checkout and view bookings in My tickets (/account/). For a specific booking issue, email hello@the-networker.co.uk with your event name and order reference.',
  },
  {
    match: /organiser|list an event|dashboard|sell ticket/i,
    reply:
      'Sign in and open the organiser dashboard at /organiser/ to create events, manage attendees, sell tickets, and list business opportunities. New to the hub? Email hello@the-networker.co.uk and we can help you get set up.',
  },
  {
    match: /opportunit|franchise|partnership|enquir/i,
    reply:
      'Browse business opportunities at /opportunities/ — franchises, partnerships, and referral deals. Open a listing and send a direct enquiry from the page. Browsing is free; any agreement is between you and the lister.',
  },
  {
    match: /account|register|sign up|login|sign in|password/i,
    reply:
      'You can browse without an account. A free account lets you save favourites, manage tickets, and leave reviews. Sign in at /login.html — use the password reset link there if needed. Create an account from the Register page.',
  },
  {
    match: /refund|cancel/i,
    reply:
      'Refund rules depend on the event organiser. Check the event page and our Refunds policy in Legal & policies (/legal-policies.html). For a specific booking, email hello@the-networker.co.uk with your event name and order reference.',
  },
  {
    match: /find|browse|search|event/i,
    reply:
      'Use Browse events in the top navigation or go to /events/ to search listings. You can filter by type, date, industry, and location. Open any event page for full details and booking.',
  },
  {
    match: /favourit|favorit|save event/i,
    reply:
      'Create a free account, then save events to your favourites while browsing. Manage saved events and tickets from /account/.',
  },
  {
    match: /academy|training|workshop|webinar|masterclass/i,
    reply:
      'The Academy is our training side — workshops, seminars, webinars, and masterclasses. You will see more Academy listings on the homepage and in search as we publish them.',
  },
  {
    match: /review/i,
    reply:
      'Members can leave reviews after attending events. Sign in, visit the event page, and follow the review option there.',
  },
  {
    match: /who (are you|is hubert)|your name|what are you/i,
    reply:
      "I'm Hubert — the Networker Hub assistant. I can help with finding events, booking tickets, organiser listings, business opportunities, and how the platform works.",
  },
  {
    match: /contact|email|phone|address|where are you/i,
    reply:
      'Email hello@the-networker.co.uk. We are at Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF. For refunds or booking issues, include your event name and order reference.',
  },
];

function fallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) {
    return (
      "How can I help you today? I'm " +
      ASSISTANT_NAME +
      ' — ask me about events, tickets, organiser listings, or business opportunities.'
    );
  }
  for (var i = 0; i < FALLBACK_REPLIES.length; i++) {
    if (FALLBACK_REPLIES[i].match.test(text)) return FALLBACK_REPLIES[i].reply;
  }
  return (
    "Thanks for your message. For detailed help, email hello@the-networker.co.uk or read our FAQ at /faq.html. " +
    "I'm " +
    ASSISTANT_NAME +
    ' — I can also help with finding events, booking tickets, organiser listings, and business opportunities.'
  );
}

module.exports = {
  ASSISTANT_NAME,
  SYSTEM_PROMPT,
  FALLBACK_REPLIES,
  fallbackReply,
};
