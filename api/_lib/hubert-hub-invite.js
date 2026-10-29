/**
 * Hubert Matchmaker — "Introduce someone to The Networker UK & Hubert".
 * Platform join invite (not a request to meet the inviter). Spec: 5 / week.
 */
const { sendTemplatedEmail } = require('./send-template-email');
const { emailGreetingName } = require('./email-display-name');
const {
  emailSiteBase,
  hubertIconUrl,
  logoNavUrl,
  logoFooterUrl,
  supportEmail,
} = require('./hub-email-urls');
const { isAdminRole } = require('./auth');

const MEMBER_WEEKLY_CAP = 5;
const ADMIN_WEEKLY_CAP = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function sessionUserId(session) {
  return (
    String((session && (session.userId || session.sub || session.id)) || '').trim() || null
  );
}

function weeklyCapForSession(session) {
  return isAdminRole(session && session.role) ? ADMIN_WEEKLY_CAP : MEMBER_WEEKLY_CAP;
}

function weekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function countRecentInvites(sb, { inviterUserId, inviterAttendeeId }) {
  let q = sb
    .from('hubert_hub_invites')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', weekAgoIso());

  if (inviterUserId) {
    q = q.eq('inviter_user_id', inviterUserId);
  } else if (inviterAttendeeId) {
    q = q.eq('inviter_attendee_id', inviterAttendeeId);
  } else {
    return 0;
  }

  const { count, error } = await q;
  if (error) throw error;
  return Number(count || 0);
}

function inviteNoteSection(note) {
  const text = String(note || '').trim();
  if (!text) return '';
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return (
    '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;line-height:1.65;color:#452d5c;margin:0 0 14px;padding:14px 16px;background:#f3eef5;border-radius:12px;text-align:left;">' +
    '<strong style="display:block;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;color:#7a3d8a;">A note from them</strong>' +
    safe +
    '</p>'
  );
}

async function sendHubInvite({
  sb,
  session,
  inviteeName,
  inviteeEmail,
  note,
  inviterAttendeeId,
}) {
  const name = String(inviteeName || '').trim();
  const email = normalizeEmail(inviteeEmail);
  const noteText = String(note || '').trim().slice(0, 500);
  const inviterEmail = normalizeEmail(session && session.email);
  const inviterId = sessionUserId(session);
  const inviterName =
    String((session && (session.name || session.fullName || session.displayName)) || '')
      .trim() || inviterEmail.split('@')[0] || 'A Networker UK member';

  if (!name || name.length < 2) {
    return { ok: false, error: 'name_required', message: 'Add their name.' };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'email_invalid', message: 'Add a valid email address.' };
  }
  if (inviterEmail && email === inviterEmail) {
    return { ok: false, error: 'self_invite', message: 'You can’t invite yourself.' };
  }

  const cap = weeklyCapForSession(session);
  const used = await countRecentInvites(sb, {
    inviterUserId: inviterId,
    inviterAttendeeId,
  });
  if (used >= cap) {
    return {
      ok: false,
      error: 'quota_exceeded',
      message:
        'You’ve used your ' +
        cap +
        ' introductions this week. Try again next week.',
      remaining: 0,
      cap,
    };
  }

  const site = emailSiteBase();
  const registerUrl =
    site +
    '/register?email=' +
    encodeURIComponent(email) +
    '&intent=attendee&utm_source=hubert&utm_medium=email&utm_campaign=hub_invite';

  const variables = {
    invitee_name: name,
    invitee_first_name: emailGreetingName(name, 'there'),
    inviter_name: inviterName,
    inviter_first_name: emailGreetingName(inviterName, 'Someone'),
    invite_note: noteText,
    invite_note_section: inviteNoteSection(noteText),
    register_url: registerUrl,
    account_url: site + '/account/',
    hubert_icon_url: hubertIconUrl(),
    logo_url: logoNavUrl(),
    logo_footer_url: logoFooterUrl(),
    support_email: supportEmail(),
    site_url: site,
  };

  let resendId = null;
  try {
    const result = await sendTemplatedEmail({
      slug: 'hubert_hub_invite',
      to: email,
      variables,
      skipEmailCheck: true,
      resendTags: [
        { name: 'category', value: 'hubert_hub_invite' },
        { name: 'matchmaker', value: '1' },
      ],
    });
    resendId = result && result.id ? String(result.id) : null;
  } catch (e) {
    const code = e && e.code ? String(e.code) : '';
    await sb.from('hubert_hub_invites').insert({
      inviter_user_id: inviterId,
      inviter_attendee_id: inviterAttendeeId || null,
      inviter_email: inviterEmail || null,
      invitee_name: name,
      invitee_email: email,
      note: noteText || null,
      status: code === 'emails_disabled' || code === 'email_suppressed' ? 'suppressed' : 'failed',
      error_message: String((e && e.message) || code || 'send_failed').slice(0, 400),
    });
    return {
      ok: false,
      error: code || 'send_failed',
      message:
        code === 'resend_not_configured'
          ? 'Email sending isn’t configured in this environment.'
          : 'Hubert couldn’t send that invite just now. Try again shortly.',
    };
  }

  await sb.from('hubert_hub_invites').insert({
    inviter_user_id: inviterId,
    inviter_attendee_id: inviterAttendeeId || null,
    inviter_email: inviterEmail || null,
    invitee_name: name,
    invitee_email: email,
    note: noteText || null,
    status: 'sent',
    resend_id: resendId,
  });

  return {
    ok: true,
    inviteeEmail: email,
    inviteeName: name,
    remaining: Math.max(0, cap - used - 1),
    cap,
  };
}

module.exports = {
  MEMBER_WEEKLY_CAP,
  ADMIN_WEEKLY_CAP,
  sessionUserId,
  weeklyCapForSession,
  countRecentInvites,
  sendHubInvite,
};
