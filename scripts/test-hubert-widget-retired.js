#!/usr/bin/env node
/**
 * Floating Hubert corner launcher must stay off site-wide.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const widgetSrc = fs.readFileSync(path.join(__dirname, '../js/hubert-widget.js'), 'utf8');
const footerSrc = fs.readFileSync(path.join(__dirname, '../js/site-footer.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert.ok(/^\s*return;/m.test(widgetSrc) || /Floating corner launcher is retired/.test(widgetSrc), 'widget retired');
assert.ok(footerSrc.indexOf('hubert-widget.js') === -1, 'footer no longer injects hubert-widget');
assert.ok(homeHtml.indexOf('hubert-widget.js') === -1, 'home does not load floating widget');

const sandbox = {
  window: {},
  document: {
    currentScript: null,
    getElementById: function () {
      return null;
    },
    createElement: function () {
      throw new Error('hubert-widget must not create DOM');
    },
  },
};
vm.createContext(sandbox);
vm.runInContext(widgetSrc, sandbox);
assert.strictEqual(sandbox.window.HubertWidget, undefined, 'no HubertWidget export when retired');

console.log('ok — hubert floating widget retired');
