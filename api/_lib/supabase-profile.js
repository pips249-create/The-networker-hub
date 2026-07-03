/**
 * Account settings profile — hub_accounts + attendees (Supabase).
 */
const { getSupabaseAdmin } = require('./supabase');
const sbAuth = require('./supabase-auth');

const WRITABLE = {
  name: true,
  location: true,
  marketPreferences: true,
  businessSector: true,
};

function interestsToPreferences(interests) {
  if (!Array.isArray(interests) || !interests.length) return '';
  return interests.filter(Boolean).join(', ');
}

function preferencesToInterests(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function findAttendeeRow(sb, userId, email) {
  const uid = String(userId || '').trim();
  const em = String(email || '').toLowerCase();

  if (uid) {
    const byUser = await sb
      .from('attendees')
      .select('*')
      .eq('supabase_user_id', uid)
      .maybeSingle();
    if (!byUser.error && byUser.data) return byUser.data;
  }

  if (em) {
    const byEmail = await sb.from('attendees').select('*').eq('email', em).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data;
  }

  return null;
}

async function ensureAttendeeRow(sb, userId, email, name) {
  await sbAuth.backfillAttendeeUserId(userId, email);
  let row = await findAttendeeRow(sb, userId, email);
  if (row) return row;

  const em = String(email || '').toLowerCase();
  const { data, error } = await sb
    .from('attendees')
    .insert({
      email: em,
      supabase_user_id: userId || null,
      name: name || null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function rowToProfile(session, hub, attendee) {
  const marketFromRow =
    attendee && attendee.market_preferences != null
      ? String(attendee.market_preferences || '').trim()
      : interestsToPreferences(attendee?.interests);

  return {
    email: String(session.email || attendee?.email || '').toLowerCase(),
    name: String(hub?.display_name || attendee?.name || '').trim(),
    location: String(attendee?.location || '').trim(),
    marketPreferences: marketFromRow,
    businessSector: String(attendee?.business_sector || '').trim(),
    emailsEnabled: hub?.emails_enabled !== false,
    emailPrefEventReminders: hub?.email_pref_event_reminders !== false,
    emailPrefOrganiserAlerts: hub?.email_pref_organiser_alerts !== false,
  };
}

async function getProfile(session) {
  const sb = getSupabaseAdmin();
  const uid = session.sub;
  const em = String(session.email || '').toLowerCase();

  await sbAuth.backfillAttendeeUserId(uid, em);

  let hubAccount = null;
  if (uid) {
    const { data } = await sb.from('hub_accounts').select('*').eq('user_id', uid).maybeSingle();
    hubAccount = data;
  }

  const attendee = await findAttendeeRow(sb, uid, em);
  return {
    profile: rowToProfile(session, hubAccount, attendee),
    writable: WRITABLE,
  };
}

async function updateProfile(session, body) {
  const sb = getSupabaseAdmin();
  const uid = session.sub;
  const em = String(session.email || '').toLowerCase();

  const authUser = await sbAuth.findUserByEmail(em);
  if (!authUser) {
    const e = new Error('Account not found');
    e.status = 404;
    throw e;
  }

  const existing = await findAttendeeRow(sb, uid, em);
  let attendee = await ensureAttendeeRow(
    sb,
    uid,
    em,
    body.name !== undefined ? body.name : existing?.name || authUser.name
  );

  const attendeePatch = {};
  if (body.name !== undefined) attendeePatch.name = String(body.name || '').trim();
  if (body.location !== undefined) attendeePatch.location = String(body.location || '').trim();
  if (body.businessSector !== undefined) {
    attendeePatch.business_sector = String(body.businessSector || '').trim() || null;
  }
  if (body.marketPreferences !== undefined) {
    const prefs = String(body.marketPreferences || '').trim();
    attendeePatch.market_preferences = prefs || null;
    attendeePatch.interests = preferencesToInterests(prefs);
  }

  if (Object.keys(attendeePatch).length) {
    let updated = null;
    let updateErr = null;
    const primary = await sb
      .from('attendees')
      .update(attendeePatch)
      .eq('id', attendee.id)
      .select('*')
      .single();
    if (!primary.error) {
      updated = primary.data;
    } else {
      updateErr = primary.error;
      const msg = String(primary.error.message || '').toLowerCase();
      if (msg.includes('business_sector') || msg.includes('market_preferences')) {
        const fallback = { ...attendeePatch };
        delete fallback.business_sector;
        delete fallback.market_preferences;
        if (Object.keys(fallback).length) {
          const retry = await sb
            .from('attendees')
            .update(fallback)
            .eq('id', attendee.id)
            .select('*')
            .single();
          if (!retry.error) updated = retry.data;
          else updateErr = retry.error;
        }
      }
    }
    if (!updated) throw new Error(updateErr?.message || 'Could not save profile');
    attendee = updated;
  }

  let hubAccount = null;
  const hubPatch = {};
  if (body.name !== undefined && uid) {
    hubPatch.display_name = String(body.name || '').trim() || null;
  }
  if (body.emailsEnabled !== undefined && uid) {
    hubPatch.emails_enabled = Boolean(body.emailsEnabled);
  }
  if (body.emailPrefEventReminders !== undefined && uid) {
    hubPatch.email_pref_event_reminders = Boolean(body.emailPrefEventReminders);
  }
  if (body.emailPrefOrganiserAlerts !== undefined && uid) {
    hubPatch.email_pref_organiser_alerts = Boolean(body.emailPrefOrganiserAlerts);
  }

  if (Object.keys(hubPatch).length && uid) {
    let updated = null;
    let updateErr = null;
    const primary = await sb
      .from('hub_accounts')
      .update(hubPatch)
      .eq('user_id', uid)
      .select('*')
      .single();
    if (!primary.error) {
      updated = primary.data;
    } else {
      updateErr = primary.error;
      const msg = String(primary.error.message || '').toLowerCase();
      if (
        msg.includes('email_pref_event_reminders') ||
        msg.includes('email_pref_organiser_alerts')
      ) {
        const fallback = { ...hubPatch };
        delete fallback.email_pref_event_reminders;
        delete fallback.email_pref_organiser_alerts;
        if (Object.keys(fallback).length) {
          const retry = await sb
            .from('hub_accounts')
            .update(fallback)
            .eq('user_id', uid)
            .select('*')
            .single();
          if (!retry.error) updated = retry.data;
          else updateErr = retry.error;
        }
      }
    }
    if (!updated && Object.keys(hubPatch).length) {
      throw new Error(updateErr?.message || 'Could not save email preferences');
    }
    hubAccount = updated;
  } else if (uid) {
    const { data } = await sb.from('hub_accounts').select('*').eq('user_id', uid).maybeSingle();
    hubAccount = data;
  }

  return {
    profile: rowToProfile(session, hubAccount, attendee),
    writable: WRITABLE,
    message: 'Your details were saved.',
  };
}

async function changePassword(session, currentPassword, newPassword) {
  const em = String(session.email || '').toLowerCase();
  const login = await sbAuth.verifyLogin(em, currentPassword);
  if (!login.ok) {
    const e = new Error('Current password is incorrect.');
    e.status = 403;
    e.code = 'wrong_password';
    throw e;
  }

  const user = await sbAuth.findUserByEmail(em);
  if (!user) {
    const e = new Error('Account not found');
    e.status = 404;
    throw e;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) throw new Error(error.message);

  return { message: 'Password updated.' };
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  WRITABLE,
};
