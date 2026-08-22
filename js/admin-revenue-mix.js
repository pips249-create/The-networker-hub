/**
 * Command Center — interactive Hub revenue mix model (sponsorship vs ticketing vs upsells).
 */
(function (global) {
  var STORAGE_KEY = 'admin-revenue-mix-v1';

  var PRICING = {
    headline: { events: 2000, organisers: 1000, opportunities: 2000 },
    pagePartner: { events: 600, organisers: 300, opportunities: 600 },
    citySponsor: 29,
    countySponsor: 49,
    opportunityListing: 25,
    featuredBoost: 55,
    creditPurchase: 15,
    platformFeeRate: 0.03,
  };

  var SCENARIOS = {
    launch: {
      eventsHeadline: 1,
      organisersHeadline: 0,
      opportunitiesHeadline: 0,
      eventsPagePartners: 2,
      organisersPagePartners: 1,
      opportunitiesPagePartners: 0,
      citySponsors: 6,
      countySponsors: 1,
      opportunityListings: 15,
      featuredBoostsPerMonth: 8,
      creditPurchasesPerMonth: 12,
      paidTicketsPerMonth: 400,
      avgTicketPrice: 12,
      membershipSubs: 40,
      avgMembershipPrice: 25,
    },
    growth: {
      eventsHeadline: 1,
      organisersHeadline: 1,
      opportunitiesHeadline: 0,
      eventsPagePartners: 3,
      organisersPagePartners: 2,
      opportunitiesPagePartners: 1,
      citySponsors: 12,
      countySponsors: 4,
      opportunityListings: 45,
      featuredBoostsPerMonth: 25,
      creditPurchasesPerMonth: 35,
      paidTicketsPerMonth: 2500,
      avgTicketPrice: 14,
      membershipSubs: 180,
      avgMembershipPrice: 30,
    },
    scale: {
      eventsHeadline: 1,
      organisersHeadline: 1,
      opportunitiesHeadline: 1,
      eventsPagePartners: 3,
      organisersPagePartners: 3,
      opportunitiesPagePartners: 3,
      citySponsors: 18,
      countySponsors: 8,
      opportunityListings: 90,
      featuredBoostsPerMonth: 45,
      creditPurchasesPerMonth: 70,
      paidTicketsPerMonth: 9000,
      avgTicketPrice: 16,
      membershipSubs: 600,
      avgMembershipPrice: 35,
    },
  };

  var chartInstances = { mix: null, crossover: null, scenarios: null };

  function defaultState() {
    return { scenario: 'launch', inputs: SCENARIOS.launch };
  }

  function loadState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.inputs) return defaultState();
      return {
        scenario: parsed.scenario || 'custom',
        inputs: Object.assign({}, SCENARIOS.launch, parsed.inputs),
      };
    } catch (_e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_e) {
      /* ignore */
    }
  }

  function clampInt(value, fallback, min, max) {
    var n = parseInt(String(value).trim(), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function clampFloat(value, fallback, min, max) {
    var n = parseFloat(String(value).trim());
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function gbp(amount, esc) {
    var n = Math.round(Number(amount) || 0);
    var s = '£' + n.toLocaleString('en-GB');
    return esc ? esc(s) : s;
  }

  function pct(part, total) {
    if (!total) return '0%';
    return Math.round((part / total) * 100) + '%';
  }

  function computeRevenue(inputs) {
    var sponsorship =
      inputs.eventsHeadline * PRICING.headline.events +
      inputs.organisersHeadline * PRICING.headline.organisers +
      inputs.opportunitiesHeadline * PRICING.headline.opportunities +
      inputs.eventsPagePartners * PRICING.pagePartner.events +
      inputs.organisersPagePartners * PRICING.pagePartner.organisers +
      inputs.opportunitiesPagePartners * PRICING.pagePartner.opportunities +
      inputs.citySponsors * PRICING.citySponsor +
      inputs.countySponsors * PRICING.countySponsor;

    var listings = inputs.opportunityListings * PRICING.opportunityListing;
    var boosts = inputs.featuredBoostsPerMonth * PRICING.featuredBoost;
    var credits = inputs.creditPurchasesPerMonth * PRICING.creditPurchase;
    var organiserUpsells = listings + boosts + credits;

    var ticketFees =
      inputs.paidTicketsPerMonth * inputs.avgTicketPrice * PRICING.platformFeeRate;
    var membershipFees =
      inputs.membershipSubs * inputs.avgMembershipPrice * PRICING.platformFeeRate;

    var transactionFees = ticketFees + membershipFees;
    var total = sponsorship + organiserUpsells + transactionFees;

    return {
      sponsorship: sponsorship,
      organiserUpsells: organiserUpsells,
      listings: listings,
      boosts: boosts,
      credits: credits,
      ticketFees: ticketFees,
      membershipFees: membershipFees,
      transactionFees: transactionFees,
      total: total,
    };
  }

  function ticketsToMatchSponsorship(sponsorshipMonthly, avgTicket) {
    var perTicket = avgTicket * PRICING.platformFeeRate;
    if (perTicket <= 0) return 0;
    return Math.ceil(sponsorshipMonthly / perTicket);
  }

  function destroyCharts() {
    Object.keys(chartInstances).forEach(function (key) {
      if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
      }
    });
  }

  function ensureChartJs() {
    if (global.Chart) return Promise.resolve(global.Chart);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-revenue-chartjs]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (global.Chart) resolve(global.Chart);
          else reject(new Error('chart_unavailable'));
        });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js';
      script.async = true;
      script.setAttribute('data-revenue-chartjs', '1');
      script.onload = function () {
        if (global.Chart) resolve(global.Chart);
        else reject(new Error('chart_unavailable'));
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function fieldNumber(name, label, value, max, hint) {
    return (
      '<label class="revenue-mix-field block text-xs">' +
      '<span class="font-semibold text-slate-600">' +
      label +
      '</span>' +
      '<input type="number" min="0"' +
      (max != null ? ' max="' + max + '"' : '') +
      ' class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" data-mix-field="' +
      name +
      '" value="' +
      value +
      '" />' +
      (hint ? '<span class="block mt-1 text-[11px] text-slate-500">' + hint + '</span>' : '') +
      '</label>'
    );
  }

  function renderInsight(state, revenue, esc) {
    var ticketsNeeded = ticketsToMatchSponsorship(revenue.sponsorship, state.inputs.avgTicketPrice);
    return (
      '<div class="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">' +
      '<p class="font-semibold text-brand-900">Key insight</p>' +
      '<p class="mt-2 leading-relaxed">' +
      'At <strong>' +
      esc(String(state.inputs.paidTicketsPerMonth)) +
      '</strong> paid tickets/month (' +
      gbp(state.inputs.avgTicketPrice, esc) +
      ' average), ticket fees contribute <strong>' +
      gbp(revenue.ticketFees, esc) +
      '</strong>. You would need <strong>' +
      esc(String(ticketsNeeded)) +
      ' paid tickets/month</strong> at that price for ticketing alone to match sponsorship (' +
      gbp(revenue.sponsorship, esc) +
      '). Sponsorship is <strong>' +
      esc(pct(revenue.sponsorship, revenue.total)) +
      '</strong> of total revenue in this model.</p></div>'
    );
  }

  function renderStats(revenue, esc) {
    return (
      '<div class="admin-stat-grid admin-stat-grid--4">' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Total monthly revenue</p>' +
      '<p class="admin-stat-card-value">' +
      gbp(revenue.total, esc) +
      '</p><p class="admin-stat-card-sub">ex-VAT model</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Sponsorship</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.sponsorship, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      gbp(revenue.sponsorship, esc) +
      '/mo</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Transaction fees</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.transactionFees, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      gbp(revenue.transactionFees, esc) +
      '/mo · 3% net</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Organiser upsells</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.organiserUpsells, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      gbp(revenue.organiserUpsells, esc) +
      '/mo</p></article></div>'
    );
  }

  function renderBreakEvenTable(state, revenue, esc) {
    var headlineTotal =
      state.inputs.eventsHeadline * PRICING.headline.events +
      state.inputs.organisersHeadline * PRICING.headline.organisers +
      state.inputs.opportunitiesHeadline * PRICING.headline.opportunities;
    var prices = [10, 12, 15, 18, 20, 25];
    var rows = prices
      .map(function (price) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-3 py-2 text-right font-medium">' +
          gbp(price, esc) +
          '</td>' +
          '<td class="px-3 py-2 text-right">' +
          gbp(price * PRICING.platformFeeRate, esc) +
          '</td>' +
          '<td class="px-3 py-2 text-right">' +
          esc(String(ticketsToMatchSponsorship(headlineTotal, price))) +
          '</td>' +
          '<td class="px-3 py-2 text-right">' +
          esc(String(ticketsToMatchSponsorship(revenue.sponsorship, price))) +
          '</td>' +
          '<td class="px-3 py-2 text-right">' +
          esc(
            String(
              ticketsToMatchSponsorship(revenue.sponsorship + revenue.organiserUpsells, price)
            )
          ) +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Break-even: paid tickets to replace sponsorship</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Hub net per ticket is 3% of ticket price (Stripe absorbed in booking fee).</p>' +
      '<div class="mt-4 admin-table-scroll">' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-3 py-2 text-right">Ticket price</th>' +
      '<th class="px-3 py-2 text-right">Hub net / ticket</th>' +
      '<th class="px-3 py-2 text-right">Match Headline sponsors</th>' +
      '<th class="px-3 py-2 text-right">Match all sponsorship</th>' +
      '<th class="px-3 py-2 text-right">Match sponsorship + upsells</th></tr></thead>' +
      '<tbody>' +
      rows +
      '</tbody></table></div>' +
      '<p class="text-xs text-slate-500 mt-3">Headline sponsors in model: ' +
      gbp(headlineTotal, esc) +
      '/mo · All sponsorship: ' +
      gbp(revenue.sponsorship, esc) +
      '/mo</p></section>'
    );
  }

  function renderShell(state, esc) {
    var revenue = computeRevenue(state.inputs);
    var scenarioOptions = [
      { id: 'launch', label: 'Launch (months 1–3)' },
      { id: 'growth', label: 'Growth (months 4–12)' },
      { id: 'scale', label: 'Scale (year 2+)' },
      { id: 'custom', label: 'Custom' },
    ];

    return (
      '<div class="revenue-mix space-y-5" id="revenue-mix-root">' +
      '<div class="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 sm:p-5">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-brand-700">Revenue mix model</p>' +
      '<p class="text-sm text-slate-600 mt-2 max-w-3xl">Plan monthly Hub revenue from sponsorship, organiser upsells, and transaction fees. Uses live rate card pricing (ex-VAT). Adjust sliders or load current sponsor slot fill from the site.</p>' +
      '<div class="mt-4 flex flex-wrap items-end gap-3">' +
      '<label class="block text-xs min-w-[12rem]"><span class="font-semibold text-slate-600">Scenario</span>' +
      '<select id="revenue-mix-scenario" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm">' +
      scenarioOptions
        .map(function (opt) {
          return (
            '<option value="' +
            opt.id +
            '"' +
            (state.scenario === opt.id ? ' selected' : '') +
            '>' +
            esc(opt.label) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<button type="button" id="revenue-mix-load-slots" class="rounded-lg border border-slate-200 bg-white text-sm font-semibold px-3 py-2 hover:bg-slate-50">Load live sponsor slots</button>' +
      '<button type="button" id="revenue-mix-reset" class="rounded-lg border border-slate-200 bg-white text-sm font-semibold px-3 py-2 hover:bg-slate-50">Reset to Launch</button>' +
      '<p id="revenue-mix-status" class="text-xs text-slate-500" role="status"></p>' +
      '<a href="#revenue-targets" class="text-xs font-semibold text-brand-700 hover:underline ml-auto">Sales targets (actuals) →</a>' +
      '<a href="#financials" class="text-xs font-semibold text-brand-700 hover:underline">Payments →</a>' +
      '</div></div>' +
      '<div id="revenue-mix-stats">' +
      renderStats(revenue, esc) +
      '</div>' +
      '<div id="revenue-mix-insight">' +
      renderInsight(state, revenue, esc) +
      '</div>' +
      '<div class="grid lg:grid-cols-2 gap-4">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Sponsorship inventory filled</h3>' +
      '<div class="mt-4 grid sm:grid-cols-2 gap-3">' +
      fieldNumber('eventsHeadline', 'Events Headline (£2k, max 1)', state.inputs.eventsHeadline, 1) +
      fieldNumber(
        'organisersHeadline',
        'Organisers Headline (£1k, max 1)',
        state.inputs.organisersHeadline,
        1
      ) +
      fieldNumber(
        'opportunitiesHeadline',
        'Opportunities Headline (£2k, max 1)',
        state.inputs.opportunitiesHeadline,
        1
      ) +
      fieldNumber(
        'eventsPagePartners',
        'Event Page Partners (£600, max 3)',
        state.inputs.eventsPagePartners,
        3
      ) +
      fieldNumber(
        'organisersPagePartners',
        'Organiser Page Partners (£300, max 3)',
        state.inputs.organisersPagePartners,
        3
      ) +
      fieldNumber(
        'opportunitiesPagePartners',
        'Opportunity Page Partners (£600, max 3)',
        state.inputs.opportunitiesPagePartners,
        3
      ) +
      fieldNumber(
        'citySponsors',
        'City Sponsors (£29 launch)',
        state.inputs.citySponsors,
        24
      ) +
      fieldNumber(
        'countySponsors',
        'County Sponsors (£49 launch)',
        state.inputs.countySponsors,
        12
      ) +
      '</div></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Volume & organiser products</h3>' +
      '<div class="mt-4 grid sm:grid-cols-2 gap-3">' +
      fieldNumber('paidTicketsPerMonth', 'Paid tickets / month', state.inputs.paidTicketsPerMonth) +
      fieldNumber(
        'avgTicketPrice',
        'Average ticket price (£)',
        state.inputs.avgTicketPrice,
        null,
        'Hub keeps 3% net'
      ) +
      fieldNumber('membershipSubs', 'Active membership subs', state.inputs.membershipSubs) +
      fieldNumber(
        'avgMembershipPrice',
        'Average membership price (£)',
        state.inputs.avgMembershipPrice
      ) +
      fieldNumber(
        'opportunityListings',
        'Opportunity listings live',
        state.inputs.opportunityListings,
        null,
        '£25/mo each'
      ) +
      fieldNumber(
        'featuredBoostsPerMonth',
        'Featured boosts sold / month',
        state.inputs.featuredBoostsPerMonth,
        null,
        '£55 one-time each'
      ) +
      fieldNumber(
        'creditPurchasesPerMonth',
        'Credit pack purchases / month',
        state.inputs.creditPurchasesPerMonth,
        null,
        'Blended ~£15'
      ) +
      '</div></section></div>' +
      '<div class="grid lg:grid-cols-2 gap-4">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Revenue mix</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Monthly split · ex-VAT</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-pie" aria-label="Revenue mix pie chart"></canvas></div></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Sponsorship vs ticketing as volume grows</h3>' +
      '<p class="text-xs text-slate-500 mt-1">X-axis: paid tickets per month · Y-axis: GBP/month</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-crossover" aria-label="Revenue crossover line chart"></canvas></div></section></div>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Scenario comparison (preset totals)</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Launch · Growth · Scale assumptions</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-scenarios" aria-label="Scenario comparison bar chart"></canvas></div></section>' +
      '<div id="revenue-mix-breakeven">' +
      renderBreakEvenTable(state, revenue, esc) +
      '</div></div>'
    );
  }

  function readInputsFromDom(root) {
    var inputs = Object.assign({}, SCENARIOS.launch);
    root.querySelectorAll('[data-mix-field]').forEach(function (el) {
      var key = el.getAttribute('data-mix-field');
      if (!key || !(key in inputs)) return;
      if (key === 'avgTicketPrice' || key === 'avgMembershipPrice') {
        inputs[key] = clampFloat(el.value, inputs[key], 0, 9999);
      } else {
        var max =
          key.indexOf('Headline') !== -1
            ? 1
            : key.indexOf('PagePartners') !== -1
              ? 3
              : key === 'citySponsors'
                ? 24
                : key === 'countySponsors'
                  ? 12
                  : 99999;
        inputs[key] = clampInt(el.value, inputs[key], 0, max);
      }
    });
    return inputs;
  }

  function paintDynamicSections(root, state, esc) {
    var revenue = computeRevenue(state.inputs);
    var statsWrap = root.querySelector('#revenue-mix-stats');
    if (statsWrap) statsWrap.innerHTML = renderStats(revenue, esc);
    var insightWrap = root.querySelector('#revenue-mix-insight');
    if (insightWrap) insightWrap.innerHTML = renderInsight(state, revenue, esc);
    var breakEvenWrap = root.querySelector('#revenue-mix-breakeven');
    if (breakEvenWrap) breakEvenWrap.innerHTML = renderBreakEvenTable(state, revenue, esc);
  }

  function renderCharts(state) {
    if (!global.Chart) return;
    destroyCharts();

    var revenue = computeRevenue(state.inputs);
    var mixCanvas = document.getElementById('revenue-mix-chart-pie');
    if (mixCanvas) {
      var mixData = [
        revenue.sponsorship,
        revenue.listings,
        revenue.boosts,
        revenue.credits,
        revenue.ticketFees,
        revenue.membershipFees,
      ].filter(function (v) {
        return v > 0;
      });
      var mixLabels = [];
      if (revenue.sponsorship > 0) mixLabels.push('Sponsorship');
      if (revenue.listings > 0) mixLabels.push('Listings');
      if (revenue.boosts > 0) mixLabels.push('Featured boosts');
      if (revenue.credits > 0) mixLabels.push('Credit packs');
      if (revenue.ticketFees > 0) mixLabels.push('Ticket fees');
      if (revenue.membershipFees > 0) mixLabels.push('Membership fees');

      chartInstances.mix = new global.Chart(mixCanvas, {
        type: 'doughnut',
        data: {
          labels: mixLabels,
          datasets: [
            {
              data: mixData,
              backgroundColor: [
                '#1e3a5f',
                '#6366f1',
                '#0891b2',
                '#0d9488',
                '#059669',
                '#65a30d',
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
        },
      });
    }

    var ticketVolumes = [0, 500, 1000, 2500, 5000, 10000, 15000, 20000];
    var flat = revenue.sponsorship + revenue.organiserUpsells;
    var crossoverCanvas = document.getElementById('revenue-mix-chart-crossover');
    if (crossoverCanvas) {
      chartInstances.crossover = new global.Chart(crossoverCanvas, {
        type: 'line',
        data: {
          labels: ticketVolumes.map(function (v) {
            return String(v);
          }),
          datasets: [
            {
              label: 'Sponsorship + upsells',
              data: ticketVolumes.map(function () {
                return flat;
              }),
              borderColor: '#1e3a5f',
              backgroundColor: 'rgba(30,58,95,0.08)',
              tension: 0.2,
            },
            {
              label: 'Ticket + membership fees',
              data: ticketVolumes.map(function (t) {
                var scaled = Object.assign({}, state.inputs, { paidTicketsPerMonth: t });
                return computeRevenue(scaled).transactionFees;
              }),
              borderColor: '#059669',
              backgroundColor: 'rgba(5,150,105,0.08)',
              tension: 0.2,
            },
            {
              label: 'Total Hub revenue',
              data: ticketVolumes.map(function (t) {
                var scaled = Object.assign({}, state.inputs, { paidTicketsPerMonth: t });
                return computeRevenue(scaled).total;
              }),
              borderColor: '#64748b',
              borderDash: [4, 4],
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { title: { display: true, text: 'Paid tickets / month' } },
            y: { beginAtZero: true, title: { display: true, text: 'GBP / month (ex-VAT)' } },
          },
        },
      });
    }

    var scenariosCanvas = document.getElementById('revenue-mix-chart-scenarios');
    if (scenariosCanvas) {
      chartInstances.scenarios = new global.Chart(scenariosCanvas, {
        type: 'bar',
        data: {
          labels: ['Launch', 'Growth', 'Scale'],
          datasets: [
            {
              label: 'Sponsorship',
              data: ['launch', 'growth', 'scale'].map(function (k) {
                return computeRevenue(SCENARIOS[k]).sponsorship;
              }),
              backgroundColor: '#1e3a5f',
            },
            {
              label: 'Organiser upsells',
              data: ['launch', 'growth', 'scale'].map(function (k) {
                return computeRevenue(SCENARIOS[k]).organiserUpsells;
              }),
              backgroundColor: '#d97706',
            },
            {
              label: 'Transaction fees',
              data: ['launch', 'growth', 'scale'].map(function (k) {
                return computeRevenue(SCENARIOS[k]).transactionFees;
              }),
              backgroundColor: '#059669',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: {
              stacked: true,
              beginAtZero: true,
              title: { display: true, text: 'GBP / month (ex-VAT)' },
            },
          },
        },
      });
    }
  }

  function applyAvailabilityToInputs(inputs, availability) {
    if (!availability) return inputs;
    var headline = availability.headline || {};
    var page = availability.pagePartner || {};
    if (headline.events) inputs.eventsHeadline = headline.events.taken || 0;
    if (headline.organisers) inputs.organisersHeadline = headline.organisers.taken || 0;
    if (headline.opportunities) inputs.opportunitiesHeadline = headline.opportunities.taken || 0;
    if (page.events) inputs.eventsPagePartners = page.events.taken || 0;
    if (page.organisers) inputs.organisersPagePartners = page.organisers.taken || 0;
    if (page.opportunities) inputs.opportunitiesPagePartners = page.opportunities.taken || 0;
    return inputs;
  }

  function bindEvents(main, helpers) {
    var root = main.querySelector('#revenue-mix-root');
    if (!root) return;

    var esc = helpers.esc;
    var state = loadState();

    function refresh(fromDom) {
      if (fromDom) {
        state.inputs = readInputsFromDom(root);
        state.scenario = 'custom';
        var scenarioEl = document.getElementById('revenue-mix-scenario');
        if (scenarioEl) scenarioEl.value = 'custom';
      }
      saveState(state);
      paintDynamicSections(root, state, esc);
      renderCharts(state);
    }

    root.addEventListener('input', function (e) {
      if (!e.target.matches('[data-mix-field]')) return;
      refresh(true);
    });

    var scenarioEl = document.getElementById('revenue-mix-scenario');
    if (scenarioEl) {
      scenarioEl.addEventListener('change', function () {
        var id = scenarioEl.value;
        state.scenario = id;
        if (id !== 'custom' && SCENARIOS[id]) {
          state.inputs = Object.assign({}, SCENARIOS[id]);
          root.querySelectorAll('[data-mix-field]').forEach(function (el) {
            var key = el.getAttribute('data-mix-field');
            if (key && key in state.inputs) el.value = String(state.inputs[key]);
          });
        }
        refresh(false);
      });
    }

    var resetBtn = document.getElementById('revenue-mix-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        destroyCharts();
        state = { scenario: 'launch', inputs: Object.assign({}, SCENARIOS.launch) };
        saveState(state);
        main.innerHTML = renderShell(state, esc);
        bindEvents(main, helpers);
        ensureChartJs()
          .then(function () {
            renderCharts(state);
          })
          .catch(function () {
            /* charts optional */
          });
      });
    }

    var loadBtn = document.getElementById('revenue-mix-load-slots');
    var statusEl = document.getElementById('revenue-mix-status');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        loadBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Loading sponsor slot fill…';
        fetch('/api/advertising?route=availability')
          .then(function (res) {
            return res.json();
          })
          .then(function (data) {
            if (!data || !data.ok || !data.availability) {
              throw new Error(data && data.message ? data.message : 'Availability unavailable');
            }
            state.inputs = applyAvailabilityToInputs(readInputsFromDom(root), data.availability);
            state.scenario = 'custom';
            if (scenarioEl) scenarioEl.value = 'custom';
            root.querySelectorAll('[data-mix-field]').forEach(function (el) {
              var key = el.getAttribute('data-mix-field');
              if (key && key in state.inputs) el.value = String(state.inputs[key]);
            });
            refresh(false);
            if (statusEl) statusEl.textContent = 'Updated Headline and Page Partner counts from live CMS slots.';
          })
          .catch(function (err) {
            if (statusEl) {
              statusEl.textContent =
                (err && err.message) || 'Could not load slot availability.';
            }
          })
          .finally(function () {
            loadBtn.disabled = false;
          });
      });
    }
  }

  function render(main, helpers) {
    destroyCharts();
    var esc = helpers.esc || function (s) {
      return String(s == null ? '' : s);
    };
    var state = loadState();
    main.innerHTML = renderShell(state, esc);
    bindEvents(main, helpers);
    ensureChartJs()
      .then(function () {
        renderCharts(state);
      })
      .catch(function () {
        /* charts optional */
      });
  }

  global.AdminRevenueMix = { render: render };
})(typeof window !== 'undefined' ? window : global);
