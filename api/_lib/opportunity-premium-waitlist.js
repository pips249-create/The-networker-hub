/**
 * Premium spotlight waitlist — notify organiser when a carousel slot opens.
 */
const { getSupabaseAdmin } = require('./supabase');
const { getPremiumSpotlightSlotStatus } = require('./opportunity-premium-slots');
const { sendTemplatedEmail } = require('./send-template-email');
const { siteBase, organiserBusinessDashboardUrl } = require('./hub-email-urls');

async function joinPremiumWaitlist(session, opportunityId) {
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) throw new Error('not_authenticated');
  const sb = getSupabaseAdmin();
  const slots = await getPremiumSpotlightSlotStatus(opportunityId);
  if (!slots.full) {
    return { joined: false, reason: 'slots_available', slots };
  }

  const row = {
    owner_email: email,
    supabase_user_id: session?.sub || null,
    opportunity_id: opportunityId || null,
  };

  const { data: existing } = await sb
    .from('opportunity_premium_waitlist')
    .select('id')
    .ilike('owner_email', email)
    .is('notified_at', null)
    .maybeSingle();

  if (existing) return { joined: true, already: true };

  const { error } = await sb.from('opportunity_premium_waitlist').insert(row);
  if (error) throw new Error(error.message);
  return { joined: true, already: false };
}

async function premiumWaitlistStatus(session) {
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return { onWaitlist: false };
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('opportunity_premium_waitlist')
    .select('id, created_at')
    .ilike('owner_email', email)
    .is('notified_at', null)
    .maybeSingle();
  return { onWaitlist: Boolean(data), joinedAt: data?.created_at || null };
}

async function notifyPremiumWaitlistIfSlotsOpen(sb) {
  const client = sb || getSupabaseAdmin();
  const slots = await getPremiumSpotlightSlotStatus();
  if (!slots.available) return { notified: 0, skipped: true, reason: 'slots_full' };

  const { data: rows, error } = await client
    .from('opportunity_premium_waitlist')
    .select('id, owner_email, opportunity_id')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, slots.available));
  if (error) throw new Error(error.message);
  if (!rows?.length) return { notified: 0, skipped: true, reason: 'empty' };

  const siteUrl = siteBase();
  const dashboardUrl = organiserBusinessDashboardUrl(siteUrl);
  let notified = 0;

  for (const row of rows) {
    const to = String(row.owner_email || '').trim().toLowerCase();
    if (!to) continue;
    try {
      await sendTemplatedEmail({
        slug: 'opportunity_premium_live',
        to,
        variables: {
          owner_name: to.split('@')[0] || 'there',
          opportunity_title: 'your business opportunity',
          dashboard_url: dashboardUrl,
          premium_note:
            'A premium spotlight place has opened on The Networker UK. Upgrade from My business opportunities while slots last.',
        },
      });
      await client
        .from('opportunity_premium_waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id);
      notified += 1;
    } catch {
      /* continue with next */
    }
  }

  return { notified, slots };
}

module.exports = {
  joinPremiumWaitlist,
  premiumWaitlistStatus,
  notifyPremiumWaitlistIfSlotsOpen,
};
