/**
 * VAT receipt fields for business opportunity listing subscriptions.
 * Hub emails a monthly VAT receipt with Stripe invoice PDF when available.
 */
const {
  calculateOpportunityListingTotals,
  OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE,
} = require('./opportunity-listing-pricing');

const NETWORKER_VAT_NUMBER = '454 4092 94';
const NETWORKER_COMPANY_NAME = 'The Networker Group Ltd';

function formatGbpFromPence(amountPence) {
  const n = Number(amountPence);
  if (!Number.isFinite(n) || n < 0) return '';
  return '£' + (n / 100).toFixed(2).replace(/\.00$/, '');
}

function invoiceIdFromRef(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref.trim();
  return String(ref.id || '').trim();
}

/**
 * Prefer Stripe invoice line amounts; fall back to standard £25 + 20% VAT.
 */
function buildOpportunityListingVatReceipt(invoice, options) {
  const opts = options || {};
  const totals = calculateOpportunityListingTotals(1);
  const fallbackEx = totals.subtotalExVatPence;
  const fallbackVat = totals.vatPence;
  const fallbackTotal = totals.totalPence;

  let exVatPence = fallbackEx;
  let vatPence = fallbackVat;
  let totalPence =
    invoice && invoice.amount_paid != null && Number.isFinite(Number(invoice.amount_paid))
      ? Number(invoice.amount_paid)
      : fallbackTotal;

  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  if (lines.length) {
    let listingPence = 0;
    let taxPence = 0;
    for (const line of lines) {
      const amount = Number(line.amount);
      if (!Number.isFinite(amount)) continue;
      const desc = String(line.description || line.price?.product?.name || '').toLowerCase();
      const name = String(line.price?.nickname || '').toLowerCase();
      const blob = desc + ' ' + name;
      if (/\bvat\b|tax/.test(blob)) taxPence += amount;
      else listingPence += amount;
    }
    if (listingPence > 0) exVatPence = listingPence;
    if (taxPence > 0) vatPence = taxPence;
    else if (totalPence > exVatPence) vatPence = totalPence - exVatPence;
  } else if (opts.amountPaidPence != null && Number.isFinite(Number(opts.amountPaidPence))) {
    totalPence = Number(opts.amountPaidPence);
    if (totalPence !== fallbackTotal && totalPence > OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE) {
      exVatPence = OPPORTUNITY_LISTING_MONTHLY_EX_VAT_PENCE;
      vatPence = totalPence - exVatPence;
    }
  }

  if (!Number.isFinite(totalPence) || totalPence <= 0) {
    totalPence = exVatPence + vatPence;
  }

  const invoicePdf = String(invoice?.invoice_pdf || '').trim();
  const hostedUrl = String(invoice?.hosted_invoice_url || '').trim();
  const invoiceUrl = invoicePdf || hostedUrl;

  return {
    supplierName: NETWORKER_COMPANY_NAME,
    vatNumber: NETWORKER_VAT_NUMBER,
    invoiceNumber: String(invoice?.number || invoice?.id || opts.invoiceNumber || '').trim(),
    invoiceUrl,
    invoicePdfUrl: invoicePdf,
    hostedInvoiceUrl: hostedUrl,
    amountExVat: formatGbpFromPence(exVatPence),
    amountVat: formatGbpFromPence(vatPence),
    amountPaid: formatGbpFromPence(totalPence),
    amountExVatPence: exVatPence,
    amountVatPence: vatPence,
    amountPaidPence: totalPence,
    vatRateLabel: '20%',
  };
}

/**
 * Resolve the Stripe invoice for a listing checkout session or subscription.
 */
async function resolveOpportunityListingInvoice(stripe, refs) {
  const input = refs || {};
  if (!stripe) return null;

  if (input.invoice && typeof input.invoice === 'object' && input.invoice.id) {
    return input.invoice;
  }

  let invoiceId = invoiceIdFromRef(input.invoice);
  const session = input.session;
  if (!invoiceId && session) {
    invoiceId = invoiceIdFromRef(session.invoice);
  }

  let subscription = input.subscription;
  const subscriptionId =
    invoiceIdFromRef(subscription) ||
    String(input.subscriptionId || '').trim() ||
    (typeof session?.subscription === 'string'
      ? session.subscription
      : String(session?.subscription?.id || '').trim());

  if (!invoiceId && subscriptionId) {
    try {
      subscription =
        subscription && typeof subscription === 'object' && subscription.latest_invoice
          ? subscription
          : await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['latest_invoice'],
            });
      invoiceId = invoiceIdFromRef(subscription.latest_invoice);
      if (
        !invoiceId &&
        subscription.latest_invoice &&
        typeof subscription.latest_invoice === 'object'
      ) {
        return subscription.latest_invoice;
      }
    } catch {
      /* fall through */
    }
  }

  if (!invoiceId) return null;
  try {
    return await stripe.invoices.retrieve(invoiceId);
  } catch {
    return null;
  }
}

function buildVatBreakdownHtml(receipt) {
  const r = receipt || {};
  const rows = [
    ['Listing (ex VAT)', r.amountExVat],
    ['VAT (' + (r.vatRateLabel || '20%') + ')', r.amountVat],
    ['Total paid', r.amountPaid],
  ];
  let body = '';
  for (let i = 0; i < rows.length; i++) {
    const label = rows[i][0];
    const value = rows[i][1] || '—';
    const isTotal = i === rows.length - 1;
    body +=
      '<tr>' +
      '<td style="padding:8px 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;color:' +
      (isTotal ? '#1c2040' : '#635c5e') +
      ';font-weight:' +
      (isTotal ? '700' : '400') +
      ';">' +
      label +
      '</td>' +
      '<td style="padding:8px 0;font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;line-height:1.5;text-align:right;color:#1c2040;font-weight:' +
      (isTotal ? '700' : '600') +
      ';">' +
      value +
      '</td>' +
      '</tr>';
  }

  const metaBits = [];
  if (r.invoiceNumber) metaBits.push('Invoice ' + r.invoiceNumber);
  metaBits.push('VAT No. ' + (r.vatNumber || NETWORKER_VAT_NUMBER));
  const meta = metaBits.join(' · ');

  return (
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:360px;margin:0 auto 16px;text-align:left;">' +
    '<tr><td style="padding:16px 18px;background:#f5f0e8;border-radius:14px;">' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8a8285;margin:0 0 8px;">VAT receipt</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    body +
    '</table>' +
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;line-height:1.5;color:#8a8285;margin:10px 0 0;">' +
    meta +
    '<br>Supplier: ' +
    (r.supplierName || NETWORKER_COMPANY_NAME) +
    '</p>' +
    '</td></tr></table>'
  );
}

function buildInvoiceCtaHtml(receipt) {
  const url = String(receipt?.invoiceUrl || '').trim();
  if (!url) return '';
  return (
    '<p style="margin:0 0 12px;text-align:center;">' +
    '<a href="' +
    url +
    '" style="display:inline-block;text-align:center;padding:14px 32px;background:#1a7a4c;border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Download VAT invoice (PDF) &rarr;</a>' +
    '</p>'
  );
}

module.exports = {
  NETWORKER_VAT_NUMBER,
  NETWORKER_COMPANY_NAME,
  formatGbpFromPence,
  buildOpportunityListingVatReceipt,
  resolveOpportunityListingInvoice,
  buildVatBreakdownHtml,
  buildInvoiceCtaHtml,
};
