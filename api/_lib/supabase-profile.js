/**
 * Account settings profile — hub_accounts + attendees (Supabase).
 */
const { getSupabaseAdmin } = require('./supabase');
const sbAuth = require('./supabase-auth');
const {
  ANONYMOUS_REVIEW_NAME,
  isAnonymousPublicReviewName,
  networkerAlias,
  firstNameLastInitial,
  reviewerDisplayName,
  normalizeStoredPublicReviewName,
} = require('./reviewer-display-name');
const {
  normalizeIndustry,
  isBareOther,
  isAnalyticsProfileComplete,
} = require('./hub-profile-industries');
const { normalizeCountryCode } = require('./profile-countries');
const {
  cleanLookingToMeet,
  cleanMatchmakerBlurb,
  parseDiscoverable,
  matchmakerProfileFromAttendee,
  LOOKING_TO_MEET_OPTIONS,
  BLURB_MAX,
} = require('./hubert-matchmaker-profile');

const WRITABLE = {
  name: true,
  publicReviewName: true,
  location: true,
  countryCode: true,
  company: true,
  jobTitle: true,
  professionalRole: true,
  marketPreferences: true,
  businessSector: true,
  matchmakerBlurb: true,
  lookingToMeet: true,
  discoverable: true,
  hubertIntrosInterest: true,
  hubertIntrosPromptDismiss: true,
};

function resolvePublicReviewNameInput(body) {
  if (body.reviewNameMode != null || body.review_name_mode != null) {
    const mode = String(body.reviewNameMode != null ? body.reviewNameMode : body.review_name_mode)
      .trim()
      .toLowerCase();
    if (mode === 'anonymous' || mode === 'networker') return ANONYMOUS_REVIEW_NAME;
    if (mode === 'name' || mode === 'default' || mode === '') return null;
  }
  if (body.publicReviewName !== undefined || body.public_review_name !== undefined) {
    return normalizeStoredPublicReviewName(
      body.publicReviewName !== undefined ? body.publicReviewName : body.public_review_name
    );
  }
  return undefined;
}

const PROFESSIONAL_ROLES = new Set([
  'founder',
  'director',
  'employee',
  'freelancer',
  'investor',
  'other',
]);

const PROFESSIONAL_ROLE_MAX_LEN = 80;

function isListedProfessionalRole(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return PROFESSIONAL_ROLES.has(s) && s !== 'other';
}

function isBareProfessionalOther(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return s === 'other';
}

function normalizeProfessionalRole(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const slug = trimmed.toLowerCase().replace(/\s+/g, '_');
  if (PROFESSIONAL_ROLES.has(slug) && slug !== 'other') return slug;
  if (slug === 'other') {
    const e = new Error('Please enter your role.');
    e.status = 400;
    e.code = 'invalid_professional_role';
    throw e;
  }
  if (trimmed.length < 2) {
    const e = new Error('Role must be at least 2 characters.');
    e.status = 400;
    e.code = 'invalid_professional_role';
    throw e;
  }
  if (trimmed.length > PROFESSIONAL_ROLE_MAX_LEN) {
    const e = new Error('Role must be 80 characters or fewer.');
    e.status = 400;
    e.code = 'invalid_professional_role';
    throw e;
  }
  return trimmed.replace(/\s+/g, ' ');
}

function storedCountryCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase();
  if (!code || code === 'UK') return 'GB';
  return code;
}

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

  const storedPublic = String(attendee?.public_review_name || '').trim();
  const anonymous = isAnonymousPublicReviewName(storedPublic);
  const legalName = String(hub?.display_name || attendee?.name || '').trim();

  return {
    email: String(session.email || attendee?.email || '').toLowerCase(),
    name: legalName,
    publicReviewName: anonymous ? ANONYMOUS_REVIEW_NAME : '',
    reviewNameMode: anonymous ? 'anonymous' : 'name',
    networkerAlias: networkerAlias(attendee || {}),
    reviewDisplayName: reviewerDisplayName({
      id: attendee?.id,
      name: legalName,
      public_review_name: anonymous ? ANONYMOUS_REVIEW_NAME : null,
    }),
    reviewNameExample: firstNameLastInitial(legalName) || 'Alex M.',
    location: String(attendee?.location || '').trim(),
    countryCode: storedCountryCode(attendee?.country_code),
    company: String(attendee?.company || '').trim(),
    jobTitle: String(attendee?.job_title || '').trim(),
    professionalRole: String(attendee?.professional_role || '').trim(),
    marketPreferences: marketFromRow,
    businessSector: String(attendee?.business_sector || '').trim(),
    ...matchmakerProfileFromAttendee(attendee),
    emailsEnabled: hub?.emails_enabled !== false,
    emailPrefEventReminders: hub?.email_pref_event_reminders !== false,
    emailPrefOrganiserAlerts: hub?.email_pref_organiser_alerts !== false,
    emailPrefOrganiserRoundups: hub?.email_pref_organiser_roundups !== false,
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
  const profile = rowToProfile(session, hubAccount, attendee);
  return {
    profile,
    writable: WRITABLE,
    profileComplete: isAnalyticsProfileComplete(profile),
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
  if (body.publicReviewName !== undefined || body.public_review_name !== undefined || body.reviewNameMode != null || body.review_name_mode != null) {
    const resolved = resolvePublicReviewNameInput(body);
    if (resolved !== undefined) {
      attendeePatch.public_review_name = resolved;
    }
  }
  if (body.location !== undefined) attendeePatch.location = String(body.location || '').trim();
  if (body.countryCode !== undefined || body.country !== undefined) {
    const raw = body.countryCode !== undefined ? body.countryCode : body.country;
    attendeePatch.country_code = normalizeCountryCode(raw);
  }
  if (body.company !== undefined) {
    attendeePatch.company = String(body.company || '').trim() || null;
  }
  if (body.jobTitle !== undefined) {
    const titleRaw = String(body.jobTitle || '').trim();
    if (titleRaw && titleRaw.length < 2) {
      const e = new Error('Job title must be at least 2 characters.');
      e.status = 400;
      e.code = 'invalid_job_title';
      throw e;
    }
    attendeePatch.job_title = titleRaw || null;
  }
  if (body.professionalRole !== undefined) {
    attendeePatch.professional_role = normalizeProfessionalRole(body.professionalRole);
  }
  if (body.businessSector !== undefined) {
    const sectorRaw = String(body.businessSector || '').trim();
    if (sectorRaw) {
      if (sectorRaw.length < 2) {
        const e = new Error('Industry must be at least 2 characters.');
        e.status = 400;
        e.code = 'invalid_industry';
        throw e;
      }
      if (isBareOther(sectorRaw)) {
        const e = new Error('Please enter your industry.');
        e.status = 400;
        e.code = 'invalid_industry';
        throw e;
      }
      if (sectorRaw.length > 80) {
        const e = new Error('Industry must be 80 characters or fewer.');
        e.status = 400;
        e.code = 'invalid_industry';
        throw e;
      }
    }
    attendeePatch.business_sector = sectorRaw ? normalizeIndustry(sectorRaw) : null;
  }
  if (body.marketPreferences !== undefined) {
    const prefs = String(body.marketPreferences || '').trim();
    attendeePatch.market_preferences = prefs || null;
    attendeePatch.interests = preferencesToInterests(prefs);
  }
  if (body.matchmakerBlurb !== undefined || body.matchmaker_blurb !== undefined) {
    const raw = body.matchmakerBlurb !== undefined ? body.matchmakerBlurb : body.matchmaker_blurb;
    const blurb = cleanMatchmakerBlurb(raw);
    if (String(raw || '').trim().length > BLURB_MAX) {
      const e = new Error('Headline must be ' + BLURB_MAX + ' characters or fewer.');
      e.status = 400;
      e.code = 'invalid_matchmaker_blurb';
      throw e;
    }
    attendeePatch.matchmaker_blurb = blurb || null;
  }
  if (body.lookingToMeet !== undefined || body.looking_to_meet !== undefined) {
    attendeePatch.looking_to_meet = cleanLookingToMeet(
      body.lookingToMeet !== undefined ? body.lookingToMeet : body.looking_to_meet
    );
  }
  if (body.discoverable !== undefined || body.discoverableAt !== undefined || body.discoverable_at !== undefined) {
    const next = parseDiscoverable(
      body.discoverable !== undefined ? body.discoverable : body.discoverableAt !== undefined ? body.discoverableAt : body.discoverable_at,
      attendee?.discoverable_at || null
    );
    if (next !== undefined) attendeePatch.discoverable_at = next;
  }
  if (
    body.hubertIntrosInterest === true ||
    body.hubert_intros_interest === true ||
    body.hubertOptIn === true ||
    body.hubert_opt_in === true
  ) {
    attendeePatch.hubert_intros_interest_at =
      attendee?.hubert_intros_interest_at || new Date().toISOString();
  }
  if (
    body.hubertIntrosPromptDismiss === true ||
    body.hubert_intros_prompt_dismiss === true ||
    body.hubertPromptDismiss === true
  ) {
    attendeePatch.hubert_intros_prompt_dismissed_at =
      attendee?.hubert_intros_prompt_dismissed_at || new Date().toISOString();
  }

  if (Object.keys(attendeePatch).length) {
    let updated = null;
    let updateErr = null;

    async function writeAttendeePatch(patch) {
      const res = await sb.from('attendees').update(patch).eq('id', attendee.id).select('*').maybeSingle();
      if (res.error) return { data: null, error: res.error };
      if (res.data) return { data: res.data, error: null };
      return {
        data: null,
        error: { message: 'No attendee row updated for this account', code: 'no_rows' },
      };
    }

    const primary = await writeAttendeePatch(attendeePatch);
    if (primary.data) {
      updated = primary.data;
    } else {
      updateErr = primary.error;
      const msg = String((primary.error && primary.error.message) || '').toLowerCase();
      const code = String((primary.error && primary.error.code) || '');
      if (msg.includes('country_code')) {
        const withoutCountry = { ...attendeePatch };
        delete withoutCountry.country_code;
        if (Object.keys(withoutCountry).length) {
          const retryCountry = await writeAttendeePatch(withoutCountry);
          if (retryCountry.data && !retryCountry.error) updated = retryCountry.data;
          else updateErr = retryCountry.error || updateErr;
        } else {
          updated = attendee;
        }
      } else if (
        msg.includes('business_sector') ||
        msg.includes('market_preferences') ||
        msg.includes('job_title') ||
        msg.includes('professional_role') ||
        msg.includes('public_review_name') ||
        msg.includes('matchmaker_blurb') ||
        msg.includes('looking_to_meet') ||
        msg.includes('discoverable_at') ||
        msg.includes('hubert_intros_interest_at') ||
        msg.includes('hubert_intros_prompt_dismissed_at') ||
        msg.includes('schema cache') ||
        code === 'PGRST204'
      ) {
        const fallback = { ...attendeePatch };
        delete fallback.business_sector;
        delete fallback.market_preferences;
        delete fallback.country_code;
        if (msg.includes('job_title')) delete fallback.job_title;
        if (msg.includes('professional_role')) delete fallback.professional_role;
        if (msg.includes('public_review_name')) delete fallback.public_review_name;
        // If any Hubert column is missing / schema cache stale, drop Hubert fields together.
        const matchmakerMissing =
          msg.includes('matchmaker_blurb') ||
          msg.includes('looking_to_meet') ||
          msg.includes('discoverable_at') ||
          msg.includes('hubert_intros_interest_at') ||
          msg.includes('hubert_intros_prompt_dismissed_at') ||
          msg.includes('schema cache') ||
          code === 'PGRST204';
        if (matchmakerMissing) {
          delete fallback.matchmaker_blurb;
          delete fallback.looking_to_meet;
          delete fallback.discoverable_at;
          delete fallback.hubert_intros_interest_at;
          delete fallback.hubert_intros_prompt_dismissed_at;
        }
        const matchmakerOnlyPatch = Object.keys(attendeePatch).every((k) =>
          [
            'matchmaker_blurb',
            'looking_to_meet',
            'discoverable_at',
            'hubert_intros_interest_at',
            'hubert_intros_prompt_dismissed_at',
          ].includes(k)
        );
        if (matchmakerMissing && matchmakerOnlyPatch) {
          const e = new Error(
            'Hubert profile columns aren’t visible to the API yet (schema cache). Run migration 337_reload_postgrest_schema_matchmaker.sql, wait ~30s, then try again.'
          );
          e.status = 503;
          e.code = 'matchmaker_schema_cache';
          throw e;
        }
        if (Object.keys(fallback).length) {
          const retry = await writeAttendeePatch(fallback);
          if (retry.data && !retry.error) updated = retry.data;
          else if (retry.data && retry.error && retry.error.code === 'no_rows') updated = retry.data;
          else updateErr = retry.error || updateErr;
        } else {
          updated = attendee;
        }
      }
    }
    if (!updated) {
      const e = new Error((updateErr && updateErr.message) || 'Could not save profile');
      e.status = 500;
      e.code = (updateErr && updateErr.code) || 'profile_save_failed';
      throw e;
    }
    attendee = updated;

    const touchedMatchmaker =
      body.matchmakerBlurb !== undefined ||
      body.matchmaker_blurb !== undefined ||
      body.lookingToMeet !== undefined ||
      body.looking_to_meet !== undefined ||
      body.discoverable !== undefined ||
      body.discoverableAt !== undefined ||
      body.discoverable_at !== undefined;
    if (touchedMatchmaker) {
      const fresh = await sb
        .from('attendees')
        .select(
          'id, name, company, job_title, professional_role, business_sector, matchmaker_blurb, looking_to_meet, discoverable_at'
        )
        .eq('id', attendee.id)
        .maybeSingle();
      if (!fresh.error && fresh.data) {
        attendee = { ...attendee, ...fresh.data };
      }
      const saved = matchmakerProfileFromAttendee(attendee);
      const wantedBlurb =
        body.matchmakerBlurb !== undefined || body.matchmaker_blurb !== undefined
          ? cleanMatchmakerBlurb(
              body.matchmakerBlurb !== undefined ? body.matchmakerBlurb : body.matchmaker_blurb
            )
          : null;
      const wantedLooking =
        body.lookingToMeet !== undefined || body.looking_to_meet !== undefined
          ? cleanLookingToMeet(
              body.lookingToMeet !== undefined ? body.lookingToMeet : body.looking_to_meet
            )
          : null;
      const wantedDiscoverable =
        body.discoverable !== undefined || body.discoverableAt !== undefined || body.discoverable_at !== undefined
          ? parseDiscoverable(
              body.discoverable !== undefined
                ? body.discoverable
                : body.discoverableAt !== undefined
                  ? body.discoverableAt
                  : body.discoverable_at,
              attendee?.discoverable_at || null
            )
          : undefined;

      if (wantedBlurb && saved.matchmakerBlurb !== wantedBlurb) {
        const e = new Error(
          'Headline didn’t save. Run migration 337 to reload the API schema, wait 30 seconds, then try again.'
        );
        e.status = 503;
        e.code = 'matchmaker_persist_failed';
        throw e;
      }
      if (wantedLooking && wantedLooking.length && saved.lookingToMeet.length === 0) {
        const e = new Error(
          '“Who you want to meet” didn’t save. Run migration 337 to reload the API schema, wait 30 seconds, then try again.'
        );
        e.status = 503;
        e.code = 'matchmaker_persist_failed';
        throw e;
      }
      if (wantedDiscoverable && !saved.discoverable) {
        const e = new Error(
          'Include me didn’t save. Run migration 337 to reload the API schema, wait 30 seconds, then try again.'
        );
        e.status = 503;
        e.code = 'matchmaker_persist_failed';
        throw e;
      }
    }
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
  if (body.emailPrefOrganiserRoundups !== undefined && uid) {
    hubPatch.email_pref_organiser_roundups = Boolean(body.emailPrefOrganiserRoundups);
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
        msg.includes('email_pref_organiser_alerts') ||
        msg.includes('email_pref_organiser_roundups')
      ) {
        const fallback = { ...hubPatch };
        delete fallback.email_pref_event_reminders;
        delete fallback.email_pref_organiser_alerts;
        delete fallback.email_pref_organiser_roundups;
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
    if (!updated && isMissingHubRow(updateErr)) {
      const created = await sb
        .from('hub_accounts')
        .upsert(
          {
            user_id: uid,
            role: session.role === 'admin' ? 'admin' : 'client',
            ...hubPatch,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .maybeSingle();
      if (!created.error) updated = created.data;
      else updateErr = created.error;
    }
    if (!updated && Object.keys(hubPatch).length) {
      throw new Error(updateErr?.message || 'Could not save email preferences');
    }
    hubAccount = updated;
  } else if (uid) {
    const { data } = await sb.from('hub_accounts').select('*').eq('user_id', uid).maybeSingle();
    hubAccount = data;
  }

  if (body.emailsEnabled !== undefined && em) {
    const { setEmailSuppressed } = require('./email-unsubscribe');
    await setEmailSuppressed(em, body.emailsEnabled === false || body.emailsEnabled === 'false');
  }

  const profile = rowToProfile(session, hubAccount, attendee);
  const emailOnly = Object.keys(body).every(function (key) {
    return (
      key === 'emailsEnabled' ||
      key === 'emailPrefEventReminders' ||
      key === 'emailPrefOrganiserAlerts' ||
      key === 'emailPrefOrganiserRoundups'
    );
  });
  return {
    profile,
    writable: WRITABLE,
    profileComplete: isAnalyticsProfileComplete(profile),
    message: emailOnly ? 'Email preferences saved.' : 'Your details were saved.',
  };
}

function isMissingHubRow(error) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  return code === 'PGRST116' || /0 rows|no rows|multiple \(or no\) rows|cannot coerce/i.test(msg);
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
  PROFESSIONAL_ROLES,
  normalizeProfessionalRole,
  isListedProfessionalRole,
  isBareProfessionalOther,
};
