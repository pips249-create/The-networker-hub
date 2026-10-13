/**
 * Member zone playbooks — click-through decks (standalone page + dashboard modal).
 */
(function () {
  var KNOWN = ['marketing', 'numbers', 'funding', 'follow-up', 'events'];

  var CATALOG = [
    {
      id: 'marketing',
      title: 'Marketing that fits a networking diary',
      summary: 'Get visible without burning every evening — click through the short guide.',
      tone: 0,
      imageUrl: '/assets/playbooks/marketing.jpg',
    },
    {
      id: 'follow-up',
      title: 'Follow-up after the room',
      summary: 'What to do in the 24–72 hours after an event while names are still warm.',
      tone: 1,
      imageUrl: '/assets/playbooks/follow-up.jpg',
    },
    {
      id: 'events',
      title: 'Choosing your next event',
      summary: 'Breakfast vs lunch vs expo — when to go wide, when to go deep.',
      tone: 2,
      imageUrl: '/assets/playbooks/events.jpg',
    },
    {
      id: 'numbers',
      title: 'What your numbers are really telling you',
      summary: 'Read cash, pipeline, and time like a simple dashboard.',
      tone: 3,
      imageUrl: '/assets/playbooks/numbers.jpg',
    },
    {
      id: 'funding',
      title: 'Funding your business',
      summary: 'Choose the right investment path before you pitch anyone.',
      tone: 0,
      imageUrl: '/assets/playbooks/funding.jpg',
    },
  ];

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function coverSlide(kicker, pill, panelTitle, panelBody) {
    return (
      '<article class="mp-slide mp-slide--cover is-active">' +
      '<div class="mp-brand"><span class="mp-brand-mark" aria-hidden="true">✦</span> Member zone</div>' +
      '<div class="mp-cover-copy">' +
      '<p class="mp-cover-kicker">' +
      esc(kicker) +
      '</p>' +
      '<span class="mp-pill">' +
      esc(pill) +
      '</span></div>' +
      '<div class="mp-cover-art" aria-hidden="true">' +
      '<span class="mp-shape mp-shape--a"></span>' +
      '<span class="mp-shape mp-shape--b"></span>' +
      '<span class="mp-shape mp-shape--c"></span></div>' +
      '<div class="mp-cover-panel"><h3>' +
      esc(panelTitle) +
      '</h3><p>' +
      esc(panelBody) +
      '</p></div></article>'
    );
  }

  function darkSlide(page, title, body, listHtml) {
    return (
      '<article class="mp-slide mp-slide--dark" aria-hidden="true">' +
      '<span class="mp-step-badge">Page ' +
      page +
      '</span><h2>' +
      esc(title) +
      '</h2><p>' +
      esc(body) +
      '</p>' +
      (listHtml || '') +
      '</article>'
    );
  }

  function accentSlide(page, title, body, extraHtml) {
    return (
      '<article class="mp-slide mp-slide--accent" aria-hidden="true">' +
      '<span class="mp-step-badge">Page ' +
      page +
      '</span><h2>' +
      esc(title) +
      '</h2><p>' +
      esc(body) +
      '</p>' +
      (extraHtml || '') +
      '</article>'
    );
  }

  function lightSlide(page, title, body, extraHtml) {
    return (
      '<article class="mp-slide mp-slide--light" aria-hidden="true">' +
      '<span class="mp-step-badge">Page ' +
      page +
      '</span><h2>' +
      esc(title) +
      '</h2><p>' +
      esc(body) +
      '</p>' +
      (extraHtml || '') +
      '</article>'
    );
  }

  function list(items) {
    return (
      '<ul class="mp-list">' +
      items.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('') +
      '</ul>'
    );
  }

  function cards(items) {
    return (
      '<div class="mp-cards">' +
      items
        .map(function (item) {
          return (
            '<div class="mp-card"><strong>' +
            esc(item[0]) +
            '</strong><span>' +
            esc(item[1]) +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function split(leftTitle, leftItems, rightTitle, rightItems, softDark) {
    var rightStyle = softDark
      ? ' style="background:#3d3438;border-color:transparent;color:#fff"'
      : '';
    return (
      '<div class="mp-split">' +
      '<div class="mp-panel mp-panel--white"><h3>' +
      esc(leftTitle) +
      '</h3><ul>' +
      leftItems.map(function (i) {
        return '<li>' + esc(i) + '</li>';
      }).join('') +
      '</ul></div>' +
      '<div class="mp-panel mp-panel--soft"' +
      rightStyle +
      '><h3>' +
      esc(rightTitle) +
      '</h3><ul>' +
      rightItems.map(function (i) {
        return '<li>' + esc(i) + '</li>';
      }).join('') +
      '</ul></div></div>'
    );
  }

  function closeSlide(page, title, body, nextId, nextLabel, footnote) {
    var nextBtn = nextId
      ? '<button type="button" class="mp-btn mp-btn-ghost" data-mp-deck-switch="' +
        esc(nextId) +
        '">' +
        esc(nextLabel || 'Next playbook →') +
        '</button>'
      : '<a class="mp-btn mp-btn-ghost" href="/account/#services">Back to Member offers</a>';
    return (
      lightSlide(
        page,
        title,
        body,
        '<div class="mp-cta-row">' +
          '<a class="mp-btn mp-btn-primary" href="/account/#services">See Member offers</a>' +
          nextBtn +
          '</div>' +
          (footnote ? '<p class="mp-footnote">' + esc(footnote) + '</p>' : '')
      )
    );
  }

  var DECKS = {
    marketing: function () {
      return [
        coverSlide(
          'Marketing that fits:',
          'A five-page networking playbook',
          'Get visible without burning every evening',
          'Built for people who already show up at breakfasts, lunches, and expos — not for full-time content creators.'
        ),
        darkSlide(
          2,
          'Why most “marketing plans” fail networkers',
          'You already spend hours in rooms. Generic advice assumes spare evenings and a content team.',
          list([
            'Posting randomly after every meeting burns energy',
            'Cold outreach ignores the warm room you just left',
            'One clear follow-up beats five half-finished channels',
          ])
        ),
        accentSlide(
          3,
          'The after-event window',
          'The highest-leverage hour is the 24 hours after you leave the room — while names are still warm.',
          cards([
            ['Same day', 'Send 3 short notes while the chat is fresh.'],
            ['Next morning', 'One useful post or photo — not a thread.'],
            ['Within a week', 'Book the coffee or share what you promised.'],
          ])
        ),
        lightSlide(
          4,
          'A weekly cadence that fits meetings',
          'Keep it light enough that a busy breakfast week still works.',
          split(
            'Minimum viable week',
            ['1 event follow-up block (30 mins)', '1 public proof point', '1 ask or offer in your network'],
            'Skip list',
            ['Daily posting streaks', 'New platforms “just in case”', 'Long newsletters nobody asked for'],
            true
          )
        ),
        closeSlide(5, 'Take one step this week', 'Pick the next event on your diary. Block 30 minutes after it for follow-ups.', 'follow-up', 'Next: follow-up →'),
      ];
    },
    numbers: function () {
      return [
        coverSlide(
          'What your numbers say:',
          'A five-page clarity playbook',
          'Read cash, pipeline, and time like a dashboard',
          'Know whether to push marketing, cut a cost, or protect capacity — before the next event cycle.'
        ),
        darkSlide(
          2,
          'Three numbers every Monday',
          'Ignore vanity metrics. These three tell you if the business is breathing.',
          cards([
            ['Cash runway', 'How many months if nothing new came in?'],
            ['Warm pipeline', 'Conversations that could become work in 30 days.'],
            ['Time load', 'Hours already promised vs hours you actually have.'],
          ])
        ),
        accentSlide(
          3,
          'What the signals mean',
          'Use the numbers to choose the next move — not to feel busy.',
          split(
            'Book more rooms when…',
            ['Pipeline is thin but cash is stable', 'You have capacity next month', 'Follow-ups from last month dried up'],
            'Follow up harder when…',
            ['Pipeline is full of “maybes”', 'You are over-booked already', 'Cash is tight and new spend won’t help']
          )
        ),
        lightSlide(
          4,
          'When an offer helps — or distracts',
          'Member offers help when they shorten a job you already planned. They distract when they create a new unfinished project.',
          list([
            'Claim a trial if it replaces a tool you already pay for',
            'Skip discounts for “nice to have” software this quarter',
            'Book a clinic only if you have one clear question ready',
          ])
        ),
        closeSlide(
          5,
          'Write your three numbers now',
          'Open a note. Cash runway · warm pipeline · time load. That is your Monday dashboard.',
          'funding',
          'Next: funding →',
          'Educational only — not accounting or tax advice.'
        ),
      ];
    },
    funding: function () {
      return [
        coverSlide(
          'Funding your business:',
          'Choosing the right path',
          'Decide the path before you pitch anyone',
          'Revenue, a loan, a partner, or a cleaner offer — pick what matches the stage you are actually in.'
        ),
        darkSlide(
          2,
          'Four paths (not one ladder)',
          'Sometimes the real answer is: fix the offer before you raise anything.',
          cards([
            ['Bootstrap', 'Grow from sales. Slowest cash, fullest control.'],
            ['Borrow', 'Debt for a clear return — not for hope.'],
            ['Bring partners', 'Equity or revenue share when skill/capital is missing.'],
          ])
        ),
        accentSlide(
          3,
          'Questions to answer first',
          'If you cannot answer these, you are not ready to pitch.',
          list([
            'What will the money buy in the next 90 days?',
            'How does it come back — sales, margin, or asset?',
            'What happens if the plan is six months late?',
            'Who else has to say yes?',
          ])
        ),
        lightSlide(
          4,
          'Where Business Opportunities fit',
          'The Hub’s opportunities directory is for franchises, side hustles, and partnerships — not every funding need.',
          split(
            'Browse when…',
            ['You want a proven model to join', 'You are exploring a side path', 'You need a partner, not a loan'],
            'Look elsewhere when…',
            ['You need working capital for payroll', 'You want pure debt advice', 'You are not ready to operate a model'],
            true
          )
        ),
        closeSlide(
          5,
          'Choose a path, then one next conversation',
          'Write the path on a card. Then book one conversation this week.',
          'events',
          'Next: choosing events →',
          'Educational only — not financial advice.'
        ),
      ];
    },
    'follow-up': function () {
      return [
        coverSlide(
          'Follow-up after the room:',
          'A five-page connection playbook',
          'Warm names beat cold lists',
          'The meeting was the start. The next 72 hours decide whether anything actually happens.'
        ),
        darkSlide(
          2,
          'Capture before you forget',
          'Do this before you drive home or open email.',
          list([
            'Who you met + one specific detail',
            'What you offered or promised',
            'What you want from them (if anything)',
            'When you will follow up',
          ])
        ),
        accentSlide(
          3,
          'The 24-hour message',
          'Short, specific, human — not a pitch deck in a DM.',
          cards([
            ['Line 1', 'Remind them where you met.'],
            ['Line 2', 'Reference the one thing you discussed.'],
            ['Line 3', 'One clear next step (coffee, intro, resource).'],
          ])
        ),
        lightSlide(
          4,
          'Who gets what',
          'Not everyone needs the same follow-up.',
          split(
            'High priority',
            ['Clear mutual fit', 'They asked for something', 'You promised a resource'],
            'Light touch',
            ['Nice chat, no clear next step', 'Connect on LinkedIn only', 'Revisit after the next event'],
            true
          )
        ),
        closeSlide(5, 'Block 30 minutes after your next event', 'Put it in the diary before you book the ticket. That is the whole system.', 'marketing', 'Related: marketing →'),
      ];
    },
    events: function () {
      return [
        coverSlide(
          'Choosing your next event:',
          'A five-page diary playbook',
          'Wide vs deep — on purpose',
          'Not every breakfast deserves a seat. Pick rooms that match the stage you are in.'
        ),
        darkSlide(
          2,
          'What are you actually there for?',
          'Be honest before you filter the calendar.',
          list([
            'New introductions in your sector',
            'Warmth with people you already know',
            'Learning / inspiration',
            'Finding a partner, hire, or opportunity',
          ])
        ),
        accentSlide(
          3,
          'Format cheat sheet',
          'Match the format to the job.',
          cards([
            ['Breakfast / lunch', 'Best for repeat relationships and local groups.'],
            ['Expo / showcase', 'Best for scanning many options quickly.'],
            ['Workshop / clinic', 'Best when you have one skill gap to close.'],
          ])
        ),
        lightSlide(
          4,
          'Guest visit vs paid seat',
          'Try before you commit — then decide like an adult.',
          split(
            'Use a guest visit when…',
            ['You have never been to the group', 'The format is unclear', 'You want to test fit'],
            'Pay / join when…',
            ['You have been twice and still want more', 'The room matches your ICP', 'You will actually show up monthly'],
            true
          )
        ),
        closeSlide(5, 'Pick one event this month on purpose', 'Open Browse events. Filter by city and type. Book one that matches your goal — not three random ones.', 'follow-up', 'Related: follow-up →'),
      ];
    },
  };

  function controlsHtml(count) {
    var dots = '';
    for (var i = 0; i < count; i += 1) {
      dots +=
        '<button type="button" class="mp-dot' +
        (i === 0 ? ' is-active' : '') +
        '" data-mp-dot="' +
        i +
        '" aria-label="Page ' +
        (i + 1) +
        '"></button>';
    }
    return (
      '<div class="mp-controls">' +
      '<div class="mp-pager" aria-live="polite">' +
      '<span class="mp-pager-label">1 / ' +
      count +
      '</span>' +
      '<div class="mp-dots">' +
      dots +
      '</div></div>' +
      '<div class="mp-nav">' +
      '<button type="button" class="mp-nav-btn mp-nav-prev" aria-label="Previous page" disabled>‹</button>' +
      '<button type="button" class="mp-nav-btn mp-nav-next" aria-label="Next page">›</button>' +
      '</div></div>'
    );
  }

  function deckHtml(id) {
    var builder = DECKS[id];
    if (!builder) return '';
    var slides = builder();
    return (
      '<section class="mp-deck" data-mp-deck="' +
      esc(id) +
      '" aria-label="Playbook" tabindex="0">' +
      '<div class="mp-viewport">' +
      slides.join('') +
      '</div>' +
      controlsHtml(slides.length) +
      '</section>'
    );
  }

  function bindDeck(deckEl, state) {
    var slides = Array.prototype.slice.call(deckEl.querySelectorAll('.mp-slide'));
    state.slides = slides;
    state.index = 0;

    function paint() {
      var label = deckEl.querySelector('.mp-pager-label');
      var dots = deckEl.querySelectorAll('.mp-dot');
      var prev = deckEl.querySelector('.mp-nav-prev');
      var next = deckEl.querySelector('.mp-nav-next');
      if (label) label.textContent = state.index + 1 + ' / ' + slides.length;
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === state.index);
      });
      if (prev) prev.disabled = state.index <= 0;
      if (next) next.disabled = state.index >= slides.length - 1;
      slides.forEach(function (slide, i) {
        var on = i === state.index;
        slide.classList.toggle('is-active', on);
        slide.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
    }

    function go(i) {
      state.index = Math.max(0, Math.min(slides.length - 1, i));
      paint();
    }

    var prev = deckEl.querySelector('.mp-nav-prev');
    var next = deckEl.querySelector('.mp-nav-next');
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); go(state.index - 1); });
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); go(state.index + 1); });
    deckEl.querySelectorAll('.mp-dot').forEach(function (dot) {
      dot.addEventListener('click', function (e) {
        e.preventDefault();
        go(Number(dot.getAttribute('data-mp-dot')) || 0);
      });
    });
    deckEl.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(state.index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(state.index - 1);
      }
    });
    paint();
    state.go = go;
  }

  function mount(container, options) {
    if (!container) return null;
    var opts = options || {};
    var id = opts.deckId && DECKS[opts.deckId] ? opts.deckId : 'marketing';
    container.innerHTML = deckHtml(id);
    var deckEl = container.querySelector('.mp-deck');
    var state = { id: id };
    if (deckEl) {
      bindDeck(deckEl, state);
      try {
        deckEl.focus({ preventScroll: true });
      } catch (e) {}
    }
    container.onclick = function (event) {
      var sw = event.target.closest('[data-mp-deck-switch]');
      if (!sw) return;
      event.preventDefault();
      mount(container, { deckId: sw.getAttribute('data-mp-deck-switch') });
      if (typeof opts.onSwitch === 'function') opts.onSwitch(sw.getAttribute('data-mp-deck-switch'));
    };
    return state;
  }

  function initPage() {
    var root = document.getElementById('mp-root');
    if (!root) return;
    var embed = document.body.classList.contains('mp-embed');
    var hash = String(location.hash || '').replace(/^#/, '').toLowerCase();
    if (KNOWN.indexOf(hash) === -1) hash = 'marketing';

    if (embed) {
      var mountEl = document.getElementById('mp-embed-mount') || root;
      if (mountEl.hidden) mountEl.hidden = false;
      var stageHidden = document.getElementById('mp-stage');
      if (stageHidden) stageHidden.hidden = true;
      mount(mountEl, { deckId: hash });
      return;
    }

    var stage = document.getElementById('mp-stage');
    if (!stage) return;

    function show(id) {
      if (!DECKS[id]) id = 'marketing';
      mount(stage, {
        deckId: id,
        onSwitch: function (nextId) {
          show(nextId);
        },
      });
      root.querySelectorAll('.mp-tab').forEach(function (tab) {
        var on = tab.getAttribute('data-mp-deck') === id;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (location.hash.replace(/^#/, '') !== id) {
        history.replaceState(null, '', '#' + id);
      }
    }

    root.querySelectorAll('.mp-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        show(tab.getAttribute('data-mp-deck'));
      });
    });
    window.addEventListener('hashchange', function () {
      var h = String(location.hash || '').replace(/^#/, '').toLowerCase();
      if (KNOWN.indexOf(h) !== -1) show(h);
    });
    show(hash);
  }

  window.HubMemberPlaybooks = {
    catalog: CATALOG,
    knownIds: KNOWN.slice(),
    mount: mount,
    initPage: initPage,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
})();
