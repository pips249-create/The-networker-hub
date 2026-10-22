/**
 * Weekly Hubert Event Concierge cadence + Meet Rosie promo helpers.
 * Run: node scripts/test-hubert-weekly-concierge.js
 */
const {
  isDueForHubertConcierge,
  hubertConciergeWeekLabel,
  buildMeetRosieSectionHtml,
  HUBERT_CONCIERGE_INTERVAL_DAYS,
} = require('../api/_lib/hubert-event-concierge');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
  console.log('ok:', msg);
}

assert(HUBERT_CONCIERGE_INTERVAL_DAYS === 7, 'weekly interval is 7 days');

const now = new Date('2026-10-22T12:00:00Z');
assert(isDueForHubertConcierge(null, now) === true, 'never-sent is due');
assert(
  isDueForHubertConcierge('2026-10-22T10:00:00Z', now) === false,
  'same-day send is not due'
);
assert(
  isDueForHubertConcierge('2026-10-15T12:00:00Z', now) === true,
  '7 days ago is due'
);
assert(
  isDueForHubertConcierge('2026-10-16T12:00:01Z', now) === false,
  'just under 7 days is not due'
);

const weekLabel = hubertConciergeWeekLabel(now);
assert(weekLabel === '19 October 2026', 'week label is Monday of that UTC week: ' + weekLabel);

const promo = buildMeetRosieSectionHtml('https://www.thenetworkeruk.com', now);
assert(/Meet Rosie \(the co-founder\) at The MarTech Summit/.test(promo), 'promo headline present');
assert(
  /the-martech-summit-london-2026/.test(promo),
  'promo links to MarTech Summit event page'
);
assert(/about-rosie\.png/.test(promo), 'promo includes Rosie photo');

const afterSummit = buildMeetRosieSectionHtml(
  'https://www.thenetworkeruk.com',
  new Date('2026-11-13T00:00:00Z')
);
assert(afterSummit === '', 'promo hidden after summit weekend');

console.log('All Hubert weekly concierge checks passed');
