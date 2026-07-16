const { json } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { processDueRosterEmails } = require('../organiser-roster-email-queue');
const { authorizeCron } = require('../cron-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  if (!authorizeCron(req, res)) return;

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  try {
    const sb = getSupabaseAdmin();
    const startedAt = Date.now();
    const maxRuntimeMs = 50000;
    const maxBatches = 12;
    const aggregate = { sent: 0, skipped: 0, failed: 0, batches: 0, errors: [] };

    for (let i = 0; i < maxBatches; i += 1) {
      if (Date.now() - startedAt > maxRuntimeMs) break;
      const result = await processDueRosterEmails(sb, { batchSize: 80 });
      aggregate.batches += 1;
      aggregate.sent += result.sent || 0;
      aggregate.skipped += result.skipped || 0;
      aggregate.failed += result.failed || 0;
      if (Array.isArray(result.errors) && result.errors.length) {
        aggregate.errors.push(...result.errors.slice(0, Math.max(0, 20 - aggregate.errors.length)));
      }
      const processed = (result.sent || 0) + (result.skipped || 0) + (result.failed || 0);
      if (!processed) break;
    }

    return json(res, 200, { ok: true, ...aggregate });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: 'roster_emails_failed',
      message: e.message || String(e),
    });
  }
};
