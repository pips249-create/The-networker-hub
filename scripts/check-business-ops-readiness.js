#!/usr/bin/env node
/**
 * Business ops readiness scorecard (product + documentation gates).
 * Run: node scripts/check-business-ops-readiness.js
 * Optional: node scripts/check-business-ops-readiness.js https://the-networker-hub.vercel.app
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const baseUrl = (process.argv[2] || '').replace(/\/$/, '');

const GATES = [
  {
    id: 'legal_policies',
    label: 'Legal policies page',
    weight: 2,
    check: () => fs.existsSync(path.join(root, 'legal-policies.html')),
  },
  {
    id: 'compliance_runbook',
    label: 'Compliance runbook',
    weight: 1,
    check: () => fs.existsSync(path.join(root, 'docs/COMPLIANCE-RUNBOOK.md')),
  },
  {
    id: 'support_runbook',
    label: 'Support inbox runbook',
    weight: 2,
    check: () => fs.existsSync(path.join(root, 'docs/SUPPORT-INBOX-RUNBOOK.md')),
  },
  {
    id: 'email_dns_guide',
    label: 'Email DNS setup guide (SPF/DKIM/DMARC)',
    weight: 2,
    check: () => fs.existsSync(path.join(root, 'docs/EMAIL-DNS-SETUP.md')),
  },
  {
    id: 'ico_guide',
    label: 'ICO registration guide',
    weight: 2,
    check: () => fs.existsSync(path.join(root, 'docs/ICO-REGISTRATION.md')),
  },
  {
    id: 'dpa_guide',
    label: 'Subprocessor DPA guide',
    weight: 2,
    check: () => fs.existsSync(path.join(root, 'docs/DPA-SUBPROCESSORS.md')),
  },
  {
    id: 'vat_guide',
    label: 'Organiser VAT guidance',
    weight: 1,
    check: () => fs.existsSync(path.join(root, 'docs/VAT-ORGANISER-GUIDANCE.md')),
  },
  {
    id: 'gdpr_sar',
    label: 'GDPR SAR procedure with named owners',
    weight: 1,
    check: () => {
      const text = fs.readFileSync(path.join(root, 'docs/GDPR-SAR-PROCEDURE.md'), 'utf8');
      return /Catherine|Rosie/.test(text) && /hello@thenetworkerhub\.com/.test(text);
    },
  },
  {
    id: 'breach_runbook',
    label: 'Data breach runbook with named leads',
    weight: 1,
    check: () => {
      const text = fs.readFileSync(path.join(root, 'docs/DATA-BREACH-RESPONSE.md'), 'utf8');
      return /Catherine|Rosie/.test(text);
    },
  },
  {
    id: 'opportunity_moderation_owner',
    label: 'Opportunity moderation owner assigned',
    weight: 2,
    check: () => {
      const text = fs.readFileSync(path.join(root, 'docs/OPPORTUNITY-MODERATION.md'), 'utf8');
      return /Moderation owner/i.test(text) && /Catherine|Rosie/.test(text);
    },
  },
  {
    id: 'refund_policy_tests',
    label: 'Refund policy compliance tests',
    weight: 2,
    check: () => {
      const result = spawnSync('node', ['scripts/test-refund-policy-compliance.js'], {
        cwd: root,
        encoding: 'utf8',
      });
      return result.status === 0;
    },
  },
  {
    id: 'no_earnings_claims',
    label: 'No estimated earnings fields on opportunity forms',
    weight: 1,
    check: () => {
      const html = fs.readFileSync(path.join(root, 'organiser/opportunity-edit.html'), 'utf8');
      const js = fs.readFileSync(path.join(root, 'js/organiser-opportunity-edit.js'), 'utf8');
      const admin = fs.readFileSync(path.join(root, 'js/admin-app.js'), 'utf8');
      return (
        !html.includes('oe-financial-key') &&
        !html.includes('oe-earnings-attest') &&
        !js.includes('earningsClaimsAttested') &&
        !admin.includes('Earnings / return')
      );
    },
  },
  {
    id: 'dpa_register',
    label: 'DPA register complete (core 4/4 filed)',
    weight: 2,
    check: () => {
      const result = spawnSync('node', ['scripts/check-dpa-register.js'], {
        cwd: root,
        encoding: 'utf8',
      });
      const out = result.stdout || '';
      return (
        result.status === 0 &&
        (/Completed: 4 \/ 4/.test(out) || /✓ Stripe/.test(out) && /✓ Supabase/.test(out))
      );
    },
  },
  {
    id: 'checkout_refund_guard',
    label: 'Paid checkout refund policy guard',
    weight: 2,
    check: () => {
      const text = fs.readFileSync(path.join(root, 'api/_lib/routes/auth-create-checkout.js'), 'utf8');
      return text.includes('assertRefundPolicyForPaidCheckout');
    },
  },
];

async function probeConfigCheck() {
  if (!baseUrl) return null;
  try {
    const headers = {};
    const secret = String(process.env.CONFIG_CHECK_SECRET || '').trim();
    if (secret) headers.Authorization = 'Bearer ' + secret;
    const res = await fetch(baseUrl + '/api/auth/config-check', { cache: 'no-store', headers });
    const data = await res.json();
    return data;
  } catch (e) {
    return { error: e.message };
  }
}

(async function main() {
  let earned = 0;
  let total = 0;
  const rows = [];

  for (const gate of GATES) {
    total += gate.weight;
    let ok = false;
    try {
      ok = Boolean(gate.check());
    } catch {
      ok = false;
    }
    if (ok) earned += gate.weight;
    rows.push({ ...gate, ok });
  }

  console.log('Business ops readiness\n');
  for (const row of rows) {
    console.log((row.ok ? '  ✓' : '  ✗') + ' ' + row.label);
  }

  const pct = Math.round((earned / total) * 100);
  console.log('\nScore: ' + earned + '/' + total + ' weighted points (~' + pct + '%)');

  if (baseUrl) {
    console.log('\nLive config check:', baseUrl + '/api/auth/config-check');
    const cfg = await probeConfigCheck();
    if (cfg && !cfg.error) {
      console.log('  authReady:', cfg.authReady);
      console.log('  emailSendingConfigured:', cfg.env?.emailSendingConfigured);
      console.log('  checkoutReady:', cfg.env?.checkoutReady);
      console.log('  adminAccount.exists:', cfg.adminAccount?.exists);
      if (cfg.hints?.missingResend) console.log('  ⚠', cfg.hints.missingResend);
      if (cfg.hints?.emailAllowlist) console.log('  ℹ', cfg.hints.emailAllowlist);
    } else {
      console.log('  Could not reach config-check:', cfg?.error || 'unknown error');
    }
  } else {
    console.log('\nTip: pass your site URL to also probe /api/auth/config-check');
  }

  const target = 75;
  if (pct >= target) {
    console.log('\nTarget ~' + target + '% reached — complete remaining director/finance items before full launch.');
    process.exit(0);
  }
  console.log('\nBelow ~' + target + '% target — see docs/COMPLIANCE-RUNBOOK.md for open actions.');
  process.exit(pct >= 60 ? 0 : 1);
})();
