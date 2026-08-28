/**
 * Plain-text event descriptions — attendee extras are stored on separate columns.
 */

function isAttendeeExtrasJson(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return (
    Object.prototype.hasOwnProperty.call(obj, 'foodIncluded') ||
    Object.prototype.hasOwnProperty.call(obj, 'collectDietary') ||
    Object.prototype.hasOwnProperty.call(obj, 'collectAccessibility')
  );
}

function highlightsToDescription(highlights) {
  if (!Array.isArray(highlights)) return '';
  return highlights
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join('\n');
}

function resolveEventDescription(row) {
  const fromColumn = plainEventDescription(row && row.description);
  if (fromColumn) return fromColumn;
  return highlightsToDescription(row && row.highlights);
}

function plainEventDescription(text) {
  let s = String(text || '').trim();
  if (!s) return '';

  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj = JSON.parse(s);
      if (isAttendeeExtrasJson(obj)) return '';
    } catch {
      /* keep string */
    }
  }

  const trailingJson = s.match(/\n\n(\{[\s\S]*\})\s*$/);
  if (trailingJson) {
    try {
      const obj = JSON.parse(trailingJson[1]);
      if (isAttendeeExtrasJson(obj)) {
        s = s.slice(0, trailingJson.index).trim();
      }
    } catch {
      /* keep string */
    }
  }

  return s;
}

function mapAttendeeExtrasToRow(extras) {
  if (!extras || typeof extras !== 'object') return {};
  return {
    collect_dietary: Boolean(extras.collectDietary),
    collect_accessibility: Boolean(extras.collectAccessibility),
  };
}

function attendeeExtrasFromRow(row) {
  if (!row) return null;
  return {
    foodIncluded: Boolean(row.food_included),
    collectDietary: Boolean(row.collect_dietary),
    collectAccessibility: Boolean(row.collect_accessibility),
  };
}

const ATTENDEE_EXTRA_NOTE_LINES = [
  'Attendees will be asked about dietary requirements.',
  'Attendees will be asked about accessibility requirements.',
];

const LEGACY_ATTENDEE_EXTRA_NOTE_LINES = ['Food & drink included at this event.'];

function stripAttendeeExtraNotes(text) {
  if (!text) return '';
  return text
    .split('\n')
    .filter(
      (line) =>
        !ATTENDEE_EXTRA_NOTE_LINES.includes(String(line).trim()) &&
        !LEGACY_ATTENDEE_EXTRA_NOTE_LINES.includes(String(line).trim())
    )
    .join('\n')
    .trim();
}

function composeEventDescription(description, extras) {
  let text = stripAttendeeExtraNotes(plainEventDescription(description));
  const notes = [];
  if (extras && extras.collectDietary) notes.push(ATTENDEE_EXTRA_NOTE_LINES[0]);
  if (extras && extras.collectAccessibility) notes.push(ATTENDEE_EXTRA_NOTE_LINES[1]);
  if (notes.length) {
    text = (text ? text + '\n\n' : '') + notes.join(' ');
  }
  return text;
}

module.exports = {
  plainEventDescription,
  highlightsToDescription,
  resolveEventDescription,
  mapAttendeeExtrasToRow,
  attendeeExtrasFromRow,
  composeEventDescription,
  isAttendeeExtrasJson,
};
