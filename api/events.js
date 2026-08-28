/**
 * Public events API — Supabase-backed browse and event detail.
 */
const supabaseEvents = require('./_lib/supabase-events');
const { wrapHandler } = require('./_lib/sentry');

module.exports = wrapHandler(async function handler(req, res) {
  return supabaseEvents.handle(req, res);
});