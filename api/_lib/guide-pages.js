/**
 * Organiser how-to guides — SEO/AEO source for HowTo + BreadcrumbList schema.
 */
const GUIDE_PAGES = {
  'list-an-event': {
    path: '/guides/list-an-event',
    title: 'List an event – How-to guides – The Networker Hub',
    description:
      'Step-by-step guide for organisers: create your organiser page, add event details, set up tickets, connect Stripe, and publish on The Networker Hub.',
    name: 'List an event',
    howToName: 'How to list an event on The Networker Hub',
    steps: [
      { id: 'sign-in', name: 'Sign in to the organiser dashboard', text: 'Sign in and open the organiser dashboard at /organiser/. If your networking group is already listed, search the organiser directory and claim your page when prompted.' },
      { id: 'organiser-page', name: 'Create or update your organiser page', text: 'Under Organiser pages, add your public group profile: name, logo, description, contact email, and social links.' },
      { id: 'new-event', name: 'Start a new event listing', text: 'From My events, choose List event. Add title, event type, description, cover photo, format (in person, online, or hybrid), venue, and dates.' },
      { id: 'tickets', name: 'Set up tickets', text: 'Choose standard tickets, guest visit programme, Category Exclusivity, or Previous Attendees. Set prices, quantities, VAT if applicable, and your refund policy.' },
      { id: 'stripe', name: 'Connect Stripe for paid tickets', text: 'For paid events, complete Connect Stripe under Revenue so ticket money reaches your bank account. Free events do not require Stripe.' },
      { id: 'publish', name: 'Publish', text: 'When details and tickets are complete, publish the event. Once Published, Approved, linked to a published organiser page, and has ticket types, it appears on Browse events.' },
      { id: 'manage-bookings', name: 'Manage bookings after publish', text: 'Use the dashboard to view attendees, revenue and payout status, reviews, and handle cancellations or refunds.' },
    ],
  },
  'list-a-conference-or-exhibition': {
    path: '/guides/list-a-conference-or-exhibition',
    title: 'List a conference or exhibition – How-to guides – The Networker Hub',
    description:
      'Guide for organisers listing conferences, exhibitions, awards dinners and summits on The Networker Hub — free listings, optional paid tickets, and visibility.',
    name: 'List a conference or exhibition',
    howToName: 'How to list a conference or exhibition on The Networker Hub',
    steps: [
      { id: 'organiser-page', name: 'Claim or create your organiser page', text: 'Sign in to the organiser dashboard. If your group or exhibition brand is already listed, confirm the claim prompt. Otherwise create an organiser page with logo, description, and contact email.' },
      { id: 'new-listing', name: 'Start a new listing', text: 'From the dashboard choose Add new → Event. Pick your organiser page, set format, venue, and dates. For a recurring series or multi-day conference with the same schedule each day, select every date on the calendar.' },
      { id: 'event-type', name: 'Choose Conference or Exhibition', text: 'On the event details step, set Event type to Conference or Exhibition so attendees can filter you on Browse events.' },
      { id: 'tickets', name: 'Set up tickets (free or paid)', text: 'Add delegate ticket tiers (early bird, standard, VIP, or free registration). For one admission price covering every day, tick Full series pass on that tier. For the same per-session price on each day, leave it unchecked — attendees can book all remaining dates in one checkout. Paid tickets require Connect Stripe under Revenue.' },
      { id: 'publish', name: 'Publish and promote', text: 'Publish when details, tickets, VAT if applicable, and refund policy are complete. Optional Premium Spotlight adds extra visibility on the browse page.' },
    ],
  },
  'list-a-business-opportunity': {
    path: '/guides/list-a-business-opportunity',
    title: 'List a business opportunity – How-to guides – The Networker Hub',
    description:
      'How organisers list a business opportunity on The Networker Hub — create a listing, submit for review, and manage enquiries.',
    name: 'List a business opportunity',
    howToName: 'How to list a business opportunity on The Networker Hub',
    steps: [
      { id: 'dashboard', name: 'Open the organiser dashboard', text: 'Sign in and go to Business opportunities in the sidebar. You need an organiser account — the same workspace you use for events.' },
      { id: 'new-listing', name: 'Start a new listing', text: 'Choose List a listing. Review how listings work, pricing, and what happens after submission, then open the listing form.' },
      { id: 'listing-form', name: 'Complete the listing form', text: 'Add title, opportunity type, summary, description, investment notes, location, industry, images, and contact details. Listings are reviewed before going live.' },
      { id: 'submit', name: 'Submit for review', text: 'Submit the listing. You receive email updates when it is approved, live, or if changes are needed.' },
      { id: 'premium', name: 'Optional: premium placement', text: 'Featured carousel slots may be available for extra visibility on the opportunities browse page after submission.' },
      { id: 'enquiries', name: 'Manage enquiries', text: 'When someone enquires, you receive an email notification. Reply directly to the prospect and track enquiries from Business opportunities in the dashboard.' },
      { id: 'renew', name: 'Renew or update', text: 'Listings run for a set period. Renew or edit from your dashboard before expiry to stay visible on Browse opportunities.' },
    ],
  },
  'invite-your-team': {
    path: '/guides/invite-your-team',
    title: 'Invite your team – How-to guides – The Networker Hub',
    description:
      'How to invite editor team members to your organiser workspace on The Networker Hub — permissions, limits, and accept flow.',
    name: 'Invite editors',
    howToName: 'How to invite editors to your organiser workspace on The Networker Hub',
    steps: [
      { id: 'who-can-invite', name: 'Who can invite', text: 'Only the account owner can send or remove team invites. Editors can see the team list but cannot invite others.' },
      { id: 'send-invite', name: 'Send an invite', text: 'In the organiser dashboard, open Team & invites. Click Invite team member, enter their email, and send. You can invite up to 10 editors per organiser account.' },
      { id: 'accept', name: 'They accept by signing in', text: 'Your colleague opens the email and signs in with that exact email address. Once signed in, their status changes to Active on your team list.' },
      { id: 'permissions', name: 'What editors can do', text: 'Editors can view all networking groups, create and edit events and tickets, view revenue and registrations, and manage business opportunity listings.' },
      { id: 'restrictions', name: 'What editors cannot do', text: 'Editors cannot invite or remove team members or delete events. Access is account-wide across every group on your organiser account.' },
      { id: 'remove', name: 'Remove someone', text: 'From the team table, choose Remove next to an editor or resend a pending invite if they did not receive the email.' },
    ],
  },
};

const GUIDES_HUB = {
  path: '/guides',
  title: 'Organiser guides – The Networker Hub',
  description:
    'Step-by-step onboarding checklists for organisers — list events, publish business opportunities, and invite team editors on The Networker Hub.',
  name: 'Organiser guides',
};

function getGuidePageKeys() {
  return Object.keys(GUIDE_PAGES);
}

function getGuidePageConfig(key) {
  return GUIDE_PAGES[String(key || '')] || null;
}

function guideSchemaKey(guideKey) {
  return 'guide-' + guideKey;
}

module.exports = {
  GUIDE_PAGES,
  GUIDES_HUB,
  getGuidePageKeys,
  getGuidePageConfig,
  guideSchemaKey,
};
