#!/usr/bin/env node
/**
 * Smoke for London Business Show leaflet join: explainer, required name,
 * TINA opt-in from QR, attendance (not ticket purchase), confirm-email order.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const joinHtml = read('lbs-tina-join.html');
assert.ok(/The Networker UK/i.test(joinHtml), 'join page mentions Networker UK');
assert.ok(/TINA/i.test(joinHtml), 'lists TINA');
assert.ok(/attended/i.test(joinHtml), 'copy talks about attended, not ticket purchase');
assert.ok(!/free ticket on your account/i.test(joinHtml), 'no free-ticket purchase framing');
assert.ok(/logo-nav-transparent|The Networker UK/i.test(joinHtml), 'UK branding');
assert.ok(joinHtml.includes('lbs-signup-form'), 'QR landing has inline signup form');
assert.ok(joinHtml.includes('id="lbs-name"'), 'inline form has full name');
assert.ok(joinHtml.includes('id="lbs-email"'), 'inline form has email');
assert.ok(joinHtml.includes('id="lbs-company"'), 'inline form has company');
assert.ok(joinHtml.includes('id="lbs-location"'), 'inline form has location');
assert.ok(joinHtml.includes('id="lbs-password"'), 'inline form has password');
assert.ok(joinHtml.includes('hub-turnstile.js'), 'inline form loads turnstile');

const joinJs = read('js/lbs-tina-join.js');
assert.ok(joinJs.includes('/api/auth/lbs-stand-attend'), 'calls stand-attend API');
assert.ok(joinJs.includes('/api/auth/register'), 'inline form posts to register API');
assert.ok(joinJs.includes("signupSource: 'tina_lbs'"), 'inline signup tags tina_lbs source');
assert.ok(joinJs.includes('company: company'), 'inline signup sends company');
assert.ok(joinJs.includes('location: location'), 'inline signup sends location');
assert.ok(!joinJs.includes('complete-booking'), 'does not purchase via complete-booking');
assert.ok(/attended/i.test(joinJs), 'status copy uses attended');

const authRoute = read('api/auth.js');
assert.ok(authRoute.includes('lbs-stand-attend'), 'auth router mounts lbs-stand-attend');

const standAttend = read('api/_lib/routes/auth-lbs-stand-attend.js');
assert.ok(standAttend.includes('skipConfirmationEmail'), 'no ticket confirmation email');
assert.ok(standAttend.includes('skipConfirmationEmail: true'), 'stand-attend skips confirmation email');
assert.ok(standAttend.includes('the-business-show-london'), 'targets Business Show slug');
assert.ok(standAttend.includes("paymentStatus: 'Free'"), 'free attendance registration');

const notifyGuardSrc = read('api/_lib/organiser-registration-notify-guard.js');
assert.ok(notifyGuardSrc.includes('phoebe.strange'), 'blocks Phoebe.strange local-part');
assert.ok(notifyGuardSrc.includes('the-business-show-london'), 'guard scoped to Business Show');
assert.ok(
  notifyGuardSrc.includes('shouldSkipOrganiserNewRegistrationNotify'),
  'exports organiser notify skip helper'
);

const {
  shouldSkipOrganiserNewRegistrationNotify,
} = require('../api/_lib/organiser-registration-notify-guard');
assert.strictEqual(
  shouldSkipOrganiserNewRegistrationNotify({
    email: 'Phoebe.Strange@example.com',
    eventSlug: 'the-business-show-london',
  }),
  true,
  'case-insensitive Phoebe.strange blocked for Business Show'
);
assert.strictEqual(
  shouldSkipOrganiserNewRegistrationNotify({
    email: 'phoebe.strange@businesseventsessex.com',
    eventSlug: 'the-business-show-london',
  }),
  true,
  'Phoebe.strange blocked for Business Show QR/stand notify'
);
assert.strictEqual(
  shouldSkipOrganiserNewRegistrationNotify({
    email: 'other.organiser@example.com',
    eventSlug: 'the-business-show-london',
  }),
  false,
  'other organisers still notify on Business Show'
);
assert.strictEqual(
  shouldSkipOrganiserNewRegistrationNotify({
    email: 'phoebe.strange@example.com',
    eventSlug: 'some-other-event',
  }),
  false,
  'Phoebe block is Business Show only'
);

const registrationEmails = read('api/_lib/registration-emails.js');
assert.ok(
  registrationEmails.includes('organiser-registration-notify-guard'),
  'registration emails use Phoebe notify guard'
);
assert.ok(
  registrationEmails.includes('shouldSkipOrganiserNewRegistrationNotify'),
  'organiser_new_registration path checks Phoebe guard'
);
assert.ok(
  registrationEmails.includes('organiser_notify_blocked_phoebe_strange_lbs'),
  'Phoebe.strange organiser notify block is wired'
);

const supabaseRegs = read('api/_lib/supabase-registrations.js');
assert.ok(
  /skipConfirmationEmail/.test(supabaseRegs),
  'createRegistrationFromPayment honour skipConfirmationEmail'
);
assert.ok(
  supabaseRegs.includes('if (!skipConfirmationEmail && !existingSession.data.ticket_email_sent)'),
  'exists (checkout session) path respects skipConfirmationEmail'
);
assert.ok(
  supabaseRegs.includes('if (!skipConfirmationEmail && !existing.data.ticket_email_sent)'),
  'exists (payment intent) path respects skipConfirmationEmail'
);
assert.ok(
  /if \(!skipConfirmationEmail\) \{\s*try \{\s*emailResult = await sendRegistrationEmails\(sb, upd\.data\)/m.test(
    supabaseRegs
  ),
  'linked/update path respects skipConfirmationEmail'
);

const registerHtml = read('register.html');
assert.ok(!/Tickets from 9am on 1 September/i.test(registerHtml), 'Sept soft-launch proof removed');
assert.ok(!/Browsing is open/i.test(registerHtml), 'browsing-is-open soft-launch removed');
assert.ok(!/auth-optional/.test(registerHtml) || !/Full name[\s\S]*auth-optional/.test(registerHtml), 'full name not marked optional');
assert.ok(/label for="name">Full name</.test(registerHtml), 'full name label present');
assert.ok(/id="name"[^>]*required/.test(registerHtml), 'full name input required');

const authJs = read('js/auth.js');
assert.ok(authJs.includes('isTinaLbsJoinEntry'), 'detects LBS QR entry');
assert.ok(authJs.includes('applyTinaLbsRegisterDefaults'), 'applies LBS register defaults');
assert.ok(!/hubertEl\.checked = true/.test(authJs), 'does not pre-tick TINA checkbox (Recital 32)');
assert.ok(/hubertOptIn: lbsTinaJoin \? true/.test(authJs), 'leaflet path sets hubertOptIn in payload');
assert.ok(authJs.includes('register-hubert-lbs-note'), 'shows TINA leaflet disclosure note');
assert.ok(authJs.includes('isAttendeeSignupEntry'), 'forces full form for attendee join');
assert.ok(authJs.includes('Please enter your full name.'), 'client requires full name');

const registerRoute = read('api/_lib/routes/auth-register.js');
assert.ok(registerRoute.includes('missing_name'), 'server requires full name');
assert.ok(registerRoute.includes('tinaLbsJoin'), 'server recognises TINA leaflet campaign');
assert.ok(registerRoute.includes("utmCampaign === 'tina_lbs'"), 'server maps tina_lbs to intros');

assert.ok(registerHtml.includes('register-hubert-lbs-note'), 'register has leaflet TINA disclosure');
assert.ok(registerHtml.includes('register-lbs-extra-fields'), 'register has LBS company/location block');
assert.ok(/id="company"/.test(registerHtml), 'register has company field');
assert.ok(/id="location"/.test(registerHtml), 'register has location field');

assert.ok(authJs.includes('register-lbs-extra-fields'), 'LBS path reveals company/location fields');
assert.ok(authJs.includes("payload.company = company"), 'LBS path sends company');
assert.ok(authJs.includes("payload.location = location"), 'LBS path sends location');
assert.ok(authJs.includes("signupSource = 'tina_lbs'"), 'LBS path tags signupSource');

assert.ok(registerRoute.includes('missing_company'), 'server requires company on LBS join');
assert.ok(registerRoute.includes('missing_location'), 'server requires location on LBS join');
assert.ok(registerRoute.includes('signupSource'), 'server accepts signupSource');

const registerUserSrc = read('api/_lib/supabase-auth.js');
assert.ok(registerUserSrc.includes('signup_source'), 'registerUser persists signup_source');
assert.ok(registerUserSrc.includes('matchmaker_blurb'), 'registerUser can seed basic TINA blurb');

const migration = read('supabase/migrations/360_lbs_tina_quick_signup.sql');
assert.ok(migration.includes('signup_source'), 'migration adds signup_source');
assert.ok(migration.includes('lbs_finish_profile_email_sent_at'), 'migration adds finish-profile claim');

const finishTpl = read('email-templates/attendee-lbs-finish-tina-profile.html');
assert.ok(/Thanks for joining The Networker UK/i.test(finishTpl), 'finish-profile email thanks them');
assert.ok(/signup_count_sentence/.test(finishTpl), 'finish-profile email includes show signup count');
assert.ok(/Finish your TINA profile/i.test(finishTpl), 'finish-profile email CTAs to TINA');

const engagement = read('api/_lib/engagement-emails.js');
assert.ok(engagement.includes('sendDueLbsFinishTinaProfileEmails'), 'engagement has LBS finish-profile sender');
assert.ok(engagement.includes("signup_source', LBS_SIGNUP_SOURCE"), 'targets tina_lbs signups');

const bookingCron = read('api/_lib/routes/cron-booking-reminders.js');
assert.ok(bookingCron.includes('sendDueLbsFinishTinaProfileEmails'), 'hourly cron runs LBS finish-profile');

const branded = read('api/_lib/branded-email-templates.js');
assert.ok(branded.includes('attendee_lbs_finish_tina_profile'), 'branded templates register LBS email');

const {
  formatLbsSignupCountSentence,
  tinaProfileIncomplete,
} = require('../api/_lib/engagement-emails');
assert.ok(
  /128 people have signed up from The Business Show London/.test(formatLbsSignupCountSentence(128)),
  'signup count sentence formats plural'
);
assert.strictEqual(
  tinaProfileIncomplete({ matchmaker_blurb: 'Works at Acme', looking_to_meet: [], discoverable_at: null }),
  true,
  'incomplete without looking-to-meet / discoverable'
);
assert.strictEqual(
  tinaProfileIncomplete({
    matchmaker_blurb: 'Works at Acme',
    looking_to_meet: ['Clients'],
    discoverable_at: '2026-11-04T12:00:00.000Z',
  }),
  false,
  'complete when discoverable + blurb + looking-to-meet'
);

const enableCss = read('css/organiser-enable.css');
assert.ok(/\.org-enable-panel\s*\{\s*order:\s*-1/m.test(enableCss), 'confirm panel first on mobile');
assert.ok(!/\.org-enable-previews\s*\{[^}]*order:\s*-1/m.test(enableCss), 'previews no longer first on mobile');

console.log('ok — lbs tina join flow');
