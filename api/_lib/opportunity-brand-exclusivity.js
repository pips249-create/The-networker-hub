/**
 * One business-opportunity listing per exclusive brand on /opportunities/.
 * Enforced in Command Centre and organiser listing flows.
 */
const EXCLUSIVE_OPPORTUNITY_BRANDS = [
  { key: 'utility-warehouse', label: 'Utility Warehouse', pattern: /\butility\s*warehouse\b/i },
  { key: 'arbonne', label: 'Arbonne', pattern: /\barbonne\b/i },
  { key: 'bni', label: 'BNI', pattern: /\bbni\b/i },
];

function collectListingText(fields) {
  const parts = [];
  if (fields && fields.title) parts.push(String(fields.title));
  if (fields && fields.host) parts.push(String(fields.host));
  if (fields && fields.description) parts.push(String(fields.description));
  if (fields && Array.isArray(fields.about)) {
    fields.about.forEach(function (paragraph) {
      if (paragraph) parts.push(String(paragraph));
    });
  } else if (fields && fields.about_text) {
    parts.push(String(fields.about_text));
  }
  return parts.join(' ');
}

function detectExclusiveBrand(fields) {
  const text = collectListingText(fields);
  if (!String(text || '').trim()) return null;
  for (let i = 0; i < EXCLUSIVE_OPPORTUNITY_BRANDS.length; i += 1) {
    const brand = EXCLUSIVE_OPPORTUNITY_BRANDS[i];
    if (brand.pattern.test(text)) return brand;
  }
  return null;
}

function detectExclusiveBrandFromRow(row) {
  if (!row) return null;
  return detectExclusiveBrand({
    title: row.title,
    host: row.host,
    description: row.description,
    about: row.about,
  });
}

function groupExclusiveBrandDuplicates(rows) {
  const byBrand = {};
  for (let i = 0; i < (rows || []).length; i += 1) {
    const row = rows[i];
    const brand = detectExclusiveBrandFromRow(row);
    if (!brand) continue;
    if (!byBrand[brand.key]) {
      byBrand[brand.key] = {
        brand: brand.label,
        brandKey: brand.key,
        listings: [],
      };
    }
    byBrand[brand.key].listings.push({
      id: row.id,
      title: String(row.title || '').trim(),
      host: String(row.host || '').trim(),
      status: row.status || '',
      approval_status: row.approval_status || '',
    });
  }
  return Object.keys(byBrand)
    .map(function (key) {
      return byBrand[key];
    })
    .filter(function (group) {
      return group.listings.length > 1;
    });
}

async function findExclusiveBrandDuplicateGroups(sb) {
  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, title, host, description, about, status, approval_status')
    .neq('status', 'archived')
    .limit(500);
  if (error) throw new Error(error.message);
  return groupExclusiveBrandDuplicates(data || []);
}

async function findExclusiveBrandDuplicateListingIds(sb) {
  const groups = await findExclusiveBrandDuplicateGroups(sb);
  const ids = [];
  groups.forEach(function (group) {
    group.listings.forEach(function (listing) {
      ids.push(String(listing.id));
    });
  });
  return [...new Set(ids)];
}

async function findExclusiveBrandConflict(sb, fields, excludeId) {
  const brand = detectExclusiveBrand(fields);
  if (!brand) return null;

  const { data, error } = await sb
    .from('business_opportunities')
    .select('id, title, host, description, about, status')
    .neq('status', 'archived');
  if (error) throw new Error(error.message);

  const exclude = excludeId ? String(excludeId) : '';
  for (let i = 0; i < (data || []).length; i += 1) {
    const row = data[i];
    if (exclude && String(row.id) === exclude) continue;
    const rowBrand = detectExclusiveBrandFromRow(row);
    if (rowBrand && rowBrand.key === brand.key) {
      return {
        brand: brand.label,
        brandKey: brand.key,
        existing: {
          id: row.id,
          title: String(row.title || '').trim(),
          host: String(row.host || '').trim(),
          status: row.status || '',
        },
      };
    }
  }
  return null;
}

function exclusiveBrandConflictError(conflict) {
  const ex = conflict && conflict.existing ? conflict.existing : {};
  const brand = (conflict && conflict.brand) || 'This brand';
  const title = String(ex.title || 'Untitled').trim();
  const host = String(ex.host || '').trim();
  let detail = title;
  if (host && host.toLowerCase() !== title.toLowerCase()) {
    detail += ' (' + host + ')';
  }
  return (
    'Only one ' +
    brand +
    ' listing is allowed on The Networker UK. An existing listing is already on the catalogue: "' +
    detail +
    '". Edit or remove that listing first.'
  );
}

async function assertExclusiveBrandAvailable(sb, fields, excludeId) {
  const conflict = await findExclusiveBrandConflict(sb, fields, excludeId);
  if (!conflict) return;
  const err = new Error(exclusiveBrandConflictError(conflict));
  err.code = 'exclusive_brand_conflict';
  err.status = 409;
  err.conflict = conflict;
  throw err;
}

function sendExclusiveBrandConflict(res, json, conflict) {
  return json(res, 409, {
    ok: false,
    error: 'exclusive_brand_conflict',
    message: exclusiveBrandConflictError(conflict),
    conflict,
  });
}

module.exports = {
  EXCLUSIVE_OPPORTUNITY_BRANDS,
  collectListingText,
  detectExclusiveBrand,
  detectExclusiveBrandFromRow,
  groupExclusiveBrandDuplicates,
  findExclusiveBrandDuplicateGroups,
  findExclusiveBrandDuplicateListingIds,
  findExclusiveBrandConflict,
  exclusiveBrandConflictError,
  assertExclusiveBrandAvailable,
  sendExclusiveBrandConflict,
};
