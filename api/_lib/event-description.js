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
    food_included: Boolean(extras.foodIncluded),
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
  'Food & drink included at this event.',
  'Attendees will be asked about dietary requirements.',
  'Attendees will be asked about accessibility requirements.',
];

function composeEventDescription(description, extras) {
  let text = plainEventDescription(description);
  if (text) {
    const lines = text.split('\n');
    text = lines
      .filter((line) => !ATTENDEE_EXTRA_NOTE_LINES.includes(String(line).trim()))
      .join('\n')
      .trim();
  }
  const notes = [];
  if (extras && extras.foodIncluded) notes.push(ATTENDEE_EXTRA_NOTE_LINES[0]);
  if (extras && extras.collectDietary) notes.push(ATTENDEE_EXTRA_NOTE_LINES[1]);
  if (extras && extras.collectAccessibility) notes.push(ATTENDEE_EXTRA_NOTE_LINES[2]);
  if (notes.length) {
    text = (text ? text + '\n\n' : '') + notes.join(' ');
  }
  return text;
}

module.exports = {
  plainEventDescription,
  mapAttendeeExtrasToRow,
  attendeeExtrasFromRow,
  composeEventDescription,
  isAttendeeExtrasJson,
};
