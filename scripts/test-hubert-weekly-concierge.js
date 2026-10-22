/**
 * Weekly Hubert Event Concierge cadence + alternating Meet Rosie / Catherine promos.
 * Run: node scripts/test-hubert-weekly-concierge.js
 */
const {
  isDueForHubertConcierge,
  hubertConciergeWeekLabel,
  buildMeetTeamSectionHtml,
  pickCofounderPromo,
  utcIsoWeekNumber,
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

const weekNum = utcIsoWeekNumber(now);
assert(typeof weekNum === 'number' && weekNum > 0, 'ISO week number computed: ' + weekNum);

// 19 Oct 2026 Monday → even week → Rosie; force odd week via +7 days → Catherine
const evenWeekDate = now;
const oddWeekDate = new Date('2026-10-26T12:00:00Z'); // Monday 26 Oct
const evenPromo = pickCofounderPromo(evenWeekDate);
const oddPromo = pickCofounderPromo(oddWeekDate);
assert(evenPromo && evenPromo.id === 'rosie_martech', 'even week picks Rosie @ MarTech');
assert(
  oddPromo && oddPromo.id === 'catherine_business_show',
  'odd week picks Catherine @ Business Show'
);

const rosieHtml = buildMeetTeamSectionHtml('https://www.thenetworkeruk.com', evenWeekDate);
assert(/Meet Rosie \(the co-founder\) at The MarTech Summit/.test(rosieHtml), 'Rosie headline');
assert(/the-martech-summit-london-2026/.test(rosieHtml), 'Rosie links MarTech event');
assert(/about-rosie\.png/.test(rosieHtml), 'Rosie photo');

const catherineHtml = buildMeetTeamSectionHtml('https://www.thenetworkeruk.com', oddWeekDate);
assert(
  /Meet Catherine at The Business Show London/.test(catherineHtml),
  'Catherine headline'
);
assert(!/co-founder/.test(catherineHtml), 'Catherine copy does not say co-founder');
assert(/the-business-show-london/.test(catherineHtml), 'Catherine links Business Show');
assert(/about-catherine\.png/.test(catherineHtml), 'Catherine photo');

const afterShows = buildMeetTeamSectionHtml(
  'https://www.thenetworkeruk.com',
  new Date('2026-11-14T00:00:00Z')
);
assert(afterShows === '', 'promo hidden after both November shows');

console.log('All Hubert weekly concierge checks passed');
