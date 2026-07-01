const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isEmailTestRecipientAllowed } = require('../supabase-email-test-recipients');
const {
  listNewsletterEditions,
  getNewsletterEdition,
  saveNewsletterEdition,
  scheduleNewsletterEdition,
  cancelNewsletterEdition,
  duplicateNewsletterEdition,
  listNewsletterRecipients,
  previewNewsletterEdition,
  sendNewsletterTest,
  parseUuidList,
} = require('../newsletter-editions');

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

function editionFromBody(body) {
  const b = body.edition && typeof body.edition === 'object' ? body.edition : body;
  return {
    id: String(b.id || '').trim() || undefined,
    editionLabel: b.editionLabel ?? b.edition_label ?? '',
    subject: b.subject ?? '',
    preheader: b.preheader ?? '',
    articleTitle: b.articleTitle ?? b.article_title ?? '',
    articleBody: b.articleBody ?? b.article_body ?? '',
    articleImageUrl: b.articleImageUrl ?? b.article_image_url ?? '',
    layout: b.layout ?? 'magazine',
    hubNews: b.hubNews ?? b.hub_news ?? '',
    memberSpotlightName: b.memberSpotlightName ?? b.member_spotlight_name ?? '',
    memberSpotlightTitle: b.memberSpotlightTitle ?? b.member_spotlight_title ?? '',
    memberSpotlightBody: b.memberSpotlightBody ?? b.member_spotlight_body ?? '',
    memberSpotlightImageUrl: b.memberSpotlightImageUrl ?? b.member_spotlight_image_url ?? '',
    autoFeatured: b.autoFeatured ?? b.auto_featured,
    useEventsSponsor: b.useEventsSponsor ?? b.use_events_sponsor,
    featuredEventIds: parseUuidList(b.featuredEventIds ?? b.featured_event_ids),
    featuredOrganiserIds: parseUuidList(b.featuredOrganiserIds ?? b.featured_organiser_ids),
    featuredOpportunityIds: parseUuidList(b.featuredOpportunityIds ?? b.featured_opportunity_ids),
  };
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const sb = getSupabaseAdmin();

  if (req.method === 'GET') {
    try {
      const id = String(req.query?.id || '').trim();
      if (req.query?.recipients === '1') {
        const recipients = await listNewsletterRecipients(sb);
        return json(res, 200, { ok: true, count: recipients.length });
      }
      if (id) {
        const edition = await getNewsletterEdition(sb, id);
        if (!edition) return json(res, 404, { ok: false, error: 'not_found' });
        return json(res, 200, { ok: true, edition });
      }
      const editions = await listNewsletterEditions(sb);
      return json(res, 200, { ok: true, editions });
    } catch (e) {
      return json(res, 500, { ok: false, error: 'newsletter_load_failed', message: e.message });
    }
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = parseBody(req);
    const action = String(body.action || 'save').trim();

    try {
      if (action === 'save') {
        const edition = await saveNewsletterEdition(sb, editionFromBody(body), {
          createdBy: session.email || '',
        });
        return json(res, 200, { ok: true, edition });
      }

      if (action === 'preview') {
        const edition = editionFromBody(body);
        const built = await previewNewsletterEdition(sb, edition, {
          name: String(body.preview_name || 'Alex Morgan').trim(),
        });
        return json(res, 200, {
          ok: true,
          subject: built.subject,
          html: built.html,
          template_source: built.templateSource,
        });
      }

      if (action === 'schedule') {
        const edition = await saveNewsletterEdition(sb, editionFromBody(body), {
          createdBy: session.email || '',
        });
        const scheduled = await scheduleNewsletterEdition(
          sb,
          edition.id,
          body.scheduled_at || body.scheduledAt
        );
        return json(res, 200, { ok: true, edition: scheduled });
      }

      if (action === 'cancel') {
        const id = String(body.id || '').trim();
        if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
        const edition = await cancelNewsletterEdition(sb, id);
        return json(res, 200, { ok: true, edition });
      }

      if (action === 'duplicate') {
        const id = String(body.id || '').trim();
        if (!id) return json(res, 400, { ok: false, error: 'missing_id' });
        const edition = await duplicateNewsletterEdition(sb, id, { createdBy: session.email });
        return json(res, 200, { ok: true, edition });
      }

      if (action === 'send_test') {
        const to = String(body.to || '').trim().toLowerCase();
        if (!to) return json(res, 400, { ok: false, error: 'missing_recipient' });
        const allowed = await isEmailTestRecipientAllowed(to);
        if (!allowed) {
          return json(res, 403, {
            ok: false,
            error: 'recipient_not_allowed',
            message: 'Add this address to the safe test list under Email templates first.',
          });
        }
        const edition = editionFromBody(body);
        const result = await sendNewsletterTest(sb, edition, to);
        return json(res, 200, { ok: true, sent: true, ...result });
      }

      return json(res, 400, { ok: false, error: 'unknown_action' });
    } catch (e) {
      const code = e.code || 'newsletter_action_failed';
      const status =
        code === 'not_found'
          ? 404
          : code === 'invalid_scheduled_at' || code === 'invalid_featured_ids'
            ? 400
            : code === 'newsletter_schema_missing' ||
                code === 'resend_not_configured' ||
                code === 'missing_recipient' ||
                code === 'template_not_found'
              ? 503
              : code === 'recipient_not_allowed'
                ? 403
                : 500;
      return json(res, status, { ok: false, error: code, message: e.message });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
