/**
 * Hubert reply resolution — live lookups beat static pattern matches.
 */
const { matchedFallbackReply, fallbackReply, applyGentlemanTone } = require('./hubert-knowledge');
const { formatEventFallbackReply } = require('./hubert-events');
const { formatOpportunityFallbackReply } = require('./hubert-opportunities');

function pickLiveFallbackReply(eventLookup, opportunityLookup, latestUserText) {
  const events = eventLookup && eventLookup.events;
  const opportunities = opportunityLookup && opportunityLookup.opportunities;
  const eventCount = events ? events.length : 0;
  const opportunityCount = opportunities ? opportunities.length : 0;
  const eventSearchRan = !!(eventLookup && eventLookup.query);
  const opportunitySearchRan = !!(opportunityLookup && opportunityLookup.query);

  // Live lookups first — never let a static pattern override a search the user asked for.
  if (eventSearchRan && opportunitySearchRan) {
    if (opportunityCount && (!eventCount || opportunityCount >= eventCount)) {
      return formatOpportunityFallbackReply(opportunityLookup);
    }
    return formatEventFallbackReply(eventLookup);
  }
  if (eventSearchRan) {
    return formatEventFallbackReply(eventLookup);
  }
  if (opportunitySearchRan) {
    return formatOpportunityFallbackReply(opportunityLookup);
  }

  const knowledge = matchedFallbackReply(latestUserText);
  if (knowledge) return knowledge;
  return null;
}

function resolveHubertReply(latestUserText, eventLookup, opportunityLookup) {
  const live = pickLiveFallbackReply(eventLookup, opportunityLookup, latestUserText);
  if (live) return applyGentlemanTone(live);
  return fallbackReply(latestUserText);
}

module.exports = {
  pickLiveFallbackReply,
  resolveHubertReply,
};
