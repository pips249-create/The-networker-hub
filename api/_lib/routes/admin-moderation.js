const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getAdminModeration } = require('../admin-supabase-data');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (req.method === 'GET') {
    try {
      const report = await getAdminModeration();
      return json(res, 200, { ok: true, ...report });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'moderation_failed', message: e.message });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    if (!isSupabaseConfigured()) {
      return json(res, 503, { ok: false, error: 'supabase_not_configured' });
    }

    const body = parseBody(req);
    const action = String(body.action || '').trim();
    const id = String(body.id || '').trim();
    if (!action || !id) {
      return json(res, 400, { error: 'missing_action_or_id' });
    }

    const sb = getSupabaseAdmin();

    try {
      if (action === 'dismiss_report') {
        const { data, error } = await sb
          .from('listing_reports')
          .update({ status: 'dismissed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, report: data });
      }

      if (action === 'unpublish_from_report') {
        const { data: report, error: loadErr } = await sb
          .from('listing_reports')
          .select('id, listing_type, event_id, organiser_id, opportunity_id, listing_title, status')
          .eq('id', id)
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);
        if (!report) {
          return json(res, 404, { ok: false, error: 'not_found' });
        }
        if (String(report.status || '') !== 'open') {
          return json(res, 400, { ok: false, error: 'report_not_open' });
        }

        let listing = null;
        if (report.listing_type === 'event' && report.event_id) {
          const { data, error } = await sb
            .from('events')
            .update({ status: 'unpublished', ticket_sales_enabled: false })
            .eq('id', report.event_id)
            .select('id, title, status')
            .maybeSingle();
          if (error) throw new Error(error.message);
          listing = data ? { type: 'event', ...data } : null;
        } else if (report.listing_type === 'organiser' && report.organiser_id) {
          const { data, error } = await sb
            .from('organisers')
            .update({ listing_status: 'unpublished' })
            .eq('id', report.organiser_id)
            .select('id, name, listing_status')
            .maybeSingle();
          if (error) throw new Error(error.message);
          listing = data ? { type: 'organiser', ...data } : null;
        } else if (report.listing_type === 'opportunity' && report.opportunity_id) {
          const { data, error } = await sb
            .from('business_opportunities')
            .update({
              status: 'unpublished',
              approval_status: 'Rejected',
              updated_at: new Date().toISOString(),
            })
            .eq('id', report.opportunity_id)
            .select('id, title, status, approval_status')
            .maybeSingle();
          if (error) throw new Error(error.message);
          listing = data ? { type: 'opportunity', ...data } : null;
        }

        const { data: updatedReport, error: reportErr } = await sb
          .from('listing_reports')
          .update({ status: 'reviewed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (reportErr) throw new Error(reportErr.message);

        return json(res, 200, {
          ok: true,
          report: updatedReport,
          listing,
          listingMissing: !listing && Boolean(report.event_id || report.organiser_id || report.opportunity_id),
        });
      }

      if (action === 'delete_review_from_report') {
        const { data: report, error: loadErr } = await sb
          .from('review_reports')
          .select('id, review_id, status')
          .eq('id', id)
          .maybeSingle();
        if (loadErr) throw new Error(loadErr.message);
        if (!report) {
          return json(res, 404, { ok: false, error: 'not_found' });
        }
        if (String(report.status || '') !== 'open') {
          return json(res, 400, { ok: false, error: 'report_not_open' });
        }
        if (report.review_id) {
          const { error: delErr } = await sb.from('reviews').delete().eq('id', report.review_id);
          if (delErr) throw new Error(delErr.message);
        }
        const { data, error } = await sb
          .from('review_reports')
          .update({ status: 'reviewed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, report: data, deletedReviewId: report.review_id || null });
      }

      if (action === 'dismiss_review_report') {
        const { data, error } = await sb
          .from('review_reports')
          .update({ status: 'dismissed' })
          .eq('id', id)
          .select('id, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, report: data });
      }

      if (action === 'delete_review') {
        const { error } = await sb.from('reviews').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, deleted: id });
      }

      if (action === 'reject_event') {
        const { data, error } = await sb
          .from('events')
          .update({ approval_status: 'Rejected', status: 'draft' })
          .eq('id', id)
          .select('id, title, approval_status, status')
          .single();
        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, event: data });
      }

      return json(res, 400, { error: 'unknown_action' });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'action_failed', message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
