#!/usr/bin/env node
/** Replace user-facing "Hub" copy on public pages (not admin/internal code). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = [
  'guides',
  'help',
  'peek',
  'marketing',
  'for-organisers.html',
  'for-networkers.html',
  'for-attendees.html',
  'welcome.html',
  'contact.html',
  'guides.html',
  'add-your-event.html',
  'site-access.html',
  'login.html',
  'register.html',
  'account',
  'events/index.html',
  'events/event.html',
  'opportunities',
];

const REPLACEMENTS = [
  ['Three parts of the Hub', 'Three parts of the platform'],
  ["What's on the Hub", "What's on the platform"],
  ['What&rsquo;s on the Hub', 'What&rsquo;s on the platform'],
  ['about the Hub launch', 'about the launch'],
  ['the Hub launch', 'the launch'],
  ['opening the Hub', 'opening the site'],
  ['the Hub grew', 'The Networker UK grew'],
  ['from the same Hub', 'from the same platform'],
  ['Three parts of the Hub', 'Three parts of the platform'],
  ['list on the Hub', 'list on The Networker UK'],
  ['List on the Hub', 'List on The Networker UK'],
  ['Ready to list on the Hub?', 'Ready to list on The Networker UK?'],
  ['Hub launch notice', 'Launch notice'],
  ['Hub-only tools', 'platform-only tools'],
  ['their Hub profile', 'their profile'],
  ['their Hub account', 'their account'],
  ['from their Hub account', 'from their account'],
  ['Hub account', 'account'],
  ['on the Hub', 'on The Networker UK'],
  ['on the hub', 'on The Networker UK'],
  ['the hub', 'The Networker UK'],
  ['the Hub', 'The Networker UK'],
  ['Sponsor the hub', 'Sponsor The Networker UK'],
  ['Sponsor the Hub', 'Sponsor The Networker UK'],
  ['How to list on the hub', 'How to list on The Networker UK'],
  ['How the Hub is organised', 'How the platform is organised'],
  ['Hub refunds policy', 'Refunds policy'],
  ['Organisers: list on the Hub', 'Organisers: list on The Networker UK'],
  ['across the hub', 'across The Networker UK'],
  ['on the hub.', 'on The Networker UK.'],
  ['on the hub,', 'on The Networker UK,'],
  ['on the hub —', 'on The Networker UK —'],
  ['page on the hub', 'page on The Networker UK'],
  ['pages on the hub', 'pages on The Networker UK'],
  ['live on the hub', 'live on The Networker UK'],
  ['already on the hub', 'already on The Networker UK'],
  ['the hub community', 'The Networker UK community'],
  ['the hub does not', 'The Networker UK does not'],
  ['the hub booking fee', 'the booking fee'],
  ['the hub maximum', 'the maximum'],
  ['via the Hub', 'via The Networker UK'],
  ['through the Hub', 'through The Networker UK'],
  ['pay through the Hub', 'pay through The Networker UK'],
  ['Paying through the Hub', 'Paying through The Networker UK'],
  ['Not paying through the Hub', 'Not paying through The Networker UK'],
  ['Signed up to the Hub', 'Signed up to The Networker UK'],
  ['get found on the Hub', 'get found on The Networker UK'],
  ['Get found on the Hub', 'Get found on The Networker UK'],
  ['Hub partner badge', 'Partner badge'],
  ['Hub LinkedIn', 'Networker UK LinkedIn'],
  ['Hub stats', 'platform stats'],
  ['month-on-the-Hub', 'month on The Networker UK'],
  ['booked via the Hub', 'booked via The Networker UK'],
  ['Hub events', 'Networker UK events'],
  ['Hub team', 'team'],
  ['Hub page', 'organiser page'],
  ['manual Hub payout', 'manual payout'],
  ['You need a Hub account', 'You need an account'],
];

function collectFiles(entry) {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const out = [];
  for (const name of fs.readdirSync(full)) {
    const p = path.join(full, name);
    if (fs.statSync(p).isDirectory()) out.push(...collectFiles(path.relative(ROOT, p)));
    else if (/\.(html|js)$/i.test(name) && !/admin-app|hubert-knowledge/.test(p)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const entry of TARGET_DIRS) {
  for (const filePath of collectFiles(entry)) {
    if (filePath.includes(`${path.sep}organiser${path.sep}index.html`)) continue;
    const before = fs.readFileSync(filePath, 'utf8');
    let after = before;
    for (const [from, to] of REPLACEMENTS) after = after.split(from).join(to);
    if (after !== before) {
      fs.writeFileSync(filePath, after);
      changed += 1;
      console.log('updated', path.relative(ROOT, filePath));
    }
  }
}
console.log('Done —', changed, 'file(s).');
