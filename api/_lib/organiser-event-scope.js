/**
 * Shared organiser event-query scope.
 * "allEvents" used to mean the entire platform, which made admin Attendees
 * and dashboard bootstrap scan every event/registration.
 */
function shouldScanAllPlatformEvents(groupIds, allEvents) {
  return Boolean(allEvents) && !(Array.isArray(groupIds) && groupIds.length);
}

function applyOrganiserIdScope(query, groupIds) {
  const ids = (groupIds || []).filter(Boolean);
  if (!ids.length) return query;
  if (ids.length === 1) return query.eq('organiser_id', ids[0]);
  return query.in('organiser_id', ids);
}

module.exports = {
  shouldScanAllPlatformEvents,
  applyOrganiserIdScope,
};
