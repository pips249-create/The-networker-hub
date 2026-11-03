#!/usr/bin/env node
/**
 * Home no longer shows the founding organisers logo strip.
 * Founding Organiser · 2026 badges on organiser pages stay elsewhere.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const homeHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const homeCss = fs.readFileSync(path.join(__dirname, '../css/home-page.css'), 'utf8');
const homeJs = fs.readFileSync(path.join(__dirname, '../js/home-page.js'), 'utf8');
const organiserHtml = fs.readFileSync(path.join(__dirname, '../events/organiser.html'), 'utf8');

assert.ok(homeHtml.indexOf('id="home-founding"') === -1, 'home has no founding section');
assert.ok(homeHtml.indexOf('home-founding-logos') === -1, 'home has no founding logo track');
assert.ok(homeHtml.indexOf('Founding organisers') === -1, 'home has no founding organisers copy');
assert.ok(homeHtml.indexOf('Early organiser partners') === -1, 'home has no founding subtitle');
assert.ok(homeCss.indexOf('.home-founding') === -1, 'home css drops founding strip styles');
assert.ok(homeJs.indexOf('loadFoundingOrganisers') === -1, 'home js no longer loads founding strip');
assert.ok(homeJs.indexOf('renderFoundingOrganisers') === -1, 'home js drops founding render');
assert.ok(homeJs.indexOf('/api/founding-organisers') === -1, 'home js does not fetch founding organisers');

// Organiser profile Founding Organiser · 2026 badge remains available.
assert.ok(organiserHtml.indexOf('org-founding-badge') !== -1, 'organiser pages still have founding badge slot');

console.log('ok — home founding strip removed');
