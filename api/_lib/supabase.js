/**
 * Supabase server client (service role) for Vercel API routes.
 * Never import this from browser JS — use anon key + RLS on the client only.
 */
const { createClient } = require('@supabase/supabase-js');

function cleanEnvVal(v) {
  if (v == null) return '';
  return String(v).trim().replace(/^['"]|['"]$/g, '');
}

function supabaseConfig() {
  const url = cleanEnvVal(process.env.SUPABASE_URL);
  const serviceKey = cleanEnvVal(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = cleanEnvVal(process.env.SUPABASE_ANON_KEY);
  return { url, serviceKey, anonKey };
}

function isSupabaseConfigured() {
  const { url, serviceKey } = supabaseConfig();
  return Boolean(url && serviceKey);
}

function dataProvider() {
  return 'supabase';
}

function useSupabase() {
  return isSupabaseConfigured();
}

let adminClient = null;

/** Service-role client for API handlers (bypasses RLS). */
function getSupabaseAdmin() {
  const { url, serviceKey } = supabaseConfig();
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** Anon client when you want RLS-enforced reads/writes as the logged-in user. */
function getSupabaseAnon() {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (or .env), then redeploy.',
    };
  }
  try {
    const sb = getSupabaseAdmin();
    const probeTables = ['hub_accounts', 'organisers', 'attendees', 'events', 'opportunity_favourites'];
    let lastError = null;
    for (const table of probeTables) {
      const { error } = await sb.from(table).select('id').limit(1);
      if (!error) return { ok: true, configured: true, probeTable: table };
      lastError = error;
      if (error.code === '42P01' || /does not exist/i.test(error.message || '')) continue;
      const swappedKey =
        error.code === '42501' || /permission denied/i.test(error.message || '');
      return {
        ok: false,
        configured: true,
        message: swappedKey
          ? 'Permission denied — check SUPABASE_SERVICE_ROLE_KEY in local.env (use service_role secret, not the anon key).'
          : error.message,
        code: error.code,
        probeTable: table,
      };
    }
    if (lastError && (lastError.code === '42P01' || /does not exist/i.test(lastError.message || ''))) {
      return {
        ok: false,
        configured: true,
        message:
          'API keys work but no core tables found (profiles, users, events, organisers). Run migration SQL in Supabase SQL Editor.',
        code: lastError.code,
      };
    }
    return { ok: true, configured: true };
  } catch (e) {
    return { ok: false, configured: true, message: e.message || String(e) };
  }
}

module.exports = {
  supabaseConfig,
  isSupabaseConfigured,
  dataProvider,
  useSupabase,
  getSupabaseAdmin,
  getSupabaseAnon,
  testSupabaseConnection,
};
