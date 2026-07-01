/**
 * Public events API — Supabase-backed browse and event detail.
 */
const supabaseEvents = require('./_lib/supabase-events');

module.exports = async function handler(req, res) {
  return supabaseEvents.handle(req, res);
};
