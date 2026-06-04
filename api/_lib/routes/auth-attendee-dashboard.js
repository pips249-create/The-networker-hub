const { setCors, json, sessionFromRequest, findUserByEmail } = require('../auth');
const { getAttendeeDashboard, buildStats } = require('../attendee');

/** Demo rows so the dashboard layout matches the product mockup when no Registrations table yet. */
function demoRegistrations() {
  return [
    {
      id: 'demo-1',
      eventId: 'demo',
      title: 'Mastering LinkedIn for Business Growth',
      date: '2026-04-10T10:00:00.000Z',
      endDate: '2026-04-10T12:00:00.000Z',
      imageUrl: null,
      ticketLabel: '1 × General Admission',
      reviewStatus: 'upcoming',
    },
    {
      id: 'demo-2',
      eventId: 'demo',
      title: 'East Midlands Business Expo 2026',
      date: '2026-04-24T09:00:00.000Z',
      endDate: '2026-04-24T17:00:00.000Z',
      imageUrl: null,
      ticketLabel: '2 × General Admission',
      reviewStatus: 'upcoming',
    },
    {
      id: 'demo-3',
      eventId: 'demo',
      title: 'Pitch Perfect — Funding for SMEs',
      date: '2026-05-15T14:00:00.000Z',
      endDate: '2026-05-15T16:00:00.000Z',
      imageUrl: null,
      ticketLabel: '1 × General Admission',
      reviewStatus: 'upcoming',
    },
    {
      id: 'demo-4',
      eventId: 'demo',
      title: 'Women in Business Networking Breakfast',
      date: '2026-03-06T08:30:00.000Z',
      endDate: '2026-03-06T10:30:00.000Z',
      imageUrl: null,
      ticketLabel: '1 × General Admission',
      reviewStatus: 'reviewed',
    },
    {
      id: 'demo-5',
      eventId: 'demo',
      title: 'Monthly General Networking — Feb 2026',
      date: '2026-02-20T18:30:00.000Z',
      endDate: '2026-02-20T20:30:00.000Z',
      imageUrl: null,
      ticketLabel: '1 × General Admission',
      reviewStatus: 'pending',
    },
  ];
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  try {
    const user = await findUserByEmail(session.email);
    const dash = await getAttendeeDashboard(session.email);
    let registrations = dash.registrations;
    let stats = dash.stats;
    let isDemo = false;

    if (!registrations.length) {
      registrations = demoRegistrations();
      stats = buildStats(registrations);
      isDemo = true;
    }

    return json(res, 200, {
      ok: true,
      user: {
        email: session.email,
        name: (user && user.name) || session.name || '',
        role: session.role,
      },
      registrations,
      stats,
      isDemo,
    });
  } catch (e) {
    return json(res, 500, { error: 'dashboard_failed', message: e.message });
  }
};
