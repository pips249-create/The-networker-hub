const { sendTemplatedEmail } = require('./send-template-email');
const {
  siteBase,
  hubAccountUrl,
  legalPolicyUrl,
  contactUrl,
  opportunityPublicUrl,
  logoNavUrl,
} = require('./hub-email-urls');
const { haystackMatchesQuery } = require('./search-match');

function hasTag(item, tag) {
  const tags = [...(item.filterTags || []), ...(item.tags || [])];
  return tags.includes(tag) || item.type === tag;
}

function wantsOpenDayCriteria(criteria) {
  const value = criteria && criteria.openDay;
  return value === '1' || value === 1 || value === true || value === 'true';
}

function matchesSearchCriteria(item, criteria) {
  if (!item || !criteria) return false;
  const type = String(criteria.type || '').trim();
  if (type && type !== 'all' && item.type !== type && !hasTag(item, type)) return false;

  const invest = String(criteria.invest || '').trim();
  if (invest && !hasTag(item, invest)) return false;

  const location = String(criteria.location || '').trim();
  if (location && !hasTag(item, location)) return false;

  const locationQuery = String(criteria.locationQuery || '')
    .trim()
    .toLowerCase();
  if (locationQuery) {
    const locationHay = [
      item.locationLabel,
      item.searchText,
      item.title,
      item.host,
      item.city,
      item.region,
      ...(item.tags || []),
      ...(item.meta || []).map((m) => `${m.key || ''} ${m.val || ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystackMatchesQuery(locationHay, locationQuery)) return false;
  }

  const commitment = String(criteria.commitment || '').trim();
  if (commitment && !hasTag(item, commitment)) return false;

  const category = String(criteria.category || '').trim();
  if (category && item.category !== category) return false;

  const q = String(criteria.q || '')
    .trim()
    .toLowerCase();
  if (q) {
    const hay = [
      item.title,
      item.desc,
      item.host,
      item.type,
      item.category,
      ...(item.tags || []),
      ...(item.meta || []).map((m) => `${m.key} ${m.val}`),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystackMatchesQuery(hay, q)) return false;
  }

  if (criteria.minInvest != null && criteria.minInvest !== '') {
    const min = Number(criteria.minInvest);
    if (!Number.isNaN(min) && (item.investAmount == null || item.investAmount < min)) return false;
  }
  if (criteria.maxInvest != null && criteria.maxInvest !== '') {
    const max = Number(criteria.maxInvest);
    if (!Number.isNaN(max) && (item.investAmount == null || item.investAmount > max)) return false;
  }

  if (wantsOpenDayCriteria(criteria) && !item.hasOpenDay) return false;

  return true;
}

function criteriaLabel(criteria) {
  const parts = [];
  if (criteria.type && criteria.type !== 'all') parts.push(String(criteria.type).replace(/-/g, ' '));
  if (criteria.invest) {
    const labels = {
      'low-invest': 'under £2.5k',
      'mid-invest': '£2.5k–£10k',
      'high-invest': '£10k+',
    };
    parts.push(labels[criteria.invest] || criteria.invest);
  }
  if (criteria.location) parts.push(String(criteria.location).replace(/-/g, ' '));
  if (criteria.locationQuery) parts.push(String(criteria.locationQuery));
  if (criteria.q) parts.push(`"${criteria.q}"`);
  if (wantsOpenDayCriteria(criteria)) parts.push('Has an open day');
  return parts.length ? parts.join(', ') : 'your saved search';
}

function parseInvest(meta) {
  const row = (meta || []).find((m) => /^investment$/i.test(m.key));
  if (!row) return null;
  const text = String(row.val || '');
  const matches = text.match(/\d[\d,]*(?:\.\d+)?\s*[kKmMbB]?/g) || [];
  if (!matches.length) return null;
  const token = String(matches[0] || '').replace(/,/g, '').trim();
  const m = token.match(/^(\d+(?:\.\d+)?)\s*([kKmMbB])?$/);
  if (!m) return null;
  let n = parseFloat(m[1], 10);
  if (!Number.isFinite(n)) return null;
  const suffix = String(m[2] || '').toLowerCase();
  if (suffix === 'k') n *= 1000;
  else if (suffix === 'm') n *= 1000000;
  else if (suffix === 'b') n *= 1000000000;
  return Math.round(n);
}

function opportunityRowToSearchItem(row, hasOpenDay) {
  return {
    ...row,
    desc: row.description,
    tags: row.tags || [],
    meta: row.meta || [],
    filterTags: row.tags || [],
    investAmount: parseInvest(row.meta),
    hasOpenDay: !!hasOpenDay,
  };
}

function isMissingOpenDayHitsTableError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (!msg.includes('opportunity_saved_search_open_day_hits')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('undefined table')
  );
}

async function sendDueSavedSearchMatchEmails(sb) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const siteUrl = siteBase();

  const { data: opportunities, error: oppErr } = await sb
    .from('business_opportunities')
    .select('id, title, slug, host, type, category, description, tags, meta, published_at, status, approval_status')
    .eq('status', 'published')
    .eq('approval_status', 'Approved')
    .gte('published_at', since);
  if (oppErr) throw new Error(oppErr.message);
  if (!opportunities || !opportunities.length) return result;

  const { data: searches, error: searchErr } = await sb
    .from('opportunity_saved_searches')
    .select('id, label, criteria, notify_email, attendees(id, email, name)')
    .eq('notify_email', true);
  if (searchErr) throw new Error(searchErr.message);
  result.checked = (searches || []).length;

  for (const search of searches || []) {
    const attendee = search.attendees;
    const email = String(attendee?.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    const criteria = search.criteria || {};
    const matches = [];
    for (const row of opportunities) {
      const item = opportunityRowToSearchItem(row, true);
      if (!matchesSearchCriteria(item, criteria)) continue;

      const hitRes = await sb
        .from('opportunity_saved_search_hits')
        .select('search_id')
        .eq('search_id', search.id)
        .eq('opportunity_id', row.id)
        .maybeSingle();
      if (hitRes.error) throw new Error(hitRes.error.message);
      if (hitRes.data) continue;
      matches.push(row);
    }

    if (!matches.length) {
      result.skipped += 1;
      continue;
    }

    const lead = matches[0];
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_saved_search_match',
        to: email,
        variables: {
          user_name: String(attendee?.name || '').trim() || 'there',
          user_email: email,
          search_label: String(search.label || '').trim() || criteriaLabel(criteria),
          match_count: String(matches.length),
          opportunity_title: String(lead.title || 'New opportunity').trim(),
          opportunity_url: opportunityPublicUrl(lead, siteUrl),
          browse_opportunities_url: siteUrl + '/opportunities/',
          hub_account_url: hubAccountUrl(siteUrl) + '#search-alerts',
          contact_url: contactUrl(siteUrl),
          privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
          terms_url: legalPolicyUrl(siteUrl, 'terms'),
          site_url: siteUrl,
          logo_url: logoNavUrl(siteUrl),
        },
      });

      const now = new Date().toISOString();
      for (const row of matches) {
        await sb.from('opportunity_saved_search_hits').insert({
          search_id: search.id,
          opportunity_id: row.id,
          notified_at: now,
        });
      }
      await sb
        .from('opportunity_saved_searches')
        .update({ last_notified_at: now })
        .eq('id', search.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ search_id: search.id, message: e.message || String(e) });
    }
  }

  return result;
}

async function sendOpenDaySavedSearchMatchEmails(sb, options) {
  const result = { sent: 0, skipped: 0, errors: [], checked: 0 };
  const siteUrl = siteBase();
  const since =
    options && options.since
      ? options.since
      : new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const openDayIds =
    options && Array.isArray(options.openDayIds)
      ? options.openDayIds.map((id) => String(id || '').trim()).filter(Boolean)
      : null;

  let openDaysQuery = sb.from('opportunity_open_days').select('id, opportunity_id, starts_at, created_at');
  if (openDayIds && openDayIds.length) {
    openDaysQuery = openDaysQuery.in('id', openDayIds);
  } else {
    openDaysQuery = openDaysQuery
      .gte('created_at', since)
      .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  }
  const { data: openDays, error: openDayErr } = await openDaysQuery;
  if (openDayErr) {
    const { isMissingOpenDaysTableError } = require('./opportunity-open-days');
    if (typeof isMissingOpenDaysTableError === 'function' && isMissingOpenDaysTableError(openDayErr)) {
      return result;
    }
    throw new Error(openDayErr.message);
  }
  if (!openDays || !openDays.length) return result;

  const opportunityIds = [
    ...new Set(openDays.map((row) => String(row.opportunity_id || '').trim()).filter(Boolean)),
  ];
  if (!opportunityIds.length) return result;

  const { data: opportunities, error: oppErr } = await sb
    .from('business_opportunities')
    .select('id, title, slug, host, type, category, description, tags, meta, published_at, status, approval_status')
    .in('id', opportunityIds)
    .eq('status', 'published')
    .eq('approval_status', 'Approved');
  if (oppErr) throw new Error(oppErr.message);
  const oppById = {};
  (opportunities || []).forEach((row) => {
    oppById[row.id] = row;
  });

  const { data: searches, error: searchErr } = await sb
    .from('opportunity_saved_searches')
    .select('id, label, criteria, notify_email, attendees(id, email, name)')
    .eq('notify_email', true);
  if (searchErr) throw new Error(searchErr.message);

  const openDaySearches = (searches || []).filter((search) =>
    wantsOpenDayCriteria(search.criteria || {})
  );
  result.checked = openDaySearches.length;
  if (!openDaySearches.length) return result;

  const { formatOpenDayWhen, openDayRowToDto } = require('./opportunity-open-days');

  let hitsTableAvailable = true;

  for (const search of openDaySearches) {
    const attendee = search.attendees;
    const email = String(attendee?.email || '').trim().toLowerCase();
    if (!email) {
      result.skipped += 1;
      continue;
    }

    const criteria = search.criteria || {};
    const matches = [];
    for (const dayRow of openDays) {
      const opportunity = oppById[dayRow.opportunity_id];
      if (!opportunity) continue;
      const item = opportunityRowToSearchItem(opportunity, true);
      if (!matchesSearchCriteria(item, criteria)) continue;

      if (hitsTableAvailable) {
        const hitRes = await sb
          .from('opportunity_saved_search_open_day_hits')
          .select('search_id')
          .eq('search_id', search.id)
          .eq('open_day_id', dayRow.id)
          .maybeSingle();
        if (hitRes.error) {
          if (isMissingOpenDayHitsTableError(hitRes.error)) hitsTableAvailable = false;
          else throw new Error(hitRes.error.message);
        } else if (hitRes.data) {
          continue;
        }
      }
      matches.push({ dayRow, opportunity });
    }

    if (!matches.length) {
      result.skipped += 1;
      continue;
    }

    const lead = matches[0];
    const openDayDto = openDayRowToDto(lead.dayRow);
    const whenLabel = formatOpenDayWhen(openDayDto);
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_saved_search_match',
        to: email,
        subject: 'New open day matching your saved search',
        variables: {
          user_name: String(attendee?.name || '').trim() || 'there',
          user_email: email,
          search_label: String(search.label || '').trim() || criteriaLabel(criteria),
          match_count: String(matches.length),
          opportunity_title: String(lead.opportunity.title || 'New opportunity').trim(),
          opportunity_url: opportunityPublicUrl(lead.opportunity, siteUrl),
          browse_opportunities_url: siteUrl + '/opportunities/',
          hub_account_url: hubAccountUrl(siteUrl) + '#search-alerts',
          contact_url: contactUrl(siteUrl),
          privacy_url: legalPolicyUrl(siteUrl, 'privacy'),
          terms_url: legalPolicyUrl(siteUrl, 'terms'),
          site_url: siteUrl,
          logo_url: logoNavUrl(siteUrl),
          open_day_when: whenLabel,
        },
      });

      const now = new Date().toISOString();
      if (hitsTableAvailable) {
        for (const match of matches) {
          const insertRes = await sb.from('opportunity_saved_search_open_day_hits').insert({
            search_id: search.id,
            open_day_id: match.dayRow.id,
            notified_at: now,
          });
          if (insertRes.error) {
            if (isMissingOpenDayHitsTableError(insertRes.error)) {
              hitsTableAvailable = false;
              break;
            }
            throw new Error(insertRes.error.message);
          }
        }
      }
      await sb
        .from('opportunity_saved_searches')
        .update({ last_notified_at: now })
        .eq('id', search.id);
      result.sent += 1;
    } catch (e) {
      if (e.code === 'emails_disabled') result.skipped += 1;
      else result.errors.push({ search_id: search.id, message: e.message || String(e) });
    }
  }

  return result;
}

module.exports = {
  matchesSearchCriteria,
  sendDueSavedSearchMatchEmails,
  sendOpenDaySavedSearchMatchEmails,
};
