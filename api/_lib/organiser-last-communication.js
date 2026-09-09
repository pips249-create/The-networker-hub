/**
 * Resolve "last communication" for organiser profiles from sales-kit CRM
 * rows and claim-invite activity (same signals as Command Centre sales kit).
 */

const MANUAL_TOUCH_NOTES = ['Called', 'Attempted call', 'Emailed', 'Meeting', 'LinkedIn'];

const LAST_CONTACT_FILTERS = new Set([
  'never',
  'any',
  'stale_7',
  'stale_14',
  'stale_30',
  'stale_45',
  'stale_90',
  'recent_7',
  'recent_14',
  'recent_30',
]);

const LAST_CONTACT_SORTS = new Set(['last_contact_asc', 'last_contact_desc']);

function parseLastContactFilter(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  return LAST_CONTACT_FILTERS.has(key) ? key : '';
}

function parseLastContactSort(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (key === 'last_contact' || key === 'last_communication' || key === 'last_communication_desc') {
    return 'last_contact_desc';
  }
  if (key === 'last_communication_asc') return 'last_contact_asc';
  return LAST_CONTACT_SORTS.has(key) ? key : '';
}

function needsLastContactPass(lastContactFilter, sort) {
  return Boolean(lastContactFilter || parseLastContactSort(sort));
}

function contactMs(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  // Date-only sales-kit shown_at → end of that UTC day so "today" sorts ahead of older times.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ms = Date.parse(raw + 'T23:59:59.999Z');
    return Number.isFinite(ms) ? ms : 0;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function isManualDemo(demo) {
  if (!demo) return false;
  return MANUAL_TOUCH_NOTES.indexOf(String(demo.notes || '').trim()) !== -1;
}

function houseLabelFromDemo(demo) {
  if (!demo) return 'Platform activity';
  const source = String(demo.source || '')
    .trim()
    .toLowerCase();
  if (source === 'impersonate') return 'Impersonated workspace';
  if (source === 'event_create') return 'Listed an event';
  const lines = String(demo.notes || '')
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/^\d{4}-\d{2}-\d{2}:\s*(.+)$/);
    if (!match) continue;
    const bit = match[1].trim();
    if (MANUAL_TOUCH_NOTES.indexOf(bit) !== -1) continue;
    return bit.replace(/\s*—.*$/, '').trim() || 'Platform activity';
  }
  return 'Platform activity';
}

function demoToContact(demo) {
  if (!demo) return null;
  const at = demo.shown_at || demo.shownAt || demo.created_at || demo.createdAt || null;
  if (!at) return null;
  const manual = isManualDemo(demo);
  return {
    at,
    label: manual ? String(demo.notes || '').trim() || 'Contact' : houseLabelFromDemo(demo),
    who: String(demo.shown_by || demo.shownBy || (manual ? 'Team' : 'Platform')).trim() || 'Team',
    kind: manual ? 'manual' : 'house',
  };
}

function claimInviteToContact(at) {
  if (!at) return null;
  return {
    at,
    label: 'Claim invite emailed',
    who: 'Platform',
    kind: 'claim_invite',
  };
}

function pickNewerContact(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const am = contactMs(a.at);
  const bm = contactMs(b.at);
  if (bm !== am) return bm > am ? b : a;
  // Prefer manual CRM over house/claim when timestamps tie.
  const rank = { manual: 3, house: 2, claim_invite: 1 };
  return (rank[b.kind] || 0) > (rank[a.kind] || 0) ? b : a;
}

function considerDemo(index, demo) {
  const contact = demoToContact(demo);
  if (!contact) return;
  const id = String(demo.organiser_id || demo.organiserId || '').trim();
  if (id) {
    index.byId.set(id, pickNewerContact(index.byId.get(id), contact));
  }
  const email = String(demo.organiser_email || demo.organiserEmail || '')
    .trim()
    .toLowerCase();
  if (email) {
    index.byEmail.set(email, pickNewerContact(index.byEmail.get(email), contact));
  }
}

async function fetchAllRows(sb, table, select, apply) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];
  for (;;) {
    let query = sb.from(table).select(select).range(offset, offset + pageSize - 1);
    if (typeof apply === 'function') query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function loadSalesDemos(sb) {
  try {
    return await fetchAllRows(
      sb,
      'organiser_sales_demos',
      'organiser_id, organiser_email, shown_at, created_at, notes, source, shown_by',
      (q) => q.order('shown_at', { ascending: false }).order('created_at', { ascending: false })
    );
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    if (/organiser_sales_demos|does not exist|schema cache/i.test(msg)) return [];
    if (/source/i.test(msg)) {
      try {
        return await fetchAllRows(
          sb,
          'organiser_sales_demos',
          'organiser_id, organiser_email, shown_at, created_at, notes, shown_by',
          (q) => q.order('shown_at', { ascending: false }).order('created_at', { ascending: false })
        );
      } catch {
        return [];
      }
    }
    throw e;
  }
}

async function loadSalesDemosForOrganisers(sb, organisers) {
  const ids = [
    ...new Set((organisers || []).map((o) => String(o && o.id ? o.id : '').trim()).filter(Boolean)),
  ];
  const emails = [
    ...new Set(
      (organisers || [])
        .map((o) =>
          String((o && (o.contact_email || o.email)) || '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
  if (!ids.length && !emails.length) return [];
  const rows = [];
  const seen = new Set();
  const push = (chunk) => {
    (chunk || []).forEach((row) => {
      const key =
        String(row.id || '') +
        '|' +
        String(row.organiser_id || '') +
        '|' +
        String(row.shown_at || '') +
        '|' +
        String(row.created_at || '');
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
  };
  const selectWithSource =
    'id, organiser_id, organiser_email, shown_at, created_at, notes, source, shown_by';
  const selectNoSource = 'id, organiser_id, organiser_email, shown_at, created_at, notes, shown_by';

  async function selectChunk(apply) {
    let query = sb.from('organiser_sales_demos').select(selectWithSource);
    query = apply(query);
    let { data, error } = await query;
    if (error && /source/i.test(String(error.message || ''))) {
      query = sb.from('organiser_sales_demos').select(selectNoSource);
      query = apply(query);
      ({ data, error } = await query);
    }
    if (error) {
      if (/organiser_sales_demos|does not exist|schema cache/i.test(String(error.message || ''))) {
        return [];
      }
      throw new Error(error.message);
    }
    return data || [];
  }

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    push(await selectChunk((q) => q.in('organiser_id', chunk)));
  }
  for (let i = 0; i < emails.length; i += 40) {
    const chunk = emails.slice(i, i + 40);
    const orClause = chunk.map((em) => 'organiser_email.eq.' + em).join(',');
    if (!orClause) continue;
    push(await selectChunk((q) => q.or(orClause)));
  }
  return rows;
}

async function loadClaimInviteLatest(sb, organiserIds) {
  const map = new Map();
  const scoped = Array.isArray(organiserIds);
  const ids = scoped
    ? [...new Set(organiserIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  if (!scoped) {
    // Full index: pull all claim-invite rows.
    try {
      const rows = await fetchAllRows(
        sb,
        'entity_activity_log',
        'organiser_id, created_at',
        (q) => q.eq('action', 'admin_claim_invite').order('created_at', { ascending: false })
      );
      rows.forEach((row) => {
        const id = String(row.organiser_id || '').trim();
        if (!id || map.has(id)) return;
        map.set(id, row.created_at || null);
      });
    } catch (e) {
      const msg = String((e && e.message) || e || '');
      if (/entity_activity_log|does not exist|schema cache/i.test(msg)) return map;
      throw e;
    }
    return map;
  }

  if (!ids.length) return map;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    try {
      const { data, error } = await sb
        .from('entity_activity_log')
        .select('organiser_id, created_at')
        .eq('action', 'admin_claim_invite')
        .in('organiser_id', chunk)
        .order('created_at', { ascending: false })
        .limit(Math.min(chunk.length * 4, 400));
      if (error) throw error;
      (data || []).forEach((row) => {
        const id = String(row.organiser_id || '').trim();
        if (!id || map.has(id)) return;
        map.set(id, row.created_at || null);
      });
    } catch (e) {
      const msg = String((e && e.message) || e || '');
      if (/entity_activity_log|does not exist|schema cache/i.test(msg)) return map;
      throw e;
    }
  }
  return map;
}

function emptyIndex() {
  return { byId: new Map(), byEmail: new Map(), claimById: new Map() };
}

async function buildLastCommunicationIndex(sb, opts) {
  const options = opts || {};
  const index = emptyIndex();
  const demos = Array.isArray(options.organisers)
    ? await loadSalesDemosForOrganisers(sb, options.organisers)
    : await loadSalesDemos(sb);
  demos.forEach((demo) => considerDemo(index, demo));

  const claimIds = Array.isArray(options.organiserIds)
    ? options.organiserIds
    : Array.isArray(options.organisers)
      ? options.organisers.map((o) => o && o.id)
      : null;
  const claimMap = await loadClaimInviteLatest(sb, claimIds);
  claimMap.forEach((at, id) => {
    index.claimById.set(id, at);
  });
  return index;
}

function organiserEmailKey(row) {
  return String(row.contact_email || row.email || '')
    .trim()
    .toLowerCase();
}

function resolveLastCommunication(row, index) {
  if (!row || !index) return null;
  const id = String(row.id || '').trim();
  let best = null;
  if (id && index.byId.has(id)) best = pickNewerContact(best, index.byId.get(id));
  const email = organiserEmailKey(row);
  if (email && index.byEmail.has(email)) best = pickNewerContact(best, index.byEmail.get(email));
  if (id && index.claimById.has(id)) {
    best = pickNewerContact(best, claimInviteToContact(index.claimById.get(id)));
  }
  return best;
}

function attachLastCommunication(row, index) {
  const contact = resolveLastCommunication(row, index);
  if (!contact) {
    return {
      ...row,
      last_communication_at: null,
      last_communication_label: null,
      last_communication_who: null,
      last_communication_kind: null,
    };
  }
  return {
    ...row,
    last_communication_at: contact.at,
    last_communication_label: contact.label,
    last_communication_who: contact.who,
    last_communication_kind: contact.kind,
  };
}

function matchesLastContactFilter(contact, filter) {
  const key = parseLastContactFilter(filter);
  if (!key) return true;
  const atMs = contact ? contactMs(contact.at) : 0;
  const has = atMs > 0;
  if (key === 'never') return !has;
  if (key === 'any') return has;
  const now = Date.now();
  const days = Number(String(key).replace(/^(stale|recent)_/, '')) || 0;
  if (!days) return true;
  if (key.indexOf('stale_') === 0) {
    if (!has) return true; // never contacted counts as stale for follow-up queues
    return now - atMs >= days * 86400000;
  }
  if (key.indexOf('recent_') === 0) {
    if (!has) return false;
    return now - atMs <= days * 86400000;
  }
  return true;
}

function compareLastContact(a, b, ascending) {
  const am = contactMs(a && a.last_communication_at);
  const bm = contactMs(b && b.last_communication_at);
  if (am === 0 && bm === 0) {
    return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'en-GB');
  }
  if (am === 0) return ascending ? -1 : 1; // never contacted first when oldest-first
  if (bm === 0) return ascending ? 1 : -1;
  if (am !== bm) return ascending ? am - bm : bm - am;
  return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'en-GB');
}

function sortByLastContact(rows, sort) {
  const key = parseLastContactSort(sort);
  if (!key) return rows;
  const ascending = key === 'last_contact_asc';
  return [...rows].sort((a, b) => compareLastContact(a, b, ascending));
}

module.exports = {
  MANUAL_TOUCH_NOTES,
  parseLastContactFilter,
  parseLastContactSort,
  needsLastContactPass,
  contactMs,
  buildLastCommunicationIndex,
  resolveLastCommunication,
  attachLastCommunication,
  matchesLastContactFilter,
  sortByLastContact,
  demoToContact,
  pickNewerContact,
};
