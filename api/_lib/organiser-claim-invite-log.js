/**
 * Record claim-invite emails against organiser profiles so Command Centre
 * "House contact" can show automated outreach (campaigns, rematch scripts).
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { logEntityActivity } = require('./entity-activity-log');

const CLAIM_INVITE_SLUGS = new Set([
  'organiser_claim_invite',
  'organiser_launch_invite',
]);

function isClaimInviteSlug(slug) {
  return CLAIM_INVITE_SLUGS.has(String(slug || '').trim());
}

async function findOrganisersByEmail(sb, email) {
  const em = String(email || '')
    .trim()
    .toLowerCase();
  if (!em || !em.includes('@')) return [];
  const [byContact, byEmail] = await Promise.all([
    sb.from('organisers').select('id, name, email, contact_email').eq('contact_email', em).limit(20),
    sb.from('organisers').select('id, name, email, contact_email').eq('email', em).limit(20),
  ]);
  if (byContact.error) throw new Error(byContact.error.message);
  if (byEmail.error) throw new Error(byEmail.error.message);
  const seen = new Set();
  const rows = [];
  []
    .concat(byContact.data || [])
    .concat(byEmail.data || [])
    .forEach((row) => {
      const id = String(row.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      rows.push(row);
    });
  return rows;
}

/**
 * Log one claim-invite send for every organiser profile matching the email.
 * Never throws — outreach logging must not break sends.
 */
async function logClaimInviteSent(opts) {
  const options = opts || {};
  try {
    if (!isSupabaseConfigured()) return { ok: false, skipped: 'no_supabase' };
    const email = String(options.email || options.to || '')
      .trim()
      .toLowerCase();
    if (!email) return { ok: false, skipped: 'no_email' };

    const sb = options.sb || getSupabaseAdmin();
    let organisers = [];
    if (options.organiserId) {
      organisers = [
        {
          id: options.organiserId,
          name: options.organiserName || null,
        },
      ];
    } else {
      organisers = await findOrganisersByEmail(sb, email);
    }
    if (!organisers.length) return { ok: false, skipped: 'organiser_not_found' };

    const source = String(options.source || 'campaign').trim() || 'campaign';
    const campaign = String(options.campaign || '').trim() || null;
    const slug = String(options.slug || 'organiser_claim_invite').trim();
    const createdAt = options.createdAt || options.sentAt || null;
    const actorEmail = String(options.actorEmail || 'system@thenetworkeruk.com')
      .trim()
      .toLowerCase();

    const logged = [];
    for (const org of organisers) {
      const id = String(org.id || '').trim();
      if (!id) continue;
      const name = String(org.name || options.organiserName || '').trim() || 'group';
      const row = {
        actor_email: actorEmail,
        actor_role: 'system',
        entity_type: 'organiser',
        entity_id: id,
        organiser_id: id,
        action: 'admin_claim_invite',
        summary: 'claim invite emailed to ' + email + (name ? ' (' + name.slice(0, 60) + ')' : ''),
        metadata: {
          to: email,
          slug,
          source,
          campaign,
          organiserName: name,
        },
      };
      if (createdAt) row.created_at = createdAt;

      // Prefer direct insert when backdating created_at; logEntityActivity always uses now().
      if (createdAt) {
        const { error } = await sb.from('entity_activity_log').insert(row);
        if (error) {
          console.warn('[claim-invite-log]', error.message);
          continue;
        }
      } else {
        await logEntityActivity(row);
      }
      logged.push(id);
    }
    return { ok: true, organiserIds: logged };
  } catch (e) {
    console.warn('[claim-invite-log]', e && e.message ? e.message : e);
    return { ok: false, error: e && e.message ? e.message : 'log_failed' };
  }
}

module.exports = {
  CLAIM_INVITE_SLUGS,
  isClaimInviteSlug,
  logClaimInviteSent,
  findOrganisersByEmail,
};
