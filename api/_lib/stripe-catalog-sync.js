/**
 * Idempotent Stripe Product / Price / Payment Link sync for hub catalog items.
 */
const { HUB_PLATFORM_META, HUB_STRIPE_CATALOG } = require('./hub-stripe-catalog');

function catalogProductMetadata(item) {
  return {
    hub_platform: HUB_PLATFORM_META,
    hub_catalog_key: item.key,
    ...item.productMetadata,
  };
}

function catalogPaymentLinkMetadata(item) {
  return {
    hub_platform: HUB_PLATFORM_META,
    hub_catalog_key: item.key,
    ...(item.paymentLinkMetadata || {}),
  };
}

function priceMatches(item, price) {
  if (!price || !price.active) return false;
  if (Number(price.unit_amount) !== item.amountPence) return false;
  if (price.currency !== 'gbp') return false;
  if (item.billing === 'recurring') {
    return price.recurring && price.recurring.interval === item.interval;
  }
  return !price.recurring;
}

async function findProductByCatalogKey(stripe, catalogKey) {
  const result = await stripe.products.search({
    query: "metadata['hub_catalog_key']:'" + catalogKey + "' AND active:'true'",
    limit: 1,
  });
  return result.data[0] || null;
}

async function findActivePriceForProduct(stripe, productId, item) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  return prices.data.find((price) => priceMatches(item, price)) || null;
}

async function ensureProduct(stripe, item) {
  let product = await findProductByCatalogKey(stripe, item.key);
  const metadata = catalogProductMetadata(item);

  if (product) {
    const needsUpdate =
      product.name !== item.productName ||
      (item.description || '') !== (product.description || '') ||
      product.metadata?.hub_platform !== metadata.hub_platform;

    if (needsUpdate) {
      product = await stripe.products.update(product.id, {
        name: item.productName,
        description: item.description || undefined,
        metadata,
      });
    }
    return { product, created: false };
  }

  product = await stripe.products.create({
    name: item.productName,
    description: item.description || undefined,
    metadata,
  });
  return { product, created: true };
}

async function ensurePrice(stripe, productId, item) {
  const existing = await findActivePriceForProduct(stripe, productId, item);
  if (existing) return { price: existing, created: false };

  const params = {
    product: productId,
    currency: 'gbp',
    unit_amount: item.amountPence,
    metadata: {
      hub_platform: HUB_PLATFORM_META,
      hub_catalog_key: item.key,
    },
  };

  if (item.billing === 'recurring') {
    params.recurring = { interval: item.interval || 'month' };
  }

  const price = await stripe.prices.create(params);
  return { price, created: true };
}

async function listPaymentLinks(stripe) {
  const links = [];
  let startingAfter;
  for (let page = 0; page < 10; page += 1) {
    const batch = await stripe.paymentLinks.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    links.push(...batch.data);
    if (!batch.has_more) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }
  return links;
}

async function findPaymentLinkByCatalogKey(stripe, catalogKey) {
  const links = await listPaymentLinks(stripe);
  return (
    links.find((link) => String(link.metadata?.hub_catalog_key || '') === catalogKey) || null
  );
}

async function ensurePaymentLink(stripe, item, priceId) {
  const existing = await findPaymentLinkByCatalogKey(stripe, item.key);
  if (existing) {
    const linePrice = existing.line_items?.data?.[0]?.price;
    const linePriceId = typeof linePrice === 'string' ? linePrice : linePrice?.id;
    if (linePriceId === priceId) {
      return { paymentLink: existing, created: false };
    }
    await stripe.paymentLinks.update(existing.id, { active: false });
  }

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: catalogPaymentLinkMetadata(item),
    allow_promotion_codes: false,
  });
  return { paymentLink, created: true, replaced: Boolean(existing) };
}

/**
 * @param {import('stripe').Stripe} stripe
 * @param {import('./hub-stripe-catalog').HubStripeCatalogItem} item
 */
async function syncCatalogItem(stripe, item) {
  const productResult = await ensureProduct(stripe, item);
  const priceResult = await ensurePrice(stripe, productResult.product.id, item);

  const result = {
    key: item.key,
    productId: productResult.product.id,
    productCreated: productResult.created,
    priceId: priceResult.price.id,
    priceCreated: priceResult.created,
    priceEnvVar: item.priceEnvVar,
    paymentLinkUrl: null,
    paymentLinkEnvVar: item.paymentLinkEnvVar || null,
    paymentLinkCreated: false,
    paymentLinkReplaced: false,
  };

  if (item.createPaymentLink && item.paymentLinkEnvVar) {
    const linkResult = await ensurePaymentLink(stripe, item, priceResult.price.id);
    result.paymentLinkUrl = linkResult.paymentLink.url;
    result.paymentLinkCreated = linkResult.created;
    result.paymentLinkReplaced = Boolean(linkResult.replaced);
  }

  return result;
}

async function syncHubStripeCatalog(stripe) {
  const results = [];
  for (const item of HUB_STRIPE_CATALOG) {
    results.push(await syncCatalogItem(stripe, item));
  }
  return results;
}

function buildEnvUpdates(results) {
  /** @type {Record<string, string>} */
  const updates = {};
  for (const row of results) {
    updates[row.priceEnvVar] = row.priceId;
    if (row.paymentLinkEnvVar && row.paymentLinkUrl) {
      updates[row.paymentLinkEnvVar] = row.paymentLinkUrl;
    }
  }
  return updates;
}

module.exports = {
  syncHubStripeCatalog,
  syncCatalogItem,
  buildEnvUpdates,
  catalogProductMetadata,
  catalogPaymentLinkMetadata,
};
