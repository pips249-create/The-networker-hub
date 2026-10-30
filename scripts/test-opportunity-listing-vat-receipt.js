#!/usr/bin/env node
/**
 * Opportunity listing monthly VAT receipts — amount breakdown + Stripe invoice link.
 * Run: node scripts/test-opportunity-listing-vat-receipt.js
 */
const assert = require('assert');
const {
  NETWORKER_VAT_NUMBER,
  buildOpportunityListingVatReceipt,
  buildVatBreakdownHtml,
  buildInvoiceCtaHtml,
  resolveOpportunityListingInvoice,
  serializeOpportunityListingInvoice,
  listOpportunityListingInvoices,
  buildComplimentaryListingAccountInvoice,
  formatGbpFromPence,
} = require('../api/_lib/opportunity-listing-vat-receipt');

assert.strictEqual(formatGbpFromPence(2500), '£25');
assert.strictEqual(formatGbpFromPence(500), '£5');
assert.strictEqual(formatGbpFromPence(3000), '£30');

const fromFallback = buildOpportunityListingVatReceipt(null, { amountPaidPence: 3000 });
assert.strictEqual(fromFallback.amountExVat, '£25');
assert.strictEqual(fromFallback.amountVat, '£5');
assert.strictEqual(fromFallback.amountPaid, '£30');
assert.strictEqual(fromFallback.vatNumber, NETWORKER_VAT_NUMBER);
assert.strictEqual(fromFallback.invoiceUrl, '');

const invoice = {
  id: 'in_test_1',
  number: 'ABC-123',
  amount_paid: 3000,
  invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
  hosted_invoice_url: 'https://invoice.stripe.com/i/test',
  lines: {
    data: [
      { amount: 2500, description: 'Business opportunity listing' },
      { amount: 500, description: 'VAT (20%)' },
    ],
  },
};

const fromInvoice = buildOpportunityListingVatReceipt(invoice);
assert.strictEqual(fromInvoice.amountExVat, '£25');
assert.strictEqual(fromInvoice.amountVat, '£5');
assert.strictEqual(fromInvoice.amountPaid, '£30');
assert.strictEqual(fromInvoice.invoiceNumber, 'ABC-123');
assert.strictEqual(fromInvoice.invoiceUrl, 'https://pay.stripe.com/invoice/test/pdf');
assert.ok(fromInvoice.invoicePdfUrl);

const html = buildVatBreakdownHtml(fromInvoice);
assert.ok(html.includes('VAT receipt'));
assert.ok(html.includes('£25'));
assert.ok(html.includes('£5'));
assert.ok(html.includes('£30'));
assert.ok(html.includes('ABC-123'));
assert.ok(html.includes(NETWORKER_VAT_NUMBER));

const cta = buildInvoiceCtaHtml(fromInvoice);
assert.ok(cta.includes('Download VAT invoice'));
assert.ok(cta.includes(fromInvoice.invoiceUrl));
assert.strictEqual(buildInvoiceCtaHtml({}), '');

const serialized = serializeOpportunityListingInvoice(invoice);
assert.ok(serialized);
assert.strictEqual(serialized.number, 'ABC-123');
assert.strictEqual(serialized.amountPaid, '£30');
assert.strictEqual(serialized.invoicePdfUrl, 'https://pay.stripe.com/invoice/test/pdf');
assert.strictEqual(serializeOpportunityListingInvoice({ id: 'in_open', status: 'open' }), null);

async function testResolve() {
  const retrieved = [];
  const stripe = {
    invoices: {
      retrieve: async (id) => {
        retrieved.push(id);
        return { id, number: 'R-1', amount_paid: 3000, invoice_pdf: 'https://pdf' };
      },
      list: async (params) => {
        assert.strictEqual(params.subscription, 'sub_list');
        assert.strictEqual(params.status, 'paid');
        return {
          data: [
            invoice,
            { id: 'in_open', status: 'open', amount_paid: 0 },
          ],
        };
      },
    },
    subscriptions: {
      retrieve: async (id, opts) => {
        assert.strictEqual(id, 'sub_1');
        assert.ok(opts && opts.expand && opts.expand.includes('latest_invoice'));
        return { id, latest_invoice: 'in_from_sub' };
      },
    },
  };

  const fromSession = await resolveOpportunityListingInvoice(stripe, {
    session: { invoice: 'in_from_session' },
  });
  assert.strictEqual(fromSession.id, 'in_from_session');
  assert.deepStrictEqual(retrieved, ['in_from_session']);

  retrieved.length = 0;
  const fromSub = await resolveOpportunityListingInvoice(stripe, {
    subscriptionId: 'sub_1',
  });
  assert.strictEqual(fromSub.id, 'in_from_sub');
  assert.deepStrictEqual(retrieved, ['in_from_sub']);

  const passthrough = await resolveOpportunityListingInvoice(stripe, { invoice });
  assert.strictEqual(passthrough.number, 'ABC-123');

  const listed = await listOpportunityListingInvoices(stripe, 'sub_list');
  assert.strictEqual(listed.length, 1);
  assert.strictEqual(listed[0].number, 'ABC-123');
  assert.strictEqual(listed[0].invoiceUrl, 'https://pay.stripe.com/invoice/test/pdf');

  const complimentary = buildComplimentaryListingAccountInvoice({
    id: '11111111-2222-4333-8444-555555555555',
    listingPaidAt: '2026-09-10T12:00:00.000Z',
    listingExpiresAt: '2027-09-10T12:00:00.000Z',
  });
  assert.ok(complimentary);
  assert.strictEqual(complimentary.kind, 'complimentary');
  assert.strictEqual(complimentary.amountPaid, '£0');
  assert.strictEqual(complimentary.amountVat, '£0');
  assert.ok(String(complimentary.periodLabel).includes('Complimentary'));
  assert.ok(String(complimentary.periodLabel).includes('2027'));
  assert.ok(complimentary.detail);
  assert.strictEqual(buildComplimentaryListingAccountInvoice(null), null);
}

testResolve()
  .then(() => {
    console.log('opportunity listing VAT receipt checks passed');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
