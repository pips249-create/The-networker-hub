/**
 * Canonical meeting / event types (Supabase events.event_type).
 */
(function (global) {
  global.HUB_MEETING_TYPES = [
    { value: 'Networking meeting', label: 'Networking meeting' },
    { value: 'Netwalking', label: 'Netwalking' },
    { value: 'Conference', label: 'Conference' },
    { value: 'Exhibition', label: 'Exhibition' },
    { value: 'Awards ceremony', label: 'Awards ceremony' },
  ];
})(typeof window !== 'undefined' ? window : global);
