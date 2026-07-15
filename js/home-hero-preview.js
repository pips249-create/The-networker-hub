/**
 * Hero copy variants — home2.5 preview page.
 */
(function () {
  var VARIANTS = [
    {
      id: 'current',
      label: 'Current',
      strategy: 'Baseline',
      note: 'Broad outcome-led headline. Works for returning visitors who already know networking; less clear on what The Networker Hub is.',
      kicker: 'UK business networking',
      titleLine: 'Find your next',
      titleAccent: 'event, connection, or opportunity',
      tagline: 'Discover events, connections, and opportunities across the UK\u2019s business network. Browse free; sign up only when you\u2019re ready to book or enquire.',
      searchLabel: 'Find an event',
      searchPlaceholder: 'City, breakfast meeting, industry, organiser\u2026',
      searchBtn: 'Search events',
      proof: '',
      stats: null,
      pillars: null,
      footerLinks: true,
    },
    {
      id: 'hub',
      label: 'A · Hub-led',
      strategy: 'Explain what you are',
      note: 'Names the brand and positions the hub as the UK\u2019s single place for events, groups, and opportunities. Best for cold traffic and word-of-mouth referrals.',
      kicker: 'The Networker Hub',
      titleLine: 'The UK\u2019s home for',
      titleAccent: 'business connection',
      tagline: 'Event listings, organiser profiles, and business opportunities in one place \u2014 find the right room, community, or next move without hunting across dozens of sites.',
      searchLabel: 'Find an event',
      searchPlaceholder: 'City, breakfast meeting, industry, organiser\u2026',
      searchBtn: 'Search events',
      proof: 'Browse free \u00b7 Sign up only when you book or enquire',
      stats: [
        { label: 'Events & exhibitions', detail: 'Meetings to conferences' },
        { label: 'Networking groups', detail: 'Organiser pages & reviews' },
        { label: 'Opportunities', detail: 'Roles, partnerships & more' },
      ],
      pillars: [
        { href: '/events/', label: 'Events', primary: true },
        { href: '/events/?mode=organisers', label: 'Organisers' },
        { href: '/opportunities/', label: 'Opportunities' },
      ],
      footerLinks: false,
    },
    {
      id: 'events',
      label: 'B · Events-first',
      strategy: 'Lead with the main use case',
      note: 'Sharper for SEO and paid traffic looking for networking events. Organisers and opportunities stay visible but secondary.',
      kicker: 'UK business networking',
      titleLine: 'Find your next',
      titleAccent: 'UK networking event',
      tagline: 'Breakfast meetings, conferences, training, and exhibitions near you. Browse free, compare organisers, and book when you\u2019re ready.',
      searchLabel: 'Search networking events',
      searchPlaceholder: 'Leeds breakfast, women in business, tech networking\u2026',
      searchBtn: 'Search events',
      proof: 'Also browse networking groups and business opportunities',
      stats: null,
      pillars: [
        { href: '/events/', label: 'Events', primary: true },
        { href: '/events/?mode=organisers', label: 'Organisers' },
        { href: '/opportunities/', label: 'Opportunities' },
      ],
      footerLinks: false,
    },
    {
      id: 'differentiator',
      label: 'C · Differentiator',
      strategy: 'Lead with why you\u2019re different',
      note: 'Surfaces guest visits, reviews, and comparison \u2014 your strongest moat vs generic event listings. More distinctive, slightly less SEO-generic.',
      kicker: 'Try before you join',
      titleLine: 'Stop hunting.',
      titleAccent: 'Start connecting.',
      tagline: 'Compare UK networking groups, read reviews, and claim complimentary guest visits \u2014 events, organisers, and opportunities on one hub.',
      searchLabel: 'Find an event or group',
      searchPlaceholder: 'City, networking group, industry\u2026',
      searchBtn: 'Search the hub',
      proof: 'Free to browse \u00b7 No account needed until you book',
      stats: [
        { label: 'Guest visits', detail: 'Try a meeting before you join' },
        { label: 'Organiser reviews', detail: 'See what members say' },
        { label: 'One search', detail: 'Events, groups & opportunities' },
      ],
      pillars: [
        { href: '/events/', label: 'Events', primary: true },
        { href: '/events/?mode=organisers', label: 'Organisers' },
        { href: '/opportunities/', label: 'Opportunities' },
      ],
      footerLinks: false,
    },
    {
      id: 'd',
      label: 'D · Dual CTA',
      layout: 'dual-cta',
      strategy: 'Split the journey in the headline',
      note: '"Find your next\u2026" with a short hub explainer, then two coloured CTA pills for events vs opportunities.',
      lede: 'This hub lets you find networking meetings, conferences, business opportunities, side hustles, training and so much more.',
      titleLine: 'Find your next\u2026',
      tagline: '',
      ctaPills: [
        {
          href: '/events/',
          label: 'UK networking event',
          detail: 'Breakfast meetings, conferences, training, and exhibitions near you.',
          tone: 'gold',
        },
        {
          href: '/opportunities/',
          label: 'UK business opportunity',
          detail: 'Franchises, partnerships, side hustles, and deals to explore.',
          tone: 'purple',
        },
      ],
    },
    {
      id: 'e',
      label: 'E · Mix',
      layout: 'dual-cta',
      strategy: 'Best of all variants',
      note: 'Keeps "Find your next\u2026" centre stage (B/D), names the hub (A), explains breadth + guest visits (C/D), and uses the dual coloured CTAs without UK framing.',
      kicker: 'The Networker Hub',
      titleLine: 'Find your next\u2026',
      lede: 'Networking meetings, conferences, business opportunities, side hustles, training and so much more \u2014 all in one place. Compare groups, claim guest visits, and browse free.',
      proof: 'Try before you join \u00b7 Sign up only when you book or enquire',
      tagline: '',
      ctaPills: [
        {
          href: '/events/',
          label: 'Networking event',
          detail: 'Breakfast meetings, conferences, training, and exhibitions near you.',
          tone: 'gold',
        },
        {
          href: '/opportunities/',
          label: 'Business opportunity',
          detail: 'Franchises, partnerships, side hustles, and deals to explore.',
          tone: 'purple',
        },
      ],
    },
  ];

  var STAT_ICONS = {
    events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 3.1-6 7-6"/><path d="M14 20c0-2.2 2.7-4.5 6-4.5"/></svg>',
    opportunities: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.5 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3z"/></svg>',
  };

  var statIconKeys = ['events', 'groups', 'opportunities'];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderStats(stats) {
    if (!stats || !stats.length) return '';
    var icons = statIconKeys;
    return (
      '<ul class="home-hero-stats home-hero-stats--hero" aria-label="What you can find">' +
      stats
        .map(function (stat, i) {
          return (
            '<li class="home-hero-stat">' +
            '<span class="home-hero-stat-icon">' +
            (STAT_ICONS[icons[i]] || STAT_ICONS.events) +
            '</span>' +
            '<span class="home-hero-stat-text">' +
            '<strong>' +
            esc(stat.label) +
            '</strong>' +
            '<span>' +
            esc(stat.detail) +
            '</span>' +
            '</span>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderPillars(pillars) {
    if (!pillars || !pillars.length) return '';
    return (
      '<ul class="home-hero-pillars" aria-label="Explore the hub">' +
      pillars
        .map(function (pillar) {
          return (
            '<li><a class="home-hero-pillar-chip' +
            (pillar.primary ? ' is-primary' : '') +
            '" href="' +
            esc(pillar.href) +
            '">' +
            esc(pillar.label) +
            '</a></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderDualCtaPills(pills) {
    if (!pills || !pills.length) return '';
    return (
      '<div class="home-hero-cta-pills" role="group" aria-label="Choose where to start">' +
      pills
        .map(function (pill) {
          var toneClass = pill.tone ? ' home-hero-cta-pill--' + pill.tone : '';
          return (
            '<a class="home-hero-cta-pill' +
            toneClass +
            '" href="' +
            esc(pill.href) +
            '">' +
            '<span class="home-hero-cta-pill-label">' +
            esc(pill.label) +
            '</span>' +
            '<span class="home-hero-cta-pill-detail">' +
            esc(pill.detail) +
            '</span>' +
            '</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderDualCtaHero(variant) {
    return (
      '<header class="home-hero-copy home-hero-copy--dual-cta">' +
      (variant.kicker
        ? '<p class="home-hero-kicker">' + esc(variant.kicker) + '</p>'
        : '') +
      '<h1 class="hero-title hero-title--dual-cta">' +
      '<span class="hero-title-line">' +
      esc(variant.titleLine) +
      '</span>' +
      '</h1>' +
      (variant.lede
        ? '<p class="home-hero-lede">' + esc(variant.lede) + '</p>'
        : '') +
      renderDualCtaPills(variant.ctaPills) +
      (variant.proof
        ? '<p class="home-hero-proof home-hero-proof--dual-cta">' + esc(variant.proof) + '</p>'
        : '') +
      (variant.tagline
        ? '<p class="hero-tagline hero-tagline--dual-cta">' + esc(variant.tagline) + '</p>'
        : '') +
      '</header>' +
      '<p class="home-hero-search-note home-hero-search-note--dual-cta">' +
      '<a href="/events/?mode=organisers">Find organisers</a>' +
      '<span aria-hidden="true">\u00b7</span>' +
      '<a href="/events/">Browse all events</a>' +
      '</p>'
    );
  }

  function renderHero(variant) {
    if (variant.layout === 'dual-cta') {
      return renderDualCtaHero(variant);
    }

    var footerLinks = variant.footerLinks
      ? '<p class="home-hero-search-note">' +
        '<a href="/events/?mode=organisers">Find organisers</a>' +
        '<span aria-hidden="true">\u00b7</span>' +
        '<a href="/opportunities/">Browse opportunities</a>' +
        '</p>'
      : renderPillars(variant.pillars);

    return (
      '<header class="home-hero-copy">' +
      '<p class="home-hero-kicker">' +
      esc(variant.kicker) +
      '</p>' +
      '<h1 class="hero-title">' +
      '<span class="hero-title-line">' +
      esc(variant.titleLine) +
      '</span>' +
      '<span class="hero-title-accent">' +
      esc(variant.titleAccent) +
      '</span>' +
      '</h1>' +
      '<p class="hero-tagline">' +
      esc(variant.tagline) +
      '</p>' +
      (variant.proof ? '<p class="home-hero-proof">' + esc(variant.proof) + '</p>' : '') +
      '</header>' +
      '<div class="home-hero-search-block">' +
      '<form class="home-hero-search" action="/events/" method="get" role="search" aria-label="Search events">' +
      '<div class="home-hero-search-field">' +
      '<label class="home-hero-search-label" for="home-hero-search-input">' +
      esc(variant.searchLabel) +
      '</label>' +
      '<input type="search" id="home-hero-search-input" name="q" placeholder="' +
      esc(variant.searchPlaceholder) +
      '" autocomplete="off" enterkeyhint="search">' +
      '</div>' +
      '<button type="submit" class="home-hero-search-btn btn btn-primary">' +
      esc(variant.searchBtn) +
      '</button>' +
      '</form>' +
      footerLinks +
      renderStats(variant.stats) +
      '</div>'
    );
  }

  function renderNote(variant) {
    return (
      '<strong>' +
      esc(variant.strategy) +
      '</strong> ' +
      esc(variant.note)
    );
  }

  function initSearchForm() {
    var form = document.querySelector('.home-hero-preview-stage .home-hero-search');
    var input = document.getElementById('home-hero-search-input');
    if (!form || !input) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = String(input.value || '').trim();
      window.location.href = q
        ? '/events/?q=' + encodeURIComponent(q) + '#results'
        : '/events/#results';
    });
  }

  function setVariant(id) {
    var variant = VARIANTS.find(function (v) {
      return v.id === id;
    }) || VARIANTS[0];

    var heroInner = document.querySelector('.home-hero-preview-stage .home-hero-inner');
    var note = document.getElementById('home-hero-preview-note');
    if (!heroInner) return;

    heroInner.innerHTML = renderHero(variant);
    if (note) note.innerHTML = renderNote(variant);

    document.querySelectorAll('.home-hero-preview-tab').forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-variant') === variant.id);
      tab.setAttribute('aria-selected', tab.getAttribute('data-variant') === variant.id ? 'true' : 'false');
    });

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '?variant=' + variant.id);
    }

    initSearchForm();
  }

  function init() {
    var tabs = document.getElementById('home-hero-preview-tabs');
    if (!tabs) return;

    VARIANTS.forEach(function (variant) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'home-hero-preview-tab';
      tab.setAttribute('data-variant', variant.id);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.textContent = variant.label;
      tab.addEventListener('click', function () {
        setVariant(variant.id);
      });
      tabs.appendChild(tab);
    });

    var params = new URLSearchParams(window.location.search);
    var initial = params.get('variant') || 'current';
    if (!VARIANTS.some(function (v) { return v.id === initial; })) initial = 'current';

    var hero = document.querySelector('.home-hero-preview-stage .home-hero');
    if (hero) {
      hero.classList.add('is-visible', 'is-entered');
    }

    setVariant(initial);
  }

  init();
})();
