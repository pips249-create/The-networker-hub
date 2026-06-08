/**
 * CSV parsing and row imports for admin Command Center.
 */
const { getSupabaseAdmin } = require('./supabase');
const { importAttendeeRow } = require('./supabase-auth');

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'full name' || h === 'organiser name');
  const phoneIdx = header.indexOf('phone');
  if (emailIdx < 0) throw new Error('CSV needs an email column');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = cols[emailIdx];
    if (!email) continue;
    rows.push({
      email,
      name: nameIdx >= 0 ? cols[nameIdx] : '',
      phone: phoneIdx >= 0 ? cols[phoneIdx] : '',
    });
  }
  return rows;
}

async function importOrganiserRow(row) {
  const sb = getSupabaseAdmin();
  const em = String(row.email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    throw new Error('Invalid email');
  }
  const payload = {
    name: String(row.name || em.split('@')[0]).trim() || 'Organiser',
    email: em,
    phone: row.phone ? String(row.phone).trim() : null,
    organiser_type: 'Events',
    verification_status: 'Verified',
    listing_status: 'published',
  };
  const { data: existing } = await sb.from('organisers').select('id').eq('email', em).maybeSingle();
  if (existing?.id) {
    const { error } = await sb.from('organisers').update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, email: em, updated: true };
  }
  const { data, error } = await sb.from('organisers').insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return { id: data.id, email: em, updated: false };
}

async function importOrganisersFromCsv(csvText) {
  const rows = parseCsv(csvText);
  let ok = 0;
  let fail = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await importOrganiserRow(row);
      ok++;
    } catch (e) {
      fail++;
      if (errors.length < 15) errors.push({ email: row.email, message: e.message });
    }
  }
  return { total: rows.length, ok, fail, errors };
}

async function importAttendeesFromCsv(csvText) {
  const rows = parseCsv(csvText);
  let ok = 0;
  let fail = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await importAttendeeRow(row);
      ok++;
    } catch (e) {
      fail++;
      if (errors.length < 15) errors.push({ email: row.email, message: e.message });
    }
  }
  return { total: rows.length, ok, fail, errors };
}

module.exports = {
  parseCsv,
  importOrganisersFromCsv,
  importAttendeesFromCsv,
};
