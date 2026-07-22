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

  const AVID_PANDA_SOURCE = {
    source: 'Avid Panda, 2025',
    sourceUrl: 'https://avidpanda.com/insights/networking-rankings/',
  };

  const networkingFacts = [
    {
      text: 'Opportunity listings are reviewed before they go live.',
      label: 'hub',
    },
    {
      text: 'Compare organiser reviews before you book a guest visit.',
      label: 'hub',
    },
    {
      text: 'Many UK networking groups are actively looking for people to host. Look at the business opportunities page.',
      label: 'hub',
    },
    {
      text: 'Every organiser gets a profile page — find them on the Events page.',
      label: 'hub',
    },
    {
      text: 'Filter by date, location, format, and price — map view included.',
      label: 'hub',
    },
    {
      text: 'UK networking spans breakfast clubs, chamber events, sector meetups, and exhibitions.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'In the UK, networking is more about collaboration than competition.',
      label: 'research',
      source: 'Mosaic Digital Media',
      sourceUrl: 'https://mosaicdigitalmedia.co.uk/benefits-of-networking-for-uk-businesses/',
    },
    {
      text: 'Business owners often refer clients to one another and share practical operational advice.',
      label: 'research',
      source: 'Mosaic Digital Media',
      sourceUrl: 'https://mosaicdigitalmedia.co.uk/benefits-of-networking-for-uk-businesses/',
    },
    {
      text: '95% of professionals say face-to-face meetings build lasting relationships.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: 'Trust usually takes 10+ meetings over months — one card swap rarely sticks.',
      label: 'research',
      source: 'BNI Breaking Boundaries',
      sourceUrl: 'https://bnibreakingboundaries.com/business-networking-roi/',
    },
    {
      text: '77% prefer in-person events to read body language.',
      label: 'research',
      source: 'Forbes (via Freshminds)',
      sourceUrl: 'https://www.freshminds.co.uk/blog/2023/09/online-networking-vs-in-person-which-is-most-effective-for-growing-your-career',
    },
    {
      text: 'UK professionals attend around seven networking events a year.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: '47% of networkers attend events mainly to learn and share industry knowledge.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: 'Only 23% go exclusively to seek new job opportunities.',
      label: 'research',
      source: 'StandOut CV, 2025',
      sourceUrl: 'https://standout-cv.com/stats/networking-statistics',
    },
    {
      text: 'Small business owners estimate they would lose around 28% of their business if they stopped networking.',
      label: 'research',
      source: 'Novor\u00e9sum\u00e9',
      sourceUrl: 'https://novoresume.com/career-blog/networking-statistics',
    },
    {
      text: '5\u201320% of new small business clients come from exhibitions.',
      label: 'research',
      source: 'Novor\u00e9sum\u00e9',
      sourceUrl: 'https://novoresume.com/career-blog/networking-statistics',
    },
    {
      text: 'London ranks as the UK\u2019s top city for networkers, with an index score of 7.35 out of 10.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Over \u00a378 million passed through London networking groups in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Glasgow ranks as the UK\u2019s second-best city for networking, with an index score of 6.71 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Birmingham ranks third for UK networking, with 16+ groups and over \u00a319 million passed through in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Chester ranks fourth among UK networking cities, with around 285 active networking members in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Manchester rounds out the UK\u2019s top five networking cities, with over \u00a331 million passed through in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'The South East leads UK networking regions, with an index score of 6.20 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'The North West ranks second among UK networking regions, scoring 5.43 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'London is third among UK networking regions, with an index score of 5.25 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'The West Midlands is fourth for UK networking, scoring 4.95 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
    },
    {
      text: 'Scotland rounds out the top five UK networking regions, scoring 3.67 out of 10 in 2024.',
      label: 'insight',
      ...AVID_PANDA_SOURCE,
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
