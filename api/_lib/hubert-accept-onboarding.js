/**
 * Non-member / inbound Accept onboarding — 2 quick picks before the Hub thread opens.
 * Industry + Looking to meet; then mark discoverable so B joins the match pool.
 * Contact details are never revealed.
 */
const {
  LOOKING_TO_MEET_OPTIONS,
  cleanLookingToMeet,
  cleanMatchmakerBlurb,
  suggestMatchmakerBlurb,
} = require('./hubert-matchmaker-profile');
const {
  HUB_PROFILE_INDUSTRIES,
  normalizeIndustry,
  isBareOther,
} = require('./hub-profile-industries');

/** Compact industry list for the Accept screen (excludes bare Other). */
const ACCEPT_INDUSTRY_OPTIONS = HUB_PROFILE_INDUSTRIES.filter(
  (label) => String(label).toLowerCase() !== 'other'
);

function acceptOnboardingOptions() {
  return {
    industryOptions: ACCEPT_INDUSTRY_OPTIONS.slice(),
    lookingToMeetOptions: LOOKING_TO_MEET_OPTIONS.slice(),
  };
}

function parseAcceptOnboarding(input) {
  const industry = normalizeIndustry(
    input && (input.industry != null ? input.industry : input.businessSector)
  );
  const lookingToMeet = cleanLookingToMeet(
    input && (input.lookingToMeet != null ? input.lookingToMeet : input.looking_to_meet)
  );

  if (!industry || industry.length < 2 || isBareOther(industry)) {
    const err = new Error('Pick your industry to continue.');
    err.code = 'accept_industry_required';
    err.status = 400;
    throw err;
  }
  if (!lookingToMeet.length) {
    const err = new Error('Pick who you want to meet to continue.');
    err.code = 'accept_looking_required';
    err.status = 400;
    throw err;
  }

  return { industry, lookingToMeet };
}

/**
 * Prefer submitted tags; otherwise reuse an existing attendee profile so
 * members who already completed Hubert setup are not blocked on Accept.
 */
async function resolveAcceptOnboarding(sb, opts) {
  const submittedIndustry = opts && (opts.industry != null || opts.businessSector != null);
  const submittedLooking =
    opts && (opts.lookingToMeet != null || opts.looking_to_meet != null);
  if (submittedIndustry || submittedLooking) {
    return { ...parseAcceptOnboarding(opts), fromProfile: false };
  }

  const attendeeId = opts && opts.attendeeId ? String(opts.attendeeId) : '';
  if (attendeeId && sb) {
    const { data: attendee } = await sb
      .from('attendees')
      .select('id, business_sector, looking_to_meet')
      .eq('id', attendeeId)
      .maybeSingle();
    if (attendee) {
      const industry = normalizeIndustry(attendee.business_sector);
      const lookingToMeet = cleanLookingToMeet(attendee.looking_to_meet);
      if (industry && industry.length >= 2 && !isBareOther(industry) && lookingToMeet.length) {
        return { industry, lookingToMeet, fromProfile: true };
      }
    }
  }

  return parseAcceptOnboarding(opts || {});
}

async function applyAcceptOnboardingTags(sb, opts) {
  const resolved = await resolveAcceptOnboarding(sb, opts || {});
  const { industry, lookingToMeet } = resolved;
  const now = new Date().toISOString();
  const attendeeId = opts && opts.attendeeId ? String(opts.attendeeId) : '';
  const seedId = opts && opts.seedId ? String(opts.seedId) : '';
  const result = { industry, lookingToMeet, attendeeUpdated: false, seedUpdated: false };

  if (attendeeId) {
    const { data: attendee } = await sb
      .from('attendees')
      .select(
        'id, name, company, job_title, professional_role, business_sector, matchmaker_blurb, looking_to_meet, discoverable_at, hubert_intros_interest_at'
      )
      .eq('id', attendeeId)
      .maybeSingle();

    if (attendee) {
      const blurb =
        cleanMatchmakerBlurb(attendee.matchmaker_blurb) ||
        suggestMatchmakerBlurb({
          ...attendee,
          professional_role: attendee.professional_role || attendee.job_title,
          company: attendee.company,
        }) ||
        cleanMatchmakerBlurb(
          (attendee.job_title || attendee.professional_role || 'Networker') + ' · ' + industry
        );

      const patch = {
        business_sector: industry,
        looking_to_meet: lookingToMeet,
        matchmaker_blurb: blurb || null,
        discoverable_at: attendee.discoverable_at || now,
        hubert_intros_interest_at: attendee.hubert_intros_interest_at || now,
        updated_at: now,
      };

      const { error } = await sb.from('attendees').update(patch).eq('id', attendeeId);
      if (error) {
        // Soft-fail column gaps — still try looking_to_meet + discoverable.
        const msg = String(error.message || '');
        if (/matchmaker_blurb|hubert_intros_interest_at|discoverable_at|looking_to_meet|business_sector/i.test(msg)) {
          const fallback = { updated_at: now };
          if (!/looking_to_meet/i.test(msg)) fallback.looking_to_meet = lookingToMeet;
          if (!/business_sector/i.test(msg)) fallback.business_sector = industry;
          if (!/discoverable_at/i.test(msg)) fallback.discoverable_at = attendee.discoverable_at || now;
          if (!/matchmaker_blurb/i.test(msg) && blurb) fallback.matchmaker_blurb = blurb;
          if (!/hubert_intros_interest_at/i.test(msg)) {
            fallback.hubert_intros_interest_at = attendee.hubert_intros_interest_at || now;
          }
          const retry = await sb.from('attendees').update(fallback).eq('id', attendeeId);
          if (retry.error) throw new Error(retry.error.message);
        } else {
          throw new Error(error.message);
        }
      }
      result.attendeeUpdated = true;
    }
  }

  if (seedId) {
    const seedPatch = {
      industry,
      looking_to_meet: lookingToMeet,
      updated_at: now,
    };
    if (attendeeId) {
      seedPatch.converted_attendee_id = attendeeId;
      seedPatch.status = 'converted';
      seedPatch.pause_reason = null;
      seedPatch.paused_at = null;
    }
    const { error: seedErr } = await sb.from('hubert_match_seed').update(seedPatch).eq('id', seedId);
    if (seedErr) {
      const msg = String(seedErr.message || '');
      if (!/looking_to_meet|industry|converted_attendee/i.test(msg)) {
        throw new Error(seedErr.message);
      }
      // Soft-skip if columns missing pre-migration.
    } else {
      result.seedUpdated = true;
    }
  }

  return result;
}

module.exports = {
  ACCEPT_INDUSTRY_OPTIONS,
  acceptOnboardingOptions,
  parseAcceptOnboarding,
  resolveAcceptOnboarding,
  applyAcceptOnboardingTags,
};
