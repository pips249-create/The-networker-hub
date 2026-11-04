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
assert.ok(/What is The Networker UK/i.test(joinHtml), 'join page explains Networker UK');
assert.ok(/Events &amp; organisers|Events & organisers/i.test(joinHtml), 'lists events find');
assert.ok(/TINA introductions/i.test(joinHtml), 'lists TINA');
assert.ok(/Business opportunities/i.test(joinHtml), 'lists opportunities');
assert.ok(/attended/i.test(joinHtml), 'copy talks about attended, not ticket purchase');
assert.ok(!/free ticket on your account/i.test(joinHtml), 'no free-ticket purchase framing');
assert.ok(/logo-nav-transparent|The Networker UK/i.test(joinHtml), 'UK branding');

const joinJs = read('js/lbs-tina-join.js');
assert.ok(joinJs.includes('/api/auth/lbs-stand-attend'), 'calls stand-attend API');
assert.ok(!joinJs.includes('complete-booking'), 'does not purchase via complete-booking');
assert.ok(/attended/i.test(joinJs), 'status copy uses attended');

const authRoute = read('api/auth.js');
assert.ok(authRoute.includes('lbs-stand-attend'), 'auth router mounts lbs-stand-attend');

const standAttend = read('api/_lib/routes/auth-lbs-stand-attend.js');
assert.ok(standAttend.includes('skipConfirmationEmail'), 'no ticket confirmation email');
assert.ok(standAttend.includes('the-business-show-london'), 'targets Business Show slug');
assert.ok(standAttend.includes("paymentStatus: 'Free'"), 'free attendance registration');

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

const enableCss = read('css/organiser-enable.css');
assert.ok(/\.org-enable-panel\s*\{\s*order:\s*-1/m.test(enableCss), 'confirm panel first on mobile');
assert.ok(!/\.org-enable-previews\s*\{[^}]*order:\s*-1/m.test(enableCss), 'previews no longer first on mobile');

console.log('ok — lbs tina join flow');
