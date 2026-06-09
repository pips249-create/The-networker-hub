const { getOrganiserApi } = require('../organiser-provider');

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const { json, setCors, getOrganiserWorkspace, airtableSetupHint } = api;
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const ws = await getOrganiserWorkspace(req);
    if (!ws.ok && ws.error === 'not_authenticated') {
      return json(res, ws.status || 401, { error: ws.error });
    }
    if (!ws.ok && ws.error === 'missing_email') {
      return json(res, ws.status || 403, { error: ws.error });
    }
    if (!ws.ok) {
      return json(res, ws.status || 500, {
        error: ws.error,
        message: ws.message,
        groups: ws.groups,
        airtable: airtableSetupHint('events'),
      });
    }

    if (String(req.query?.eventsOnly || '') === '1') {
      return json(res, 200, {
        ok: true,
        events: ws.events,
        upcomingEvents: ws.upcomingEvents || [],
        tickets: ws.tickets,
        eventsPagination: ws.eventsPagination,
      });
    }

    return json(res, 200, {
      ok: true,
      dataProvider: 'supabase',
      user: ws.user || {
        email: ws.session.email,
        name: ws.session.name || '',
        role: ws.session.role,
        sub: ws.session.sub,
      },
      groups: ws.groups,
      events: ws.events,
      upcomingEvents: ws.upcomingEvents || [],
      tickets: ws.tickets,
      hubView: ws.hubView,
      adminView: ws.adminView,
      personalScope: ws.personalScope,
      isAdmin: ws.isAdmin,
      canOrganise: ws.canOrganise,
      organiserRole: ws.organiserRole,
      canManageTeam: ws.canManageTeam,
      canDeleteEvents: ws.canDeleteEvents,
      stats: {
        groups: ws.groups.length,
        events: ws.eventsPagination?.total ?? ws.events.length,
        tickets: ws.tickets.length,
        ticketsSold: ws.workspaceSummary?.computed ? ws.workspaceSummary.totalTicketsSold : null,
        revenue: ws.workspaceSummary?.computed ? ws.workspaceSummary.totalRevenue : null,
      },
      workspaceSummary: ws.workspaceSummary?.computed ? ws.workspaceSummary : null,
      eventSummaries: ws.eventSummaries || [],
      reviews: ws.reviews || [],
      eventsPagination: ws.eventsPagination || {
        total: ws.events.length,
        limit: ws.events.length,
        offset: 0,
        hasMore: false,
      },
      groupsError: ws.groupsError,
      airtable: {
        groups: airtableSetupHint && airtableSetupHint('groups'),
        events: airtableSetupHint && airtableSetupHint('events'),
        tickets: airtableSetupHint && airtableSetupHint('tickets'),
      },
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};
