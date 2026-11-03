#!/usr/bin/env node
/**
 * Home founding organisers strip: logos stay, panel chrome is gone.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const homeHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const homeCss = fs.readFileSync(path.join(__dirname, '../css/home-page.css'), 'utf8');
const homeJs = fs.readFileSync(path.join(__dirname, '../js/home-page.js'), 'utf8');

assert.ok(homeHtml.indexOf('id="home-founding"') !== -1, 'home still has founding section');
assert.ok(homeHtml.indexOf('id="home-founding-logos"') !== -1, 'home keeps founding logo track');
assert.ok(homeHtml.indexOf('home-founding-logos-only') !== -1, 'founding uses logos-only wrapper');
assert.ok(homeHtml.indexOf('home-founding-panel') === -1, 'founding cream panel class removed');
assert.ok(homeHtml.indexOf('home-founding-heading') === -1, 'founding heading id removed');
assert.ok(!/Founding organisers<\/p>/.test(homeHtml), 'founding kicker copy removed');
assert.ok(homeHtml.indexOf('Early organiser partners already live on the platform') === -1, 'founding subtitle removed');
assert.ok(homeHtml.indexOf('Browse organiser pages') === -1, 'founding CTA removed');
assert.ok(homeHtml.indexOf('aria-label="Founding organiser logos"') !== -1, 'section keeps accessible label');

assert.ok(homeCss.indexOf('.home-founding-logos-only') !== -1, 'css has logos-only styles');
assert.ok(homeCss.indexOf('.home-founding-panel') === -1, 'css drops founding panel styles');
assert.ok(homeCss.indexOf('.home-founding-sub') === -1, 'css drops founding subtitle styles');
assert.ok(homeCss.indexOf('.home-founding-cta') === -1, 'css drops founding cta styles');

assert.ok(homeJs.indexOf('renderFoundingOrganisers') !== -1, 'js still paints founding logos');
assert.ok(homeJs.indexOf('loadFoundingOrganisers') !== -1, 'js still loads founding logos');

console.log('ok — home founding logos-only');
