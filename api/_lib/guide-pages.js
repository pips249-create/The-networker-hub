/**
 * Organiser how-to guides — SEO/AEO source for HowTo + BreadcrumbList schema.
 */
const GUIDE_PAGES = {
  'list-an-event': {
    path: '/guides/list-an-event',
    title: 'List an event – How-to guides – The Networker UK',
    description:
      'Start listing events on The Networker UK — sign in to the organiser dashboard for a guided setup checklist and Hubert walkthrough.',
    name: 'List an event',
    howToName: 'How to list an event on The Networker UK',
    steps: [
      { id: 'sign-in', name: 'Sign in to the organiser dashboard', text: 'Sign in and open the organiser dashboard at /organiser/. If your networking group is already listed, search the organiser directory and claim your page when prompted.' },
      { id: 'organiser-page', name: 'Create or claim your organiser page', text: 'Follow the setup checklist on Overview — add your public group profile or confirm the claim prompt for an existing page.' },
      { id: 'membership', name: 'Optional: set up membership', text: 'Upload your member register if you sell members-only tickets or track renewals. Skip this step if you only need open booking.' },
      { id: 'list-event', name: 'List your event in the dashboard', text: 'Choose List event from My events. Hubert walks you through format, details, tickets, and publish. For paid tickets, connect Stripe under the Revenue tab before publishing.' },
    ],
  },
  'list-a-conference-or-exhibition': {
    path: '/guides/list-a-conference-or-exhibition',
    title: 'List a conference or exhibition – How-to guides – The Networker UK',
    description:
      'Guide for organisers listing conferences, exhibitions, awards dinners and summits on The Networker UK — free listings, optional paid tickets, and visibility.',
    name: 'List a conference or exhibition',
    howToName: 'How to list a conference or exhibition on The Networker UK',
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
    title: 'List a business opportunity – How-to guides – The Networker UK',
    description:
      'How organisers list a business opportunity on The Networker UK — create a listing, submit for review, and manage enquiries.',
    name: 'List a business opportunity',
    howToName: 'How to list a business opportunity on The Networker UK',
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
    title: 'Invite team members – How-to guides – The Networker UK',
    description:
      'How to invite team members to your organiser workspace on The Networker UK — permissions, group access, limits, and accept flow.',
    name: 'Invite team members',
    howToName: 'How to invite team members to your organiser workspace on The Networker UK',
    steps: [
      { id: 'who-can-invite', name: 'Who can invite', text: 'Only the account owner can send or remove team invites. Team members can see the team list but cannot invite others.' },
      { id: 'send-invite', name: 'Send an invite', text: 'In the organiser dashboard, open Team & invites. Click Invite team member, enter their email, choose All groups or specific networking groups, and send. You can invite up to 100 team members per organiser account.' },
      { id: 'accept', name: 'They accept by signing in', text: 'Your colleague opens the email and signs in with that exact email address. Once signed in, their status changes to Active on your team list.' },
      { id: 'permissions', name: 'What team members can do', text: 'Team members can view assigned networking groups, create and edit events and tickets, view revenue and registrations, and manage business opportunity listings.' },
      { id: 'restrictions', name: 'What team members cannot do', text: 'Team members cannot invite or remove colleagues, create new networking groups, add bank details, request payouts, or delete events.' },
      { id: 'remove', name: 'Remove someone', text: 'From the team table, choose Remove next to a team member or resend a pending invite if they did not receive the email.' },
    ],
  },
  'claim-your-organiser-page': {
    path: '/guides/claim-your-organiser-page',
    title: 'Claim your organiser page – How-to guides – The Networker UK',
    description:
      'How to find and claim your networking group on The Networker UK — verify ownership, update your profile, and start listing events.',
    name: 'Claim your organiser page',
    howToName: 'How to claim your organiser page on The Networker UK',
    steps: [
      { id: 'find-page', name: 'Find your group in the directory', text: 'Browse organisers on /events/ or search your group name. Many UK networking groups already have a page from the legacy Networker directory.' },
      { id: 'sign-in', name: 'Sign in with the right email', text: 'Sign in or create an account using the email address linked to your group. When it matches, a claim prompt appears automatically on your organiser dashboard. Email changed? Find your group on /events/ and use Request access on its profile page.' },
      { id: 'confirm-claim', name: 'Confirm the claim', text: 'Follow the claim prompt on Overview in the organiser dashboard. Review the existing profile details and confirm you represent this group. No prompt? Use Request access on your group profile or email hello@thenetworkeruk.com.' },
      { id: 'update-profile', name: 'Update your public profile', text: 'Add or refresh your logo, description, contact email, social links, and guest visit settings on your organiser page.' },
      { id: 'next-steps', name: 'List your next event', text: 'From My events choose List event, or open the getting started checklist on Overview. Connect Stripe under Revenue before publishing paid tickets.' },
    ],
  },
  'export-attendees-and-visits': {
    path: '/guides/export-attendees-and-visits',
    title: 'Export attendees & track visits – How-to guides – The Networker UK',
    description:
      'How to download attendee lists, filter by visit count, export name badges, and use the guest visit programme on The Networker UK.',
    name: 'Export attendees & track visits',
    howToName: 'How to export attendees and track visits on The Networker UK',
    steps: [
      { id: 'open-attendees', name: 'Open the attendee list', text: 'Sign in to the organiser dashboard and go to Events → Attendees. Pick a networking group and event, or view all upcoming registrations.' },
      { id: 'visit-tracking', name: 'See visit counts', text: 'Each attendee shows their visit count (1st visit, 2 visits, returning member, etc.). Filter by new or returning to focus on guests vs members.' },
      { id: 'export-csv', name: 'Download attendees CSV', text: 'Apply filters if needed, then click Download attendees CSV. The export includes names, companies, ticket types, visit counts, and dietary notes where collected.' },
      { id: 'name-badges', name: 'Print name badges', text: 'From the same screen, export printable name badges (PDF for standard A4 sticker sheets). Badges use each guest name, company, and job title from their Hub account when set.' },
      { id: 'guest-visits', name: 'Set up the guest visit programme', text: 'On the event tickets step, tick Enable guest visit programme to offer complimentary trial visits before paid member tickets. Configure visit limits on your organiser page.' },
    ],
  },
};

const GUIDES_HUB = {
  path: '/guides',
  title: 'Organiser guides – The Networker UK',
  description:
    'Step-by-step onboarding checklists for organisers — list events, publish business opportunities, invite team members, and manage attendees on The Networker UK.',
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
