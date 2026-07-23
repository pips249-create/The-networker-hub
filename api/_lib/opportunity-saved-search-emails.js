const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase, hubAccountUrl, legalPolicyUrl, contactUrl, opportunityPublicUrl } = require('./hub-email-urls');

function hasTag(item, tag) {
  const tags = [...(item.filterTags || []), ...(item.tags || [])];
  return tags.includes(tag) || item.type === tag;
}

function matchesSearchCriteria(item, criteria) {
  if (!item || !criteria) return false;
  const type = String(criteria.type || '').trim();
  if (type && type !== 'all' && item.type !== type && !hasTag(item, type)) return false;

  const invest = String(criteria.invest || '').trim();
  if (invest && !hasTag(item, invest)) return false;

  const location = String(criteria.location || '').trim();
  if (location && !hasTag(item, location)) return false;

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
    if (!hay.includes(q)) return false;
  }

  if (criteria.minInvest != null && criteria.minInvest !== '') {
    const min = Number(criteria.minInvest);
    if (!Number.isNaN(min) && (item.investAmount == null || item.investAmount < min)) return false;
  }
  if (criteria.maxInvest != null && criteria.maxInvest !== '') {
    const max = Number(criteria.maxInvest);
    if (!Number.isNaN(max) && (item.investAmount == null || item.investAmount > max)) return false;
  }
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
  if (criteria.q) parts.push(`"${criteria.q}"`);
  return parts.length ? parts.join(', ') : 'your saved search';
}

function parseInvest(meta) {
  const row = (meta || []).find((m) => /^investment$/i.test(m.key));
  if (!row) return null;
  const num = parseInt(String(row.val || '').replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(num) ? null : num;
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
      const item = {
        ...row,
        desc: row.description,
        tags: row.tags || [],
        meta: row.meta || [],
        filterTags: row.tags || [],
        investAmount: parseInvest(row.meta),
      };
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
          logo_url: siteUrl + '/assets/logo-nav.png',
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

module.exports = {
  matchesSearchCriteria,
  sendDueSavedSearchMatchEmails,
};
