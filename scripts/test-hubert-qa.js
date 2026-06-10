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
  { q: 'What is The Academy?', expect: /Academy|training|coming soon/i },
  { q: 'How do I save an event?', expect: /favourit|account/i },
  { q: 'How do I leave a review?', expect: /review/i },
  { q: 'Who runs this site?', expect: /Networker Group|Rosie|Pip/i },
  { q: 'Can I add a guest when booking?', expect: /guest/i },
  { q: 'The organiser cancelled my event', expect: /full refund|cancelled/i },
  { q: 'My Stripe payment failed', expect: /payment|checkout|hello@/i },
  { q: 'Is this site free?', expect: /browsing.*free|free/i },
  { q: 'What is Hubert?', expect: /butler|concierge/i },
  { q: 'How do I contact support?', expect: /hello@/i },
  { q: 'Cookie policy', expect: /legal-policies|cookie/i },
  { q: 'I want to list a franchise opportunity', expect: /list.*opportunit|\/opportunities\/list/i },
  { q: "I tried to add my event but it doesn't show on the browse events page", expect: /Published|Draft|Approved|\/organiser\//i },
  { q: 'How can I advertise my business on the site?', expect: /sales@|Sponsor|sponsor/i },
  { q: 'What does Rosie do?', expect: /co-founder|Rosie/i },
  { q: 'What does Pip do?', expect: /co-founder|Pip|Catherine/i },
  { q: 'Why did the networker hub start?', expect: /right room|careers|companies|mission/i },
  { q: 'How much does The Networker Hub make per ticket?', expect: /4\.5%|3%|booking fee|platform fee/i },
  { q: 'How can I download the attendees for my next event', expect: /Attendees|CSV|\/organiser\//i },
  { q: 'How long between payouts for my event? Can I get it instantly?', expect: /7.day|not instant|settlement|Stripe/i },
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
