#!/usr/bin/env node
/**
 * Replace user-facing "Hub" product copy with The Networker UK / platform wording.
 * Run: node scripts/fix-hub-user-copy.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SKIP_DIR = new Set(['node_modules', '.git', '.cursor', 'agent-transcripts']);
const SKIP_PATH = [`${path.sep}supabase${path.sep}migrations${path.sep}`];
const SKIP_FILES = /(?:rebrand-networker-uk|fix-hub-user-copy)\.js$/;

/** Longest matches first. Skips Hubert, #hub-rules anchors, and code identifiers. */
const REPLACEMENTS = [
  ['The Networker Hub', 'The Networker UK'],
  ['Networker Hub', 'The Networker UK'],
  ['See your page on the Hub', 'See your page on The Networker UK'],
  ['See your page on The Networker UK &rarr;', 'See your organiser page &rarr;'],
  ['Let the Hub help', 'We can help'],
  ['on your Hub page as soon as you claim', 'on your organiser page as soon as you claim'],
  ['on the Hub organiser leaderboard', 'on the organiser leaderboard'],
  ['on the Hub leaderboard', 'on the organiser leaderboard'],
  ['founding organisers on the Hub leaderboard', 'founding organisers on the leaderboard'],
  ['confirm their organiser page', 'confirm their page'],
  ['invited them to the Hub', 'invited them to The Networker UK'],
  ['already on the Hub organiser leaderboard', 'already on the organiser leaderboard'],
  ['already on the Hub', 'already on The Networker UK'],
  ['helps your Hub profile look sharp', 'helps your organiser profile look sharp'],
  ['Discovery traffic <span class="accent">grows with the Hub</span>', 'Discovery traffic <span class="accent">grows with The Networker UK</span>'],
  ['grows with the Hub', 'grows with The Networker UK'],
  ['See the Hub', 'See the platform'],
  ['WhatsApp and LinkedIn stay for community. The Hub runs', 'WhatsApp and LinkedIn stay for community. The Networker UK runs'],
  ['Your community stays on WIBN. The Hub handles', 'Your community stays on WIBN. The Networker UK handles'],
  ['for your first three months on the Hub', 'for your first three months on The Networker UK'],
  ['Live on the Hub', 'Live on The Networker UK'],
  ['redirect the-networker.co.uk visitors to the Hub', 'redirect the-networker.co.uk visitors to The Networker UK'],
  ['redirecting onto the Hub', 'redirecting to The Networker UK'],
  ['under the Hub logo', 'under the Networker UK logo'],
  ['Reach — proven + moving to the Hub', 'Reach — proven + moving to The Networker UK'],
  ['Expected Hub ranges', 'Expected platform ranges'],
  ['Lock in for a full year and Barnsgate also appears on two Hub launch emails', 'Lock in for a full year and Barnsgate also appears on two launch emails'],
  ['confirm their Hub page', 'confirm their organiser page'],
  ['browsing the Hub can find it', 'browsing The Networker UK can find it'],
  ['We publish the Festival on the Hub', 'We publish the Festival on The Networker UK'],
  ['The Hub will list the Organiser', 'The Networker UK will list the Organiser'],
  ['published on the Hub', 'published on the platform'],
  ['related Hub communications', 'related platform communications'],
  ['endorsement by the Hub', 'endorsement by The Networker UK'],
  ['The Hub may remove', 'We may remove'],
  ['The Hub does not verify', 'The Networker UK does not verify'],
  ['governed by the Hub Terms', 'governed by the Terms'],
  ['Hub Privacy Policy', 'Privacy Policy'],
  ['Optional note for the Hub team', 'Optional note for our team'],
  ['Get found on the Hub', 'Get found on The Networker UK'],
  ['get found on the Hub', 'get found on The Networker UK'],
  ['Hub partner badge', 'Partner badge'],
  ['Hub partner emails', 'Partner emails'],
  ['Hub LinkedIn shout-outs', 'Networker UK LinkedIn shout-outs'],
  ['Sponsor the hub as a brand', 'Sponsor The Networker UK as a brand'],
  ['Sponsor the Hub as a brand', 'Sponsor The Networker UK as a brand'],
  ['more Hub tools', 'more platform tools'],
  ['month-on-the-Hub stats', 'month-on-platform stats'],
  ['month on the Hub stats', 'month-on-platform stats'],
  ['Everyone who booked via the Hub', 'Everyone who booked via The Networker UK'],
  ['Upcoming Hub events', 'Upcoming events'],
  ['Past Hub bookers', 'Past bookers'],
  ['booked via the Hub', 'booked via The Networker UK'],
  ['Paying through the Hub', 'Paying through The Networker UK'],
  ['Not paying through the Hub', 'Not paying through The Networker UK'],
  ['Signed up to the Hub', 'Signed up to The Networker UK'],
  ['Hub account', 'Account'],
  ['on the hub ·', 'on the platform ·'],
  ['on the hub —', 'on the platform —'],
  ['on the hub.', 'on the platform.'],
  ['on the hub,', 'on the platform,'],
  ['on the hub ', 'on the platform '],
  ['on the Hub', 'on The Networker UK'],
  ['from the Hub', 'from The Networker UK'],
  ['via the Hub', 'via The Networker UK'],
  ['through the Hub', 'through The Networker UK'],
  ['list on the Hub', 'list on The Networker UK'],
  ['List on the Hub', 'List on The Networker UK'],
  ['Listed on the Hub', 'Listed on The Networker UK'],
  ['live on the hub', 'live on The Networker UK'],
  ['Live on the hub', 'Live on The Networker UK'],
  ['page on the hub', 'page on The Networker UK'],
  ['pages on the hub', 'pages on The Networker UK'],
  ['Your public page on the hub', 'Your public page on The Networker UK'],
  ['Your public pages on the hub', 'Your public pages on The Networker UK'],
  ['Create your organiser page on the hub', 'Create your organiser page on The Networker UK'],
  ['Listings you publish on the hub', 'Listings you publish on The Networker UK'],
  ['across the hub', 'across The Networker UK'],
  ['promote a franchise, partnership, or side hustle on the hub', 'promote a franchise, partnership, or side hustle on The Networker UK'],
  ['browse business opportunities on the hub', 'browse business opportunities on The Networker UK'],
  ['browse upcoming events on the hub', 'browse upcoming events on The Networker UK'],
  ['If your group is already on the hub', 'If your group is already on The Networker UK'],
  ['your Founding Organiser · 2026 badge is already on your Hub page', 'your Founding Organiser · 2026 badge is already on your organiser page'],
  ['The Hub maximum', 'The maximum'],
  ['manual Hub payout', 'manual payout'],
  ['Hub-initiated removal', 'Platform-initiated removal'],
  ['Hub-sourced', 'platform-sourced'],
  ['Hub branding', 'platform branding'],
  ['Hub members', 'members'],
  ['Hub member', 'member'],
  ['Breach of Hub rules', 'Breach of platform rules'],
  ['breaching Hub rules', 'breaching platform rules'],
  ['These <strong>Hub rules</strong>', 'These <strong>platform rules</strong>'],
  ['plain-English <a href="#hub-rules" data-policy="hub-rules">Hub rules</a>', 'plain-English <a href="#hub-rules" data-policy="hub-rules">Platform rules</a>'],
  ['<a href="#hub-rules" data-policy="hub-rules">Hub rules</a>', '<a href="#hub-rules" data-policy="hub-rules">Platform rules</a>'],
  ['Hub rules', 'Platform rules'],
  ['Hub-only tools', 'platform-only tools'],
  ['Hub launch notice', 'Launch notice'],
  ['Hub launch emails', 'launch emails'],
  ['Hub upgrade push', 'platform upgrade push'],
  ['Hub logo', 'Networker UK logo'],
  ['Hub booking fees', 'Booking fees'],
  ['Hub booking fee', 'booking fee'],
  ['Hub fees', 'platform fees'],
  ['Hub marketing', 'Marketing emails'],
  ['Hub refunds policy', 'Refunds policy'],
  ['Hub profile', 'profile'],
  ['Hub page', 'organiser page'],
  ['Hub team', 'our team'],
  ['Hub stats', 'platform stats'],
  ['Hub events', 'events'],
  ['Hub event', 'event'],
  ['Hub accounts', 'Member accounts'],
  ['Hub account', 'account'],
  ['Hub terms', 'Terms'],
  ['Top 10 networking group on the Hub', 'Top 10 networking group on The Networker UK'],
  ['Tickets bought on the Hub', 'Tickets bought on The Networker UK'],
  ['People signed up on the Hub', 'People signed up on The Networker UK'],
  ['debug on the Hub', 'debug on the site'],
  ['signed in as the chosen user across the Hub', 'signed in as the chosen user on the site'],
  ['View on Hub', 'View on site'],
  ['Browse Hub events', 'Browse events'],
  ['Unpublish this listing on the Hub?', 'Unpublish this listing on the site?'],
  ['no longer exists on the Hub', 'no longer exists on the site'],
  ['what the hub is', 'what The Networker UK is'],
  ['How the Hub is organised', 'How the platform is organised'],
  ['Three parts of the Hub', 'Three parts of the platform'],
  ["What's on the Hub", "What's on the platform"],
  ['What&rsquo;s on the Hub', 'What&rsquo;s on the platform'],
  ['about the Hub launch', 'about the launch'],
  ['the Hub launch', 'the launch'],
  ['opening the Hub', 'opening the site'],
  ['the Hub grew', 'The Networker UK grew'],
  ['from the same Hub', 'from the same platform'],
  ['Ready to list on the Hub?', 'Ready to list on The Networker UK?'],
  ['Organisers: list on the Hub', 'Organisers: list on The Networker UK'],
  ['How to list on the hub', 'How to list on The Networker UK'],
  ['Sponsor the hub', 'Sponsor The Networker UK'],
  ['Sponsor the Hub', 'Sponsor The Networker UK'],
  ['the hub community', 'The Networker UK community'],
  ['the hub does not', 'The Networker UK does not'],
  ['the hub booking fee', 'the booking fee'],
  ['You need a Hub account', 'You need an account'],
  ['their Hub account', 'their account'],
  ['from their Hub account', 'from their account'],
  ['My Hub', 'My account'],
  ['You are viewing the Hub as', 'You are viewing the site as'],
  ['sent by the Hub', 'sent by the platform'],
  ['what the Hub sends', 'what the platform sends'],
  ['automated — sent by the Hub', 'automated — sent by the platform'],
  ['Using the Hub', 'Using the platform'],
  ['use the Hub', 'use the platform'],
  ['access the Hub', 'use the platform'],
  ['Access the Hub', 'Use the platform'],
  ['provide the Hub', 'provide the platform'],
  ['display it on the Hub', 'display it on the platform'],
  ['listed on the Hub', 'listed on the platform'],
  ['Listing on the Hub', 'Listing on The Networker UK'],
  ['linked from the Hub', 'linked from the platform'],
  ['launch the Hub', 'launch the platform'],
  ['using any part of the Hub', 'using any part of the platform'],
  ['part of the Hub', 'part of the platform'],
  ['communicated via the Hub', 'communicated via email or the platform'],
  ['via the Hub or email', 'via email or the platform'],
  ['via the Hub or by email', 'via email or the platform'],
  ['the Hub or email', 'email or the platform'],
  ['on the Hub and in related', 'on the platform and in related'],
  ['in Hub content', 'in platform content'],
  ['infringement material on the Hub', 'infringing material on the platform'],
  ['content on the Hub', 'content on the platform'],
  ['material on the Hub', 'material on the platform'],
  ['live on the Hub too', 'live on The Networker UK too'],
  ['franchises, partnerships, side hustles and new ventures live on the Hub too', 'franchises, partnerships, side hustles and new ventures live on The Networker UK too'],
  ['Tips, recommendations and Networker news (Hub marketing)', 'Tips, recommendations and Networker news (marketing emails)'],
  ['below the Hub logo hero', 'below the Networker UK logo hero'],
  ['automated — sent by the platform', 'automated — sent by the platform'],
  // Lowercase / missed first pass
  ['sponsor the hub as a brand', 'sponsor The Networker UK as a brand'],
  ['past Hub bookers', 'past bookers'],
  ['New on the hub', 'New on The Networker UK'],
  ['built the hub as', 'built The Networker UK as'],
  ['Many organisers use the hub to', 'Many organisers use The Networker UK to'],
  ['on the hub carousel', 'in the platform carousel'],
  ['in the hub carousel', 'in the platform carousel'],
  ['Hub shout-outs', 'platform shout-outs'],
  ['Hub rating', 'platform rating'],
  ['Hub attendees', 'attendees'],
  ['No Hub attendees', 'No attendees'],
  ['to Hub attendees', 'to attendees'],
  ['Hub billing', 'platform billing'],
  ['Signed up on Hub', 'Signed up on The Networker UK'],
  ['public Hub', 'public site'],
  ['Pay / renew via Hub', 'Pay / renew on the platform'],
  ['Search the hub', 'Search The Networker UK'],
  ['Explore the hub', 'Explore The Networker UK'],
  ['From the hub', 'From The Networker UK'],
  ['Why list on the hub', 'Why list on The Networker UK'],
  ['claim through the hub', 'claim through The Networker UK'],
  ['positions the hub as', 'positions The Networker UK as'],
  ['names the hub ', 'names The Networker UK '],
  ['use the hub.', 'use The Networker UK.'],
  ['use the hub,', 'use The Networker UK,'],
  ['members use the hub', 'members use The Networker UK'],
  ['on the hub?', 'on The Networker UK?'],
  ['on the hub.', 'on The Networker UK.'],
  ['on the hub,', 'on The Networker UK,'],
  ['on the hub ', 'on The Networker UK '],
  ['the hub\'s', 'The Networker UK\'s'],
  ['Hubert is the hub\'s AI concierge', 'Hubert is The Networker UK\'s AI concierge'],
  ['Hub tools', 'Platform tools'],
  ['Hub runs', 'The Networker UK runs'],
  ['Hub handles', 'The Networker UK handles'],
  ['Hub-native', 'platform-native'],
  ['Hub ticketing', 'platform ticketing'],
  ['Hub Stripe', 'platform Stripe'],
  ['Hub ×', 'Networker UK ×'],
  ['Hub UTM', 'platform UTM'],
  ['new Hub', 'The Networker UK'],
  ['vs Hub expected', 'vs platform expected'],
  ['Hub · expected', 'Platform · expected'],
  ['("Hub")', '("Platform")'],
  ['<strong>Hub:</strong>', '<strong>Platform:</strong>'],
  ['<strong>Hub ticketing</strong>', '<strong>Platform ticketing</strong>'],
  ['Option B — Hub ticketing', 'Option B — platform ticketing'],
  ['add Hub ticketing', 'add platform ticketing'],
  ['Ticket buying on Hub', 'Ticket buying on the platform'],
  ['Hub listings', 'platform listings'],
  ['Hub listing', 'platform listing'],
  ['Hub-listed', 'platform-listed'],
  ['Hub booking', 'platform booking'],
  ['Hub bookings', 'platform bookings'],
  ['Hub bookers', 'bookers'],
  ['Hub sign-up', 'sign-up'],
  ['Hub sign-ins', 'sign-ins'],
  ['Hub maximum:', 'Maximum:'],
  ['from the hub checkout', 'from the platform checkout'],
  ['opportunities on the hub', 'opportunities on The Networker UK'],
  ['Hub trust badges', 'Networker UK trust badges'],
  ['Hub credit', 'Networker UK credit'],
  ['Hub fonts', 'Networker UK fonts'],
  ['Hub emails', 'platform emails'],
  ['Hub email', 'platform email'],
  ['Hub pack', 'Networker UK pack'],
  ['Hub view', 'Public view'],
  ['Hub activity', 'platform activity'],
  ['Hub growth', 'platform growth'],
  ['Hub platform activity', 'Platform activity'],
  ['Hub carousel', 'platform carousel'],
  ['Hub inventory', 'platform inventory'],
  ['Hub browsing', 'platform browsing'],
  ['Hub checkout', 'platform checkout'],
  ['Hub promo', 'platform promo'],
  ['Hub promos', 'platform promos'],
  ['Hub support', 'platform support'],
  ['Hub admin', 'platform admin'],
  ['Review these Hub listings', 'Review these listings'],
  ['not a Hub subscription', 'not a platform subscription'],
  ['Hub-billed', 'platform-billed'],
  ['Keep it for renewals; Hub handles', 'Keep it for renewals; The Networker UK handles'],
  ['the hub', 'The Networker UK'],
  ['The Hub', 'The Networker UK'],
];

function shouldProcess(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (!rel || SKIP_FILES.test(rel)) return false;
  if (SKIP_PATH.some((p) => filePath.includes(p))) return false;
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIR.has(p))) return false;
  if (!/\.(html|js|md|txt)$/i.test(rel)) return false;
  if (/admin-app\.js$/.test(rel)) return true;
  if (/hubert-knowledge\.js$/.test(rel)) return true;
  if (rel.includes(`${path.sep}supabase${path.sep}`)) return false;
  return true;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(full, files);
    } else if (shouldProcess(full)) {
      files.push(full);
    }
  }
  return files;
}

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

let changed = 0;
for (const filePath of walk(ROOT)) {
  const before = fs.readFileSync(filePath, 'utf8');
  const after = applyReplacements(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after);
    changed += 1;
    console.log('updated', path.relative(ROOT, filePath));
  }
}

console.log('Done —', changed, 'file(s).');
