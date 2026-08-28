#!/usr/bin/env node
/**
 * HMRC platform operator — annual seller income summary (CSV).
 * Uses Supabase registrations + organiser Connect IDs. Confirm thresholds with your accountant.
 *
 * Run: npm run export:hmrc-sellers
 *      npm run export:hmrc-sellers -- --year 2025
 *
 * Output: ops/hmrc-seller-report-YYYY.csv (gitignored — contains organiser contact data)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'local.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = String(process.env.SUPABASE_URL || '').trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function parseYearArg() {
  const idx = process.argv.indexOf('--year');
  if (idx >= 0 && process.argv[idx + 1]) {
    const y = Number(process.argv[idx + 1]);
    if (Number.isInteger(y) && y >= 2020 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

async function fetchAllRegistrations(sb, yearStart, yearEnd) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (true) {
    const { data, error } = await sb
      .from('registrations')
      .select('id, organiser_id, payment_status, amount_paid, quantity, created_at, cancelled_at')
      .gte('created_at', yearStart)
      .lt('created_at', yearEnd)
      .in('payment_status', ['Paid', 'Refunded'])
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error('registrations: ' + error.message);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see local.env).');
    process.exit(1);
  }

  const year = parseYearArg();
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: organisers, error: orgErr } = await sb
    .from('organisers')
    .select('id, name, email, contact_email, stripe_account_id, stripe_connect_onboarded_at')
    .order('name');
  if (orgErr) throw new Error('organisers: ' + orgErr.message);

  const registrations = await fetchAllRegistrations(sb, yearStart, yearEnd);
  const byOrganiser = new Map();

  for (const reg of registrations) {
    if (!reg.organiser_id) continue;
    if (reg.cancelled_at) continue;
    const paid = reg.payment_status === 'Paid' ? round2(reg.amount_paid) : 0;
    const qty = Number(reg.quantity) > 0 ? Number(reg.quantity) : 1;
    const bucket = byOrganiser.get(reg.organiser_id) || {
      paid_registrations: 0,
      refunded_registrations: 0,
      gross_ticket_revenue_gbp: 0,
      tickets_sold: 0,
    };
    if (reg.payment_status === 'Paid') {
      bucket.paid_registrations += 1;
      bucket.gross_ticket_revenue_gbp = round2(bucket.gross_ticket_revenue_gbp + paid);
      bucket.tickets_sold += qty;
    } else if (reg.payment_status === 'Refunded') {
      bucket.refunded_registrations += 1;
    }
    byOrganiser.set(reg.organiser_id, bucket);
  }

  const orgById = new Map((organisers || []).map((o) => [o.id, o]));
  const reportRows = [];

  for (const [organiserId, stats] of byOrganiser.entries()) {
    const org = orgById.get(organiserId);
    if (!org) continue;
    reportRows.push({
      organiser_id: organiserId,
      organiser_name: org.name || '',
      contact_email: org.contact_email || org.email || '',
      stripe_account_id: org.stripe_account_id || '',
      connect_onboarded_at: org.stripe_connect_onboarded_at || '',
      calendar_year: year,
      paid_registrations: stats.paid_registrations,
      refunded_registrations: stats.refunded_registrations,
      tickets_sold: stats.tickets_sold,
      gross_ticket_revenue_gbp: stats.gross_ticket_revenue_gbp,
    });
  }

  reportRows.sort((a, b) => b.gross_ticket_revenue_gbp - a.gross_ticket_revenue_gbp);

  const headers = [
    'calendar_year',
    'organiser_id',
    'organiser_name',
    'contact_email',
    'stripe_account_id',
    'connect_onboarded_at',
    'paid_registrations',
    'refunded_registrations',
    'tickets_sold',
    'gross_ticket_revenue_gbp',
  ];

  const lines = [headers.join(',')];
  for (const row of reportRows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }

  const outDir = path.join(__dirname, '..', 'ops');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `hmrc-seller-report-${year}.csv`);
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');

  const withRevenue = reportRows.filter((r) => r.gross_ticket_revenue_gbp > 0);
  const totalRevenue = round2(withRevenue.reduce((s, r) => s + r.gross_ticket_revenue_gbp, 0));

  console.log('HMRC seller report — calendar year', year);
  console.log('  Organisers with paid activity:', withRevenue.length);
  console.log('  Total gross ticket revenue (GBP):', totalRevenue.toFixed(2));
  console.log('  Written:', outPath);
  console.log('\nNext: map Stripe Connect KYC fields + confirm reporting thresholds with your accountant.');
  console.log('Guide: docs/HMRC-PLATFORM-OPERATORS.md');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
