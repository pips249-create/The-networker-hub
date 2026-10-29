/**
 * Command Centre / ops grants for complimentary Connected booking and Link Out.
 */
const {
  PLAN_GROUP_LIMITS,
  normalizeConnectedBookingEmail,
  newWebhookSecret,
  isConnectedPlanActive,
  accountHasAdminConnectedGrant,
  accountHasLinkOutGrant,
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
} = require('./connected-booking-util');

const ACCOUNT_GRANT_SELECT =
  'id, email, supabase_user_id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id, connected_booking_stripe_customer_id, connected_booking_granted_at, connected_booking_granted_by, connected_booking_grant_note, link_out_granted_at, link_out_granted_by, link_out_grant_note';

function normalizePlan(plan) {
  // Free Connected has no page caps — Command Centre grants should not reintroduce Starter limits.
  if (connectedBookingFreeEnabled()) {
    return connectedBookingFreeDefaultPlan();
  }
  const key = String(plan || 'starter').trim().toLowerCase();
  return key in PLAN_GROUP_LIMITS ? key : 'starter';
}

function mapGrantAccount(row, extra) {
  if (!row) return null;
  return {
    id: row.id,
    email: normalizeConnectedBookingEmail(row.email || (extra && extra.email) || ''),
    supabaseUserId: row.supabase_user_id || null,
    connectedBookingPlan: row.connected_booking_plan || null,
    connectedBookingStatus: row.connected_booking_status || 'inactive',
    connectedBookingActive: isConnectedPlanActive(row),
    hasStripeSubscription: Boolean(String(row.connected_booking_stripe_subscription_id || '').trim()),
    connectedGrantedAt: row.connected_booking_granted_at || null,
    connectedGrantedBy: String(row.connected_booking_granted_by || '').trim(),
    connectedGrantNote: String(row.connected_booking_grant_note || '').trim(),
    linkOutGrantedAt: row.link_out_granted_at || null,
    linkOutGrantedBy: String(row.link_out_granted_by || '').trim(),
    linkOutGrantNote: String(row.link_out_grant_note || '').trim(),
    hasConnectedGrant: accountHasAdminConnectedGrant(row),
    hasLinkOutGrant: accountHasLinkOutGrant(row),
    organisers: Array.isArray(extra && extra.organisers) ? extra.organisers : undefined,
  };
}

async function resolveAccountEmail(sb, account) {
  const direct = normalizeConnectedBookingEmail(account?.email);
  if (direct) return direct;
  const uid = String(account?.supabase_user_id || '').trim();
  if (!uid) return '';
  try {
    const { data, error } = await sb.auth.admin.getUserById(uid);
    if (error) return '';
    return normalizeConnectedBookingEmail(data?.user?.email);
  } catch {
    return '';
  }
}

async function findOrganiserAccountById(sb, accountId) {
  const id = String(accountId || '').trim();
  if (!id) return null;
  const { data, error } = await sb
    .from('organiser_accounts')
    .select(ACCOUNT_GRANT_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

/**
 * Every organiser_accounts row that might belong to this email.
 * Prefer login account (auth user / accounts.email) over directory-page matches
 * so Command Centre grants land on the account they actually sign in with.
 */
async function findAllOrganiserAccountsByEmail(sb, email) {
  const em = normalizeConnectedBookingEmail(email);
  if (!em) return [];

  const byId = new Map();

  function add(row) {
    if (!row || !row.id) return;
    byId.set(String(row.id), row);
  }

  const { data: byEmail, error: emailErr } = await sb
    .from('organiser_accounts')
    .select(ACCOUNT_GRANT_SELECT)
    .eq('email', em)
    .maybeSingle();
  if (emailErr) throw new Error(emailErr.message);
  add(byEmail);

  if (typeof sb.auth?.admin?.getUserByEmail === 'function') {
    try {
      const { data: userData, error: userErr } = await sb.auth.admin.getUserByEmail(em);
      if (!userErr && userData?.user?.id) {
        const { data: byUid, error: uidErr } = await sb
          .from('organiser_accounts')
          .select(ACCOUNT_GRANT_SELECT)
          .eq('supabase_user_id', userData.user.id)
          .maybeSingle();
        if (uidErr) throw new Error(uidErr.message);
        add(byUid);
      }
    } catch {
      /* fall through */
    }
  }

  const quoted = '"' + em.replace(/"/g, '') + '"';
  const { data: orgs, error: orgErr } = await sb
    .from('organisers')
    .select('organiser_account_id, email, contact_email')
    .or('email.eq.' + quoted + ',contact_email.eq.' + quoted)
    .not('organiser_account_id', 'is', null)
    .limit(20);
  if (orgErr) throw new Error(orgErr.message);
  for (const org of orgs || []) {
    const accountId = String(org.organiser_account_id || '').trim();
    if (!accountId || byId.has(accountId)) continue;
    add(await findOrganiserAccountById(sb, accountId));
  }

  return [...byId.values()];
}

async function findOrganiserAccountByEmail(sb, email) {
  const all = await findAllOrganiserAccountsByEmail(sb, email);
  return all[0] || null;
}

async function listOrganisersForAccount(sb, accountId) {
  const id = String(accountId || '').trim();
  if (!id) return [];
  const { data, error } = await sb
    .from('organisers')
    .select('id, name, slug, email, contact_email, listing_status, connected_booking_slot_assigned_at')
    .eq('organiser_account_id', id)
    .order('name', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map((o) => ({
    id: o.id,
    name: String(o.name || '').trim() || 'Untitled',
    slug: String(o.slug || '').trim(),
    email: normalizeConnectedBookingEmail(o.contact_email || o.email || ''),
    listingStatus: o.listing_status || null,
    connectedSlotAssignedAt: o.connected_booking_slot_assigned_at || null,
  }));
}

async function listGrantedAccounts(sb) {
  const { data, error } = await sb
    .from('organiser_accounts')
    .select(ACCOUNT_GRANT_SELECT)
    .or('connected_booking_granted_at.not.is.null,link_out_granted_at.not.is.null')
    .order('connected_booking_granted_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const out = [];
  for (const row of rows) {
    const email = await resolveAccountEmail(sb, row);
    const organisers = await listOrganisersForAccount(sb, row.id);
    out.push(mapGrantAccount({ ...row, email: row.email || email }, { email, organisers }));
  }
  return out;
}

async function activateConnectedBookingGrant(sb, account, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const plan = normalizePlan(opts.plan);
  const grantedBy = normalizeConnectedBookingEmail(opts.grantedBy) || 'admin';
  const note = String(opts.note || '').trim().slice(0, 500);
  const now = new Date().toISOString();
  const patch = {
    connected_booking_plan: plan,
    connected_booking_status: 'active',
    connected_booking_granted_at: now,
    connected_booking_granted_by: grantedBy,
    connected_booking_grant_note: note || null,
  };
  if (!String(account.connected_booking_webhook_secret || '').trim()) {
    patch.connected_booking_webhook_secret = newWebhookSecret();
  }
  const { data, error } = await sb
    .from('organiser_accounts')
    .update(patch)
    .eq('id', account.id)
    .select(ACCOUNT_GRANT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || { ...account, ...patch };
}

async function revokeConnectedBookingGrant(sb, account) {
  if (String(account.connected_booking_stripe_subscription_id || '').trim()) {
    const e = new Error(
      'This account has a Stripe Connected subscription. Cancel billing in Stripe or on Connected booking before revoking the complimentary grant.'
    );
    e.code = 'has_stripe_subscription';
    e.status = 400;
    throw e;
  }
  const patch = {
    connected_booking_status: 'inactive',
    connected_booking_plan: null,
    connected_booking_granted_at: null,
    connected_booking_granted_by: null,
    connected_booking_grant_note: null,
  };
  const { data, error } = await sb
    .from('organiser_accounts')
    .update(patch)
    .eq('id', account.id)
    .select(ACCOUNT_GRANT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || { ...account, ...patch };
}

async function activateLinkOutGrant(sb, account, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const grantedBy = normalizeConnectedBookingEmail(opts.grantedBy) || 'admin';
  const note = String(opts.note || '').trim().slice(0, 500);
  const patch = {
    link_out_granted_at: new Date().toISOString(),
    link_out_granted_by: grantedBy,
    link_out_grant_note: note || null,
  };
  const { data, error } = await sb
    .from('organiser_accounts')
    .update(patch)
    .eq('id', account.id)
    .select(ACCOUNT_GRANT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || { ...account, ...patch };
}

async function revokeLinkOutGrant(sb, account) {
  const patch = {
    link_out_granted_at: null,
    link_out_granted_by: null,
    link_out_grant_note: null,
  };
  const { data, error } = await sb
    .from('organiser_accounts')
    .update(patch)
    .eq('id', account.id)
    .select(ACCOUNT_GRANT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || { ...account, ...patch };
}

module.exports = {
  ACCOUNT_GRANT_SELECT,
  normalizePlan,
  mapGrantAccount,
  resolveAccountEmail,
  findOrganiserAccountByEmail,
  findAllOrganiserAccountsByEmail,
  findOrganiserAccountById,
  listOrganisersForAccount,
  listGrantedAccounts,
  activateConnectedBookingGrant,
  revokeConnectedBookingGrant,
  activateLinkOutGrant,
  revokeLinkOutGrant,
};
