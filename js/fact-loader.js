/**
 * FactLoader — lazy loading overlay with hub facts (shows only after 800ms).
 *
 * Usage:
 *   await FactLoader.run(() => fetch('/api/events').then(r => r.json()));
 *
 * Manual session:
 *   const session = FactLoader.begin();
 *   try { await doWork(); } finally { await session.end(); }
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.FactLoader = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function FactLoaderFactory() {
  const LAZY_DELAY_MS = 800;
  const MIN_VISIBLE_MS = 1200;
  const FADE_MS = 350;

  const LABELS = {
    hub: 'From the hub',
    research: 'Did you know?',
    insight: 'Networking insight',
  };

  const networkingFacts = [
    {
      text: 'The Networker Hub is a UK directory for networking meetings, exhibitions, conferences, and business opportunities.',
      label: 'hub',
    },
    {
      text: '85% of jobs are filled through personal and professional networks, not online applications alone.',
      label: 'research',
      source: 'HubSpot',
      sourceUrl: 'https://blog.hubspot.com/marketing/marketing-statistics',
    },
    {
      text: 'Every business host on the hub is reviewed before they can list, to keep events focused on genuine networking.',
      label: 'hub',
    },
    {
      text: 'You can browse live listings and filter by format, industry, date, and location. No account required.',
      label: 'hub',
    },
    {
      text: 'Organiser reviews on the hub reflect real attendee feedback, so you can compare hosts before you book.',
      label: 'hub',
    },
    {
      text: 'Save events to your favourites and return when you are ready to register.',
      label: 'hub',
    },
    {
      text: 'Many UK networking groups are actively looking for people to open new chapters and groups across the country. Browse current openings on the hub\u2019s business opportunities page.',
      label: 'hub',
    },
    {
      text: 'Do you know all organisers get a profile page with logo, reviews, social links, and all their events? Find them under the Organisers tab on the events page.',
      label: 'hub',
    },
    {
      text: 'UK business networking spans breakfast clubs, chamber events, sector meetups, and exhibitions.',
      label: 'insight',
    },
    {
      text: 'In the UK, networking is more about collaboration than competition. Business owners often refer clients to one another and share practical operational advice.',
      label: 'research',
      source: 'Mosaic Digital Media',
      sourceUrl: 'https://mosaicdigitalmedia.co.uk/benefits-of-networking-for-uk-businesses/',
    },
    {
      text: '95% of professionals consider face-to-face meetings essential for building long-term business relationships.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: 'Trust usually needs 10 or more interactions over several months to form. A single meeting or business card exchange rarely builds a real connection.',
      label: 'research',
      source: 'BNI Breaking Boundaries',
      sourceUrl: 'https://bnibreakingboundaries.com/business-networking-roi/',
    },
    {
      text: '77% of people prefer face-to-face networking events because they can read body language and facial expressions.',
      label: 'research',
      source: 'Forbes (via Freshminds)',
      sourceUrl: 'https://www.freshminds.co.uk/blog/2023/09/online-networking-vs-in-person-which-is-most-effective-for-growing-your-career',
    },
    {
      text: 'The average UK professional attends around seven formal networking events each year.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: '47% of networkers attend events mainly to learn and share industry knowledge, while only 23% go exclusively to seek new job opportunities.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: 'Corporate executives and small business owners estimate they would lose around 28% of their business if they stopped networking actively.',
      label: 'research',
      source: 'Novor\u00e9sum\u00e9',
      sourceUrl: 'https://novoresume.com/career-blog/networking-statistics',
    },
    {
      text: 'Between 5% and 20% of new small business clients come directly from trade shows and exhibitions.',
      label: 'research',
      source: 'Novor\u00e9sum\u00e9',
      sourceUrl: 'https://novoresume.com/career-blog/networking-statistics',
    },
    {
      text: 'Listings are managed by verified organisers. Dates, venues, and prices on each event page are kept up to date.',
      label: 'hub',
    },
    {
      text: 'Most hiring still starts with referrals and warm introductions.',
      label: 'research',
      source: 'LinkedIn Talent Research',
      sourceUrl: 'https://www.linkedin.com/business/talent/blog',
    },
    {
      text: 'The UK\u2019s best cities for networking can help you build long-lasting business partnerships and take your career to the next level.',
      label: 'insight',
    },
    {
      text: 'London ranks as the UK\u2019s top city for networkers, with an index score of 7.35 out of 10 and over \u00a378 million passed through networking groups in the past year.',
      label: 'insight',
    },
    {
      text: 'Glasgow is the UK\u2019s second-best city for networking, with over \u00a3205 million passed through local groups last year.',
      label: 'insight',
    },
    {
      text: 'Birmingham ranks third for UK networking, with 16+ groups and members passing over \u00a319 million in business last year.',
      label: 'insight',
    },
    {
      text: 'Chester ranks fourth among UK networking cities, with around 285 active networking members.',
      label: 'insight',
    },
    {
      text: 'Manchester rounds out the UK\u2019s top five networking cities, with over \u00a331 million passed through local groups in the past year.',
      label: 'insight',
    },
    {
      text: 'The South East is the UK\u2019s top region for networking, with an index score of 6.20 out of 10.',
      label: 'insight',
    },
    {
      text: 'The North West ranks second among UK networking regions, scoring 5.43 out of 10.',
      label: 'insight',
    },
    {
      text: 'London ranks third among UK networking regions, with an index score of 5.25 out of 10.',
      label: 'insight',
    },
    {
      text: 'The West Midlands is the UK\u2019s fourth-best region for networking, with an index score of 4.95 out of 10.',
      label: 'insight',
    },
    {
      text: 'Scotland rounds out the UK\u2019s top five networking regions, scoring 3.67 out of 10.',
      label: 'insight',
    },
  ];

  let overlayEl = null;
  let activeSessions = 0;

  function pickRandomFact() {
    return networkingFacts[Math.floor(Math.random() * networkingFacts.length)];
  }

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'fact-loader';
    overlayEl.hidden = true;
    overlayEl.setAttribute('role', 'status');
    overlayEl.setAttribute('aria-live', 'polite');
    overlayEl.setAttribute('aria-busy', 'true');
    overlayEl.innerHTML =
      '<div class="fact-loader__pulse" aria-hidden="true">' +
      '<span class="fact-loader__pulse-bar"></span>' +
      '</div>' +
      '<div class="fact-loader__content">' +
      '<img class="fact-loader__logo" src="/assets/logo-nav.png" alt="The Networker Hub" width="200" height="80" decoding="async">' +
      '<div class="fact-loader__card">' +
      '<span class="fact-loader__label"></span>' +
      '<p class="fact-loader__fact"></p>' +
      '<p class="fact-loader__source" hidden></p>' +
      '</div>' +
      '</div>';

    var mount = document.body || document.documentElement;
    mount.appendChild(overlayEl);
    return overlayEl;
  }

  function renderFact(fact) {
    const card = ensureOverlay().querySelector('.fact-loader__card');
    if (!card) return;

    const labelEl = card.querySelector('.fact-loader__label');
    const factEl = card.querySelector('.fact-loader__fact');
    const sourceEl = card.querySelector('.fact-loader__source');
    const labelKey = fact.label && LABELS[fact.label] ? fact.label : 'hub';

    if (labelEl) labelEl.textContent = LABELS[labelKey];
    if (factEl) factEl.textContent = fact.text;

    if (!sourceEl) return;

    sourceEl.textContent = '';
    sourceEl.hidden = true;

    if (!fact.source) return;

    sourceEl.hidden = false;
    sourceEl.appendChild(document.createTextNode('Source: '));

    if (fact.sourceUrl) {
      const link = document.createElement('a');
      link.href = fact.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = fact.source;
      sourceEl.appendChild(link);
    } else {
      sourceEl.appendChild(document.createTextNode(fact.source));
    }
  }

  function fadeIn() {
    const el = ensureOverlay();
    el.hidden = false;
    el.classList.remove('is-visible');
    document.body.classList.add('fact-loader-active');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-visible');
      });
    });
  }

  function fadeOut() {
    return new Promise(function (resolve) {
      if (!overlayEl) {
        resolve();
        return;
      }
      overlayEl.classList.remove('is-visible');
      window.setTimeout(function () {
        if (overlayEl) {
          overlayEl.hidden = true;
        }
        if (activeSessions <= 0) {
          document.body.classList.remove('fact-loader-active');
        }
        resolve();
      }, FADE_MS);
    });
  }

  function createSession() {
    let finished = false;
    let visible = false;
    let shownAt = 0;
    let showTimer = null;

    activeSessions += 1;

    function scheduleShow() {
      showTimer = window.setTimeout(function () {
        if (finished) return;
        visible = true;
        shownAt = Date.now();
        renderFact(pickRandomFact());
        fadeIn();
      }, LAZY_DELAY_MS);
    }

    scheduleShow();

    return {
      end: function endSession() {
        finished = true;
        if (showTimer) {
          window.clearTimeout(showTimer);
          showTimer = null;
        }
        activeSessions = Math.max(0, activeSessions - 1);

        if (!visible) {
          if (activeSessions <= 0) {
            document.body.classList.remove('fact-loader-active');
          }
          return Promise.resolve();
        }

        var visibleFor = Date.now() - shownAt;
        var hold = Math.max(0, MIN_VISIBLE_MS - visibleFor);
        return new Promise(function (resolve) {
          window.setTimeout(function () {
            fadeOut().then(resolve);
          }, hold);
        });
      },
    };
  }

  function run(work) {
    const session = createSession();
    const runWork =
      typeof work === 'function'
        ? Promise.resolve().then(work)
        : Promise.resolve(work);

    return runWork.finally(function () {
      return session.end();
    });
  }

  return {
    LAZY_DELAY_MS: LAZY_DELAY_MS,
    MIN_VISIBLE_MS: MIN_VISIBLE_MS,
    LABELS: LABELS,
    networkingFacts: networkingFacts,
    begin: createSession,
    run: run,
  };
});
