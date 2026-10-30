#!/usr/bin/env node
/**
 * Guards the attendee side-nav "Event tickets" route.
 * Clicking Event tickets while on "Events I've attended" (past scope) must
 * switch to upcoming — otherwise the nav click appears to do nothing.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashPath = path.join(root, 'js/attendee-dashboard.js');
const accountPath = path.join(root, 'account/index.html');
const src = fs.readFileSync(dashPath, 'utf8');
const account = fs.readFileSync(accountPath, 'utf8');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

if (!/data-ad-route="tickets"/.test(account)) {
  fail('account side/bottom nav missing data-ad-route="tickets"');
}
if (!/data-ad-route="past"/.test(account)) {
  fail('account side nav missing data-ad-route="past" for Events I\'ve attended');
}

const setRouteStart = src.indexOf('function setRoute(route) {');
if (setRouteStart < 0) fail('could not locate setRoute implementation');
const setRouteBody = src.slice(setRouteStart, setRouteStart + 1800);
if (!/else if \(nextRoute === 'tickets'\)/.test(setRouteBody)) {
  fail('setRoute must handle abstract tickets route separately from ticket scopes');
}
if (!/setTicketsScope\('upcoming'\)/.test(setRouteBody)) {
  fail('setRoute(tickets) must land on upcoming (so Event tickets leaves past)');
}

const bindStart = src.indexOf('function bindTicketsScope() {');
if (bindStart < 0) fail('could not locate bindTicketsScope implementation');
const bindTicketsBody = src.slice(bindStart, bindStart + 900);
if (
  /setTicketsScope\(scope\);\s*\n\s*if \(currentRoute !== 'tickets'\) setRoute\('tickets'\)/.test(
    bindTicketsBody
  )
) {
  fail(
    'bindTicketsScope must not setTicketsScope then setRoute(tickets) — that resets past → upcoming'
  );
}
if (!/setRoute\(scope\)/.test(bindTicketsBody)) {
  fail('bindTicketsScope must route via setRoute(scope) so past/payments tabs keep their scope');
}

if (!/attendee-dashboard\.js\?v=20261030ticketsnav1/.test(account)) {
  fail('account/index.html cache-buster not bumped for Event tickets nav fix');
}

console.log('ok: Event tickets side-nav leaves past attendance for upcoming bookings');
