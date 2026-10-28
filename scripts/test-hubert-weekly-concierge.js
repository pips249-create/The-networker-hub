/**
 * Weekly Hubert Event Concierge cadence + Meet Rosie / Catherine promos.
 * Run: node scripts/test-hubert-weekly-concierge.js
 */
const {
  isDueForHubertConcierge,
  hubertConciergeWeekLabel,
  buildMeetTeamSectionHtml,
  listTeamEventPromos,
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

const promos = listTeamEventPromos(now);
assert(promos.length === 2, 'both November promos included');
assert(promos[0].id === 'rosie_martech', 'Rosie @ MarTech first');
assert(promos[1].id === 'catherine_business_show', 'Catherine @ Business Show second');

const html = buildMeetTeamSectionHtml('https://www.thenetworkeruk.com', now);
assert(/Meet Rosie \(the co-founder\) at The MarTech Summit/.test(html), 'Rosie headline');
assert(/the-martech-summit-london-2026/.test(html), 'Rosie links MarTech event');
assert(/about-rosie\.png/.test(html), 'Rosie photo');
assert(/Meet Catherine at The Business Show London/.test(html), 'Catherine headline');
assert(!/Meet Catherine \(the co-founder\)/.test(html), 'Catherine copy does not say co-founder');
assert(/the-business-show-london/.test(html), 'Catherine links Business Show');
assert(/about-catherine\.png/.test(html), 'Catherine photo');

const afterShows = buildMeetTeamSectionHtml(
  'https://www.thenetworkeruk.com',
  new Date('2026-11-14T00:00:00Z')
);
assert(afterShows === '', 'promo hidden after both November shows');
assert(listTeamEventPromos(new Date('2026-11-14T00:00:00Z')).length === 0, 'list empty after shows');

console.log('All Hubert weekly concierge checks passed');
