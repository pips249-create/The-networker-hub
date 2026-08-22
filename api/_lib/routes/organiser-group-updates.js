/**
 * Organiser monthly group updates API.
 */
const { getOrganiserApi } = require('../organiser-provider');
const { organiserPersonalScopeFromRequest } = require('../auth');
const { listAccessibleGroupsForSession } = require('../supabase-organiser-access');
const {
  getAllowance,
  listUpdatesForOrganiser,
  getUpdate,
  listUpcomingEventsForOrganiser,
  listHubAttendeeRecipients,
  estimateAudienceSlices,
  listAudienceSlices,
  saveDraft,
  queueUpdateSend,
  periodKey,
  periodLabel,
  normalizeContent,
  defaultSubject,
  buildTemplateVariables,
  buildPreviewDocument,
  resolveSelectedEvents,
  getMonthStatsForOrganiser,
  getEngagementReport,
} = require('../organiser-group-updates');
const { listCreditPacks } = require('../group-update-credits');

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

function adminViewForRequest(req, session) {
  const api = getOrganiserApi();
  return api.isPlatformAdmin(session) && !organiserPersonalScopeFromRequest(req);
}

async function ownedGroups(req, session) {
  const adminView = adminViewForRequest(req, session);
  const { groups } = await listAccessibleGroupsForSession(session, adminView);
  return groups || [];
}

function assertOwns(api, session, groups, organiserId) {
  if (!api.groupOwnedBySession(session, groups, organiserId)) {
    const err = new Error('group_not_owned');
    err.status = 403;
    throw err;
  }
}

module.exports = async function handler(req, res) {
  const { json, setCors, requireOrganiserSession } = getOrganiserApi();
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });
  const api = getOrganiserApi();

  try {
    const groups = await ownedGroups(req, auth.session);
    const url = new URL(req.url, 'http://localhost');
    const organiserId = String(
      url.searchParams.get('organiserId') ||
        url.searchParams.get('groupId') ||
        (req.body && (req.body.organiserId || req.body.groupId)) ||
        ''
    ).trim();

    if (req.method === 'GET') {
      const action = String(url.searchParams.get('action') || 'bootstrap').trim();
      const id = String(url.searchParams.get('id') || '').trim();
      if (!organiserId) return json(res, 400, { error: 'missing_organiser_id' });
      assertOwns(api, auth.session, groups, organiserId);

      if (action === 'get' && id) {
        const update = await getUpdate(id);
        if (!update || update.organiser_id !== organiserId) {
          return json(res, 404, { error: 'not_found' });
        }
        return json(res, 200, { ok: true, update });
      }

      if (action === 'report' && id) {
        const report = await getEngagementReport(id, organiserId);
        return json(res, 200, { ok: true, report });
      }

      const [allowance, updates, events, recipients, monthStats, audienceCounts] =
        await Promise.all([
          getAllowance(organiserId),
          listUpdatesForOrganiser(organiserId),
          listUpcomingEventsForOrganiser(organiserId),
          listHubAttendeeRecipients(organiserId),
          getMonthStatsForOrganiser(organiserId, periodKey()).catch(() => null),
          estimateAudienceSlices(organiserId).catch(() => ({
            all: 0,
            once: 0,
            recent: 0,
            favourites: 0,
          })),
        ]);
      const group = groups.find((g) => String(g.id) === organiserId) || null;
      const replyTo =
        (group && (group.contactEmail || group.ownerEmail || group.email)) || '';
      return json(res, 200, {
        ok: true,
        group,
        allowance,
        updates,
        events,
        monthStats,
        audienceSlices: listAudienceSlices().map((s) => ({
          ...s,
          count: Number(audienceCounts[s.id]) || 0,
        })),
        replyTo,
        recipientEstimate: recipients.length,
        creditPacks: listCreditPacks(),
        defaults: {
          subject: defaultSubject(group && group.name, allowance.periodKey),
          periodLabel: periodLabel(allowance.periodKey),
        },
      });
    }

    const body = parseBody(req);
    const groupId = String(body.organiserId || body.groupId || organiserId || '').trim();
    if (!groupId) return json(res, 400, { error: 'missing_organiser_id' });
    assertOwns(api, auth.session, groups, groupId);

    if (req.method === 'POST' || req.method === 'PATCH') {
      const action = String(body.action || 'save').trim();

      if (action === 'save') {
        const update = await saveDraft({
          organiserId: groupId,
          updateId: body.id || body.updateId || null,
          subject: body.subject,
          content: body.content,
          audience: body.audience,
        });
        return json(res, 200, { ok: true, update, allowance: await getAllowance(groupId) });
      }

      if (action === 'preview') {
        const groupRow = groups.find((g) => String(g.id) === groupId);
        const content = normalizeContent(body.content || {});
        const subject =
          String(body.subject || '').trim() ||
          defaultSubject(groupRow && groupRow.name, (await getAllowance(groupId)).periodKey);
        const fakeUpdate = {
          subject,
          period_key: (await getAllowance(groupId)).periodKey,
          content,
        };
        const events = await resolveSelectedEvents(groupId, content);
        const variables = await buildTemplateVariables({
          group: groupRow || { id: groupId, name: 'Your group' },
          update: fakeUpdate,
          content,
          events,
          recipient: { name: 'Alex', email: 'preview@example.com' },
          replyTo:
            (groupRow && (groupRow.contactEmail || groupRow.ownerEmail || groupRow.email)) || '',
        });
        return json(res, 200, {
          ok: true,
          preview: {
            subject: variables.email_subject,
            html: buildPreviewDocument(variables),
            eventCount: events.length,
          },
        });
      }

      if (action === 'send') {
        const updateId = String(body.id || body.updateId || '').trim();
        if (!updateId) return json(res, 400, { error: 'missing_update_id' });
        const result = await queueUpdateSend({ organiserId: groupId, updateId });
        return json(res, 200, {
          ok: true,
          ...result,
          message:
            'Update queued for ' +
            result.recipientCount +
            ' attendee' +
            (result.recipientCount === 1 ? '' : 's') +
            '. Emails will go out over the next couple of hours.',
        });
      }

      return json(res, 400, { error: 'unknown_action' });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || 'group_updates_failed',
      message: friendlyGroupUpdateMessage(e),
    });
  }
};

function friendlyGroupUpdateMessage(err) {
  const raw = String((err && (err.message || err.code)) || '');
  if (/organiser_group_updates|schema cache|does not exist/i.test(raw)) {
    return 'Monthly updates are still being set up on our side. Please try again shortly — your draft isn’t lost on this page.';
  }
  if (/run migration|group_update_extra_credits/i.test(raw)) {
    return 'Monthly updates are almost ready. Please try again in a moment.';
  }
  if (/group_not_owned|not_allowed|403/i.test(raw)) {
    return 'You don’t have access to that organiser page.';
  }
  if (/missing_organiser|organiser_not_found/i.test(raw)) {
    return 'Choose an organiser page first.';
  }
  if (/No Hub attendees/i.test(raw)) {
    return raw;
  }
  if (/Monthly send limit|No free sends|Extra credits/i.test(raw)) {
    return raw;
  }
  if (/Add a short organiser note|already_sent|not_a_draft/i.test(raw)) {
    return raw;
  }
  if (err && err.status && err.status >= 400 && err.status < 500 && raw && raw.length < 180) {
    return raw;
  }
  return 'Something went wrong saving your round-up. Please try again in a moment.';
}
