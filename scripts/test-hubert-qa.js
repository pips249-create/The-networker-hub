#!/usr/bin/env node
/**
 * Run member-question checks against Hubert fallback replies.
 * Usage: node scripts/test-hubert-qa.js
 */
const { fallbackReply } = require('../api/_lib/hubert-knowledge');

const MEMBER_QUESTIONS = [
  { q: 'Do I need an account to browse?', expect: /free|browse/i },
  { q: 'How do I book a ticket?', expect: /register|Stripe|checkout/i },
  { q: 'I forgot my password', expect: /password reset|login/i },
  { q: 'Can I get a refund?', expect: /organiser|refund/i },
  { q: 'Can I transfer my ticket to a colleague?', expect: /transfer|organiser/i },
  { q: 'What events are in Manchester?', expect: /Manchester|\/events\//i },
  { q: 'Are there any free networking events?', expect: /free.*event|\/events\//i },
  { q: 'How do I list my networking group?', expect: /organiser|hello@/i },
  { q: 'How much does it cost to list an event?', expect: /fee|free|organiser/i },
  { q: 'What are business opportunities?', expect: /\/opportunities\//i },
  { q: 'How do I enquire about a franchise?', expect: /enquir|account|\/opportunities\//i },
  { q: "I didn't get my booking confirmation email", expect: /email|spam|hello@/i },
  { q: 'How do I cancel my booking?', expect: /cancel|organiser|refund/i },
  { q: 'What is training on The Networker Hub?', expect: /events|opportunities|focuses/i },
  { q: 'How do I save an event?', expect: /favourit|account/i },
  { q: 'How do I leave a review?', expect: /review/i },
  { q: 'Who runs this site?', expect: /Networker Group|Rosie|Catherine/i },
  { q: 'Can I add a guest when booking?', expect: /guest/i },
  { q: 'The organiser cancelled my event', expect: /full refund|cancelled/i },
  { q: 'My Stripe payment failed', expect: /payment|checkout|hello@/i },
  { q: 'Is this site free?', expect: /browsing.*free|free/i },
  { q: 'What is Hubert?', expect: /butler|concierge/i },
  { q: 'How do I contact support?', expect: /hello@/i },
  { q: 'Cookie policy', expect: /legal-policies|cookie/i },
  { q: 'I want to list a franchise opportunity', expect: /list.*opportunit|\/opportunities\/list/i },
  { q: "I tried to add my event but it doesn't show on the browse events page", expect: /Published|Draft|Approved|\/organiser\//i },
  { q: 'How can I advertise my business on the site?', expect: /rosie@|Sponsor|sponsor/i },
  { q: 'What does Rosie do?', expect: /co-founder|Rosie/i },
  { q: 'What does Catherine do?', expect: /co-founder|Catherine/i },
  { q: 'Why did the networker hub start?', expect: /right room|careers|companies|mission/i },
  { q: 'How much does The Networker Hub make per ticket?', expect: /4\.5%|booking fee|platform and payment/i },
  { q: 'How can I download the attendees for my next event', expect: /Attendees|CSV|\/organiser\//i },
  { q: 'How long between payouts for my event? Can I get it instantly?', expect: /7.day|not instant|settlement|Stripe/i },
  { q: 'What is the difference between an event and a meeting?', expect: /browse filter|Meeting covers|regular networking/i },
  { q: 'My event image is too small', expect: /1200|landscape|recentre/i },
  { q: 'My event image is too big', expect: /2MB|compress|URL/i },
  { q: "I've accidentally added an extra date — how do I remove it?", expect: /click.*highlighted|deselect|calendar/i },
  {
    q: 'I have 3 events with the same name but different start times',
    expect: /separate listing|different time|My Events/i,
  },
  { q: 'What is Category Exclusivity?', expect: /application|industry|job title|approve/i },
  { q: 'Can I change the application questions asked?', expect: /fixed|cannot be changed|industry/i },
  {
    q: 'Can I create a paid ticket as well as offering guest visit tickets?',
    expect: /Yes.*enable(?: the)? guest visit programme.*paid/is,
  },
  {
    q: 'What is the difference between ticket types, guest visit programme, and Category Exclusivity?',
    expect: /Ticket types.*Category Exclusivity.*optional add-on/is,
  },
  { q: 'My event photo is cropped badly on the listing — how do I fix it?', expect: /drag.*preview|recentre|1200/i },
  { q: 'How do I print name badges for my event?', expect: /Attendees.*badge|Avery 7160/i },
  { q: 'Can I save business opportunities to review later?', expect: /My Hub|Saved Opportunities/i },
  { q: 'How do I get alerts when new opportunities match my search?', expect: /saved search|email alert/i },
  { q: 'How do I add more than one date to a recurring event series?', expect: /calendar|selected dates|series/i },
  { q: 'How do I set up early bird ticket pricing?', expect: /ticket tier|lower price|sales end date/i },
  { q: 'Should VAT be included in my ticket price or added at checkout?', expect: /VAT included|added at checkout/i },
  { q: 'Can I save tickets as draft before publishing my event?', expect: /Save as draft|publish/i },
  { q: 'How can I see who has attended my event?', expect: /Attendees|registered|\/organiser\//i },
  { q: 'What do I fill in after choosing the event format?', expect: /listing details|title|tickets/i },
  { q: 'What should I write in my event description?', expect: /who the event is for|keywords|filter/i },
  { q: 'What is a member list?', expect: /Member list|members only|\/organiser\/member-roster/i },
  {
    q: 'How do I set up a members only ticket with the member list?',
    expect: /Members only ticket|member list|no access codes/i,
  },
  { q: 'How do I import my member list as CSV?', expect: /Import CSV|email.*required|expires/i },
  {
    q: 'A networking group added me to their member list — what does that mean?',
    expect: /member-only|\/account\/|sign in|My groups/i,
  },
];

let failed = 0;
MEMBER_QUESTIONS.forEach(function (item) {
  const reply = fallbackReply(item.q);
  const ok = item.expect.test(reply);
  if (!ok) {
    failed++;
    console.log('FAIL:', item.q);
    console.log('  Got:', reply.slice(0, 140) + (reply.length > 140 ? '...' : ''));
    console.log('');
  }
});

console.log(
  failed
    ? failed + ' of ' + MEMBER_QUESTIONS.length + ' checks failed'
    : 'All ' + MEMBER_QUESTIONS.length + ' member questions passed'
);
process.exit(failed ? 1 : 0);
