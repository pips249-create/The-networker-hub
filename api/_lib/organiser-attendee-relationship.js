/**
 * Derive "new to your group" vs "returning" from booking history per organiser.
 * No manual roster — status is computed from non-cancelled, non-denied registrations.
 */

function normalizeAttendeeKey(attendeeId, email) {
  const id = String(attendeeId || '').trim();
  if (id) return `id:${id}`;
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (em) return `email:${em}`;
  return null;
}

function resolveOrganiserId(row) {
  const direct = String(row.organiser_id || '').trim();
  if (direct) return direct;
  const fromEvent = row.events?.organiser_id;
  return String(fromEvent || '').trim();
}

function countsTowardRelationship(row) {
  if (row.cancelled_at) return false;
  if (String(row.application_status || '').trim() === 'Denied') return false;
  return true;
}

/**
 * @param {Array<{ id: string, organiser_id?: string, attendee_id?: string, created_at?: string, cancelled_at?: string|null, application_status?: string, attendees?: { email?: string }, events?: { organiser_id?: string } }>} rows
 * @returns {Map<string, { groupRelationship: 'new'|'returning'|'unknown', priorVisitCount: number }>}
 */
function buildRegistrationRelationshipMap(rows) {
  const result = new Map();
  const countable = (rows || []).filter(countsTowardRelationship);

  const byGroup = new Map();
  countable.forEach((row) => {
    const organiserId = resolveOrganiserId(row);
    const email = String(row.attendees?.email || '').trim();
    const attendeeKey = normalizeAttendeeKey(row.attendee_id, email);
    if (!organiserId || !attendeeKey || !row.id) return;
    const bucketKey = `${organiserId}\0${attendeeKey}`;
    const list = byGroup.get(bucketKey) || [];
    list.push(row);
    byGroup.set(bucketKey, list);
  });

  byGroup.forEach((list) => {
    list.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
    list.forEach((row, index) => {
      result.set(row.id, {
        groupRelationship: index === 0 ? 'new' : 'returning',
        priorVisitCount: index,
      });
    });
  });

  return result;
}

function relationshipForRegistration(row, relationshipMap) {
  const mapped = relationshipMap.get(row.id);
  if (mapped) return mapped;
  const organiserId = resolveOrganiserId(row);
  const email = String(row.attendees?.email || '').trim();
  const attendeeKey = normalizeAttendeeKey(row.attendee_id, email);
  if (!organiserId || !attendeeKey) {
    return { groupRelationship: 'unknown', priorVisitCount: 0 };
  }
  return { groupRelationship: 'unknown', priorVisitCount: 0 };
}

function relationshipLabel(groupRelationship) {
  if (groupRelationship === 'returning') return 'Returning';
  if (groupRelationship === 'new') return 'New to your group';
  return '—';
}

module.exports = {
  normalizeAttendeeKey,
  resolveOrganiserId,
  countsTowardRelationship,
  buildRegistrationRelationshipMap,
  relationshipForRegistration,
  relationshipLabel,
};
