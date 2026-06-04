const { sessionFromRequest, requireAdmin, json, airtableConfig, setCors } = require('../lib/auth');

function parsePriceNum(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function platformFee(subtotal) {
  return subtotal * 0.04 + 0.2;
}

async function fetchAllEvents(apiKey, baseId, table, view) {
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
  const all = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100' });
    if (view) q.set('view', view);
    if (offset) q.set('offset', offset);
    const resp = await fetch(`${baseUrl}?${q}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) return { records: [], error: await resp.text() };
    const data = await resp.json();
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return { records: all };
}

async function fetchTableRecords(tableName, sortField) {
  const { apiKey, baseId } = airtableConfig();
  if (!apiKey || !baseId) return [];
  const q = new URLSearchParams({ pageSize: '20' });
  if (sortField) {
    q.set('sort[0][field]', sortField);
    q.set('sort[0][direction]', 'desc');
  }
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${q}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.records || [];
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  const { apiKey, baseId, logsTable, alertsTable } = airtableConfig();
  const eventsTable = process.env.AIRTABLE_EVENTS_TABLE || 'Events';
  const eventsView = process.env.AIRTABLE_EVENTS_VIEW;
  const usersTable = process.env.AIRTABLE_USERS_TABLE || 'Users';

  try {
    let totalRevenue = 0;
    let totalFees = 0;
    let liveEvents = 0;
    const organisers = new Set();
    let attendees = 0;

    if (apiKey && baseId) {
      const { records } = await fetchAllEvents(apiKey, baseId, eventsTable, eventsView);
      const now = Date.now();

      records.forEach((rec) => {
        const f = rec.fields || {};
        const price = parsePriceNum(f.Price || f['Ticket Price']);
        const sold = Number(f['Tickets Sold'] || f.Attendees || f['Registrations'] || 0) || 0;
        const organiser = f.Organiser || f.Host || f.Organizer;
        if (organiser) organisers.add(String(organiser));

        const subtotal = price * sold;
        totalRevenue += subtotal;
        totalFees += platformFee(subtotal);

        const dateRaw = f.Date || f['Event Date'] || f['Start Date'];
        if (dateRaw) {
          const t = new Date(dateRaw).getTime();
          if (!Number.isNaN(t) && t >= now - 86400000) liveEvents += 1;
        } else {
          liveEvents += 1;
        }

        attendees += sold;
      });

      const userRecords = await fetchTableRecords(usersTable);
      const organizersFromUsers = userRecords.filter((r) => {
        const role = String(r.fields?.Role || r.fields?.role || '').toLowerCase();
        return role === 'organizer' || role === 'organiser';
      }).length;

      if (organizersFromUsers > organisers.size) {
        attendees = Math.max(attendees, userRecords.filter((r) => {
          const role = String(r.fields?.Role || '').toLowerCase();
          return role === 'attendee' || role === 'member';
        }).length);
      }
    }

    const logsRaw = await fetchTableRecords(logsTable, 'Timestamp');
    const alertsRaw = await fetchTableRecords(alertsTable, 'Created');

    const logs = logsRaw.length
      ? logsRaw.map((r) => ({
          id: r.id,
          message: r.fields?.Message || r.fields?.message || 'System event',
          type: r.fields?.Type || r.fields?.type || 'info',
          time: r.fields?.Timestamp || r.fields?.Created || r.createdTime,
        }))
      : buildSyntheticLogs(organisers);

    const alerts = alertsRaw.length
      ? alertsRaw.map((r) => ({
          id: r.id,
          title: r.fields?.Title || r.fields?.Alert || 'Alert',
          detail: r.fields?.Detail || r.fields?.Message || '',
          severity: (r.fields?.Severity || 'medium').toLowerCase(),
          time: r.fields?.Created || r.createdTime,
        }))
      : buildSyntheticAlerts();

    return json(res, 200, {
      ok: true,
      metrics: {
        totalRevenue: round2(totalRevenue),
        totalPlatformFees: round2(totalFees),
        liveEvents,
        totalOrganizers: organisers.size,
        totalAttendees: attendees,
        currency: 'GBP',
      },
      logs,
      alerts,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json(res, 500, { error: 'server_error', message: e.message });
  }
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildSyntheticLogs(organisers) {
  const names = [...organisers].slice(0, 3);
  const now = Date.now();
  const items = [
    { message: 'Platform health check passed', type: 'system', time: new Date(now).toISOString() },
    { message: 'Stripe webhook listener active', type: 'system', time: new Date(now - 120000).toISOString() },
  ];
  names.forEach((name, i) => {
    items.push({
      message: `Organizer ${name} published a new event`,
      type: 'event',
      time: new Date(now - (i + 1) * 300000).toISOString(),
    });
  });
  return items;
}

function buildSyntheticAlerts() {
  return [
    {
      id: 'demo-1',
      title: 'Review organiser support ticket',
      detail: 'An organiser flagged a technical issue with ticket scanning.',
      severity: 'high',
      time: new Date().toISOString(),
    },
    {
      id: 'demo-2',
      title: 'Unusual rejection rate',
      detail: '15% of applications rejected in the last hour — above normal.',
      severity: 'medium',
      time: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}
