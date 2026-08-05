/**
 * Parse admin JSON / form boolean fields.
 * Boolean("false") is true — never use Boolean() for request bodies.
 */
function parseAdminBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

module.exports = {
  parseAdminBool,
};
