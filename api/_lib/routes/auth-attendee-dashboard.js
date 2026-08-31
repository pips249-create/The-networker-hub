const { setCors, json, sessionFromRequest } = require('../auth');
const { buildStats } = require('../attendee');
const { getAttendeeDashboardFromSupabase } = require('../supabase-attendee-dashboard');
const { isSupabaseConfigured, useSupabase } = require('../supabase');
const sbAuth = require('../supabase-auth');

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured() || !useSupabase()) {
    return json(res, 503, {
      error: 'not_configured',
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    });
  }

  try {
    let displayName = session.name || '';

    if (!displayName) {
      const user = await sbAuth.findUserByEmail(session.email);
      if (user && user.name) displayName = user.name;
    }

    const dash = await getAttendeeDashboardFromSupabase(session);
    const registrations = dash.registrations;
    const cancelledBookings = dash.cancelledBookings || [];
    const stats = dash.stats || buildStats(registrations);
    const opportunityEnquiries = dash.opportunityEnquiries || [];
    const myGroups = dash.myGroups || [];

    return json(res, 200, {
      ok: true,
      user: {
        email: session.email,
        name: displayName,
        role: session.role,
      },
      registrations,
      cancelledBookings,
      stats,
      opportunityEnquiries,
      myGroups,
      isDemo: false,
    });
  } catch (e) {
    return json(res, 500, { error: 'dashboard_failed', message: e.message });
  }
};
