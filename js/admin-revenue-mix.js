/**
 * Command Center — interactive Hub revenue mix model (sponsorship vs ticketing vs upsells).
 */
(function (global) {
  var STORAGE_KEY = 'admin-revenue-mix-v1';

  /** Sales-targets categories that count as sponsorship / ads inventory. */
  var ACTUAL_SPONSORSHIP_IDS = {
    events: true,
    browse_organisers: true,
    awards: true,
  };
  /** Listings + premium packages. */
  var ACTUAL_UPSELL_IDS = { opportunities: true };
  /** Hub platform cut on tickets / memberships. */
  var ACTUAL_FEE_IDS = { ticket_sales: true };

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
  var actualSalesCache = null;

  function defaultState() {
    return {
      scenario: 'launch',
      inputs: Object.assign({}, SCENARIOS.launch),
      chartSource: 'actual',
    };
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
        chartSource: parsed.chartSource === 'model' ? 'model' : 'actual',
      };
    } catch (_e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      global.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scenario: state.scenario,
          inputs: state.inputs,
          chartSource: state.chartSource === 'model' ? 'model' : 'actual',
        })
      );
    } catch (_e) {
      /* ignore */
    }
  }

  function monthActualFromSeries(series) {
    if (!series || !Array.isArray(series.months)) return 0;
    var current = null;
    for (var i = 0; i < series.months.length; i++) {
      if (series.months[i] && series.months[i].isCurrent) {
        current = series.months[i];
        break;
      }
    }
    if (!current) {
      for (var j = series.months.length - 1; j >= 0; j--) {
        if (series.months[j] && !series.months[j].isFuture) {
          current = series.months[j];
          break;
        }
      }
    }
    if (!current || current.actual == null) return 0;
    return Number(current.actual) || 0;
  }

  function buildActualSalesSnapshot(payload) {
    if (!payload || typeof payload !== 'object') return null;
    var charts = payload.charts || {};
    var byCatCharts = charts.byCategory || {};
    var categories = Array.isArray(payload.categories) ? payload.categories : [];
    var pulse = payload.monthlyPulse || {};
    var monthLabel =
      (pulse.currentMonth && pulse.currentMonth.label) ||
      (charts.overall && charts.overall.currentKey) ||
      'This month';

    var byCategory = categories.map(function (cat) {
      var series = byCatCharts[cat.id];
      var amount = series ? monthActualFromSeries(series) : 0;
      return {
        id: cat.id,
        label: cat.label || cat.id,
        amount: Math.round(amount * 100) / 100,
      };
    });

    var sponsorship = 0;
    var organiserUpsells = 0;
    var ticketFees = 0;
    byCategory.forEach(function (row) {
      if (ACTUAL_SPONSORSHIP_IDS[row.id]) sponsorship += row.amount;
      else if (ACTUAL_UPSELL_IDS[row.id]) organiserUpsells += row.amount;
      else if (ACTUAL_FEE_IDS[row.id]) ticketFees += row.amount;
      else sponsorship += row.amount;
    });

    var total = sponsorship + organiserUpsells + ticketFees;
    var periodActual = payload.totals && payload.totals.actual != null ? Number(payload.totals.actual) : 0;
    var daysElapsed =
      payload.period && payload.period.daysElapsed != null ? Number(payload.period.daysElapsed) : 0;
    var monthlyPace = daysElapsed > 0 ? Math.round((periodActual / daysElapsed) * 30.44 * 100) / 100 : 0;

    return {
      monthLabel: monthLabel,
      periodLabel: (payload.period && payload.period.label) || '',
      byCategory: byCategory,
      periodActual: periodActual,
      monthlyPace: monthlyPace,
      mix: {
        sponsorship: Math.round(sponsorship * 100) / 100,
        organiserUpsells: Math.round(organiserUpsells * 100) / 100,
        listings: Math.round(organiserUpsells * 100) / 100,
        boosts: 0,
        credits: 0,
        ticketFees: Math.round(ticketFees * 100) / 100,
        membershipFees: 0,
        transactionFees: Math.round(ticketFees * 100) / 100,
        total: Math.round(total * 100) / 100,
      },
    };
  }

  function displayRevenue(state) {
    if (state.chartSource === 'actual') {
      if (actualSalesCache && actualSalesCache.mix) return actualSalesCache.mix;
      return {
        sponsorship: 0,
        organiserUpsells: 0,
        listings: 0,
        boosts: 0,
        credits: 0,
        ticketFees: 0,
        membershipFees: 0,
        transactionFees: 0,
        total: 0,
      };
    }
    return computeRevenue(state.inputs);
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
        if (global.Chart) {
          resolve(global.Chart);
          return;
        }
        var done = false;
        function finishOk() {
          if (done) return;
          done = true;
          if (global.Chart) resolve(global.Chart);
          else reject(new Error('chart_unavailable'));
        }
        function finishErr(err) {
          if (done) return;
          done = true;
          reject(err || new Error('chart_load_failed'));
        }
        existing.addEventListener('load', finishOk);
        existing.addEventListener('error', finishErr);
        setTimeout(function () {
          if (global.Chart) finishOk();
        }, 0);
        return;
      }

      var sources = [
        '/js/vendor/chart.umd.min.js',
        'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js',
      ];
      var idx = 0;

      function tryNext() {
        if (global.Chart) {
          resolve(global.Chart);
          return;
        }
        if (idx >= sources.length) {
          reject(new Error('chart_unavailable'));
          return;
        }
        var script = document.createElement('script');
        script.src = sources[idx++];
        script.async = true;
        script.setAttribute('data-revenue-chartjs', '1');
        script.onload = function () {
          if (global.Chart) resolve(global.Chart);
          else tryNext();
        };
        script.onerror = function () {
          script.remove();
          tryNext();
        };
        document.head.appendChild(script);
      }

      tryNext();
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

  function fieldSlider(name, label, value, min, max, step, hint) {
    return (
      '<label class="revenue-mix-field block text-xs">' +
      '<span class="flex items-center justify-between gap-2 font-semibold text-slate-600">' +
      '<span>' +
      label +
      '</span>' +
      '<span class="tabular-nums text-brand-900" data-mix-slider-value="' +
      name +
      '">' +
      value +
      '</span></span>' +
      '<input type="range" min="' +
      min +
      '" max="' +
      max +
      '" step="' +
      (step || 1) +
      '" class="mt-2 w-full accent-brand-700" data-mix-field="' +
      name +
      '" data-mix-slider="1" value="' +
      value +
      '" />' +
      (hint ? '<span class="block mt-1 text-[11px] text-slate-500">' + hint + '</span>' : '') +
      '</label>'
    );
  }

  function renderInsight(state, revenue, esc) {
    var usingActual = state.chartSource === 'actual' && actualSalesCache;
    if (usingActual) {
      var model = computeRevenue(state.inputs);
      var actualTotal = revenue.total || 0;
      var modelTotal = model.total || 0;
      var pace = actualSalesCache.monthlyPace || 0;
      return (
        '<div class="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">' +
        '<p class="font-semibold text-brand-900">What this means</p>' +
        '<p class="mt-2 leading-relaxed">' +
        '<strong>' +
        esc(actualSalesCache.monthLabel || 'This month') +
        '</strong> has booked <strong>' +
        gbp(actualTotal, esc) +
        '</strong> so far (ex-VAT, from Sales targets). ' +
        (pace > 0
          ? 'Period pace is about <strong>' +
            gbp(pace, esc) +
            '/mo</strong>. '
          : '') +
        'Your open scenario models <strong>' +
        gbp(modelTotal, esc) +
        '/mo</strong> — use the Model toggle to stress-test ticket volume against that plan.</p></div>'
      );
    }
    var ticketsNeeded = ticketsToMatchSponsorship(revenue.sponsorship, state.inputs.avgTicketPrice);
    return (
      '<div class="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">' +
      '<p class="font-semibold text-brand-900">What this means</p>' +
      '<p class="mt-2 leading-relaxed">' +
      'Ticket fees are <strong>' +
      gbp(revenue.ticketFees, esc) +
      '</strong> at your current volume. You’d need about <strong>' +
      esc(String(ticketsNeeded)) +
      ' paid tickets/month</strong> for ticketing alone to match sponsorship (' +
      gbp(revenue.sponsorship, esc) +
      '). Right now sponsorship is <strong>' +
      esc(pct(revenue.sponsorship, revenue.total)) +
      '</strong> of the model.</p></div>'
    );
  }

  function renderStats(state, revenue, esc) {
    var usingActual = state.chartSource === 'actual' && actualSalesCache;
    var totalSub = usingActual
      ? esc(actualSalesCache.monthLabel || 'This month') + ' · Sales targets'
      : 'ex-VAT model';
    var feeSub = usingActual
      ? gbp(revenue.transactionFees, esc) + ' this month'
      : gbp(revenue.transactionFees, esc) + '/mo · 3% net';
    var upsellSub = usingActual
      ? gbp(revenue.organiserUpsells, esc) + ' this month'
      : gbp(revenue.organiserUpsells, esc) + '/mo';
    var sponsorSub = usingActual
      ? gbp(revenue.sponsorship, esc) + ' this month'
      : gbp(revenue.sponsorship, esc) + '/mo';
    return (
      '<div class="admin-stat-grid admin-stat-grid--4">' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">' +
      (usingActual ? 'Actual revenue' : 'Total monthly revenue') +
      '</p>' +
      '<p class="admin-stat-card-value">' +
      gbp(revenue.total, esc) +
      '</p><p class="admin-stat-card-sub">' +
      totalSub +
      '</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Sponsorship</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.sponsorship, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      sponsorSub +
      '</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Transaction fees</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.transactionFees, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      feeSub +
      '</p></article>' +
      '<article class="admin-stat-card"><p class="admin-stat-card-label">Organiser upsells</p>' +
      '<p class="admin-stat-card-value">' +
      esc(pct(revenue.organiserUpsells, revenue.total)) +
      '</p><p class="admin-stat-card-sub">' +
      upsellSub +
      '</p></article></div>'
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
      '<p class="text-xs text-slate-500">Paid tickets needed to replace sponsorship. Hub net per ticket is 3% of ticket price.</p>' +
      '<div class="mt-3 admin-table-scroll">' +
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
      '/mo</p>'
    );
  }

  function renderShell(state, esc) {
    var revenue = displayRevenue(state);
    var usingActual = state.chartSource === 'actual';
    var scenarioOptions = [
      { id: 'launch', label: 'Launch', hint: 'Months 1–3' },
      { id: 'growth', label: 'Growth', hint: 'Months 4–12' },
      { id: 'scale', label: 'Scale', hint: 'Year 2+' },
      { id: 'custom', label: 'Custom', hint: 'Your numbers' },
    ];

    return (
      '<div class="revenue-mix space-y-4" id="revenue-mix-root">' +
      '<div class="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4 sm:p-5">' +
      '<p class="text-sm text-slate-600 max-w-3xl">Compare live Sales targets with the rate-card model. Actuals feed the charts; scenarios stay for planning ticket volume and inventory.</p>' +
      '<div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Chart data source">' +
      '<button type="button" class="revenue-mix-scenario-btn' +
      (usingActual ? ' is-active' : '') +
      '" data-mix-source="actual">Actual sales<span class="block text-[10px] font-semibold opacity-80">This month from Sales targets</span></button>' +
      '<button type="button" class="revenue-mix-scenario-btn' +
      (!usingActual ? ' is-active' : '') +
      '" data-mix-source="model">Model<span class="block text-[10px] font-semibold opacity-80">Rate card scenarios</span></button>' +
      '</div>' +
      '<div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Scenario">' +
      scenarioOptions
        .map(function (opt) {
          return (
            '<button type="button" class="revenue-mix-scenario-btn' +
            (state.scenario === opt.id ? ' is-active' : '') +
            '" data-mix-scenario="' +
            opt.id +
            '">' +
            esc(opt.label) +
            '<span class="block text-[10px] font-semibold opacity-80">' +
            esc(opt.hint) +
            '</span></button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="mt-3 flex flex-wrap items-center gap-2">' +
      '<button type="button" id="revenue-mix-refresh-actuals" class="rounded-lg border border-slate-200 bg-white text-sm font-semibold px-3 py-2 hover:bg-slate-50">Refresh actual sales</button>' +
      '<button type="button" id="revenue-mix-load-slots" class="rounded-lg border border-slate-200 bg-white text-sm font-semibold px-3 py-2 hover:bg-slate-50">Load live sponsor slots</button>' +
      '<button type="button" id="revenue-mix-reset" class="rounded-lg border border-slate-200 bg-white text-sm font-semibold px-3 py-2 hover:bg-slate-50">Reset to Launch</button>' +
      '<p id="revenue-mix-status" class="text-xs text-slate-500" role="status"></p>' +
      '<a href="#revenue-targets" class="text-xs font-semibold text-brand-700 hover:underline ml-auto">Sales targets →</a>' +
      '<a href="#financials" class="text-xs font-semibold text-brand-700 hover:underline">Payments →</a>' +
      '</div></div>' +
      '<div id="revenue-mix-stats">' +
      renderStats(state, revenue, esc) +
      '</div>' +
      '<div id="revenue-mix-insight">' +
      renderInsight(state, revenue, esc) +
      '</div>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900">Ticket volume (biggest lever)</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Drag to see when fees start to matter vs sponsorship. Affects the Model view.</p>' +
      '<div class="mt-4 grid sm:grid-cols-2 gap-4">' +
      fieldSlider(
        'paidTicketsPerMonth',
        'Paid tickets / month',
        state.inputs.paidTicketsPerMonth,
        0,
        20000,
        50
      ) +
      fieldSlider(
        'avgTicketPrice',
        'Average ticket price (£)',
        state.inputs.avgTicketPrice,
        1,
        50,
        1,
        'Hub keeps 3% net'
      ) +
      fieldNumber('membershipSubs', 'Active membership subs', state.inputs.membershipSubs) +
      fieldNumber(
        'avgMembershipPrice',
        'Average membership price (£)',
        state.inputs.avgMembershipPrice
      ) +
      '</div></section>' +
      '<details class="revenue-mix-details bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<summary>Sponsorship inventory &amp; organiser products</summary>' +
      '<div class="mt-4 grid lg:grid-cols-2 gap-4">' +
      '<div>' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Sponsorship slots filled</p>' +
      '<div class="grid sm:grid-cols-2 gap-3">' +
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
      fieldNumber('citySponsors', 'City Sponsors (£29 launch)', state.inputs.citySponsors, 24) +
      fieldNumber('countySponsors', 'County Sponsors (£49 launch)', state.inputs.countySponsors, 12) +
      '</div></div>' +
      '<div>' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Organiser upsells</p>' +
      '<div class="grid sm:grid-cols-2 gap-3">' +
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
      '</div></div></div></details>' +
      '<details class="revenue-mix-details bg-white rounded-xl border border-slate-200 p-5 shadow-sm" open>' +
      '<summary>Charts</summary>' +
      '<div class="mt-4 grid lg:grid-cols-2 gap-4">' +
      '<div>' +
      '<h3 class="font-bold text-brand-900 text-sm">Revenue mix</h3>' +
      '<p class="text-xs text-slate-500 mt-1" id="revenue-mix-pie-caption">' +
      (usingActual
        ? esc(actualSalesCache && actualSalesCache.monthLabel
            ? actualSalesCache.monthLabel + ' · Sales targets'
            : 'This month · Sales targets')
        : 'Monthly split · ex-VAT model') +
      '</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-pie" aria-label="Revenue mix pie chart"></canvas></div></div>' +
      '<div>' +
      '<h3 class="font-bold text-brand-900 text-sm">Sponsorship vs ticketing as volume grows</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Model projection · X-axis: paid tickets per month</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-crossover" aria-label="Revenue crossover line chart"></canvas></div></div></div>' +
      '<div class="mt-4">' +
      '<h3 class="font-bold text-brand-900 text-sm">Scenario comparison</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Launch · Growth · Scale' +
      (actualSalesCache ? ' · Actual (' + esc(actualSalesCache.monthLabel || 'this month') + ')' : '') +
      '</p>' +
      '<div class="relative h-64 mt-3"><canvas id="revenue-mix-chart-scenarios" aria-label="Scenario comparison bar chart"></canvas></div></div></details>' +
      '<details class="revenue-mix-details bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<summary>Break-even table</summary>' +
      '<div class="mt-4" id="revenue-mix-breakeven">' +
      renderBreakEvenTable(state, computeRevenue(state.inputs), esc) +
      '</div></details></div>'
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
    var revenue = displayRevenue(state);
    var statsWrap = root.querySelector('#revenue-mix-stats');
    if (statsWrap) statsWrap.innerHTML = renderStats(state, revenue, esc);
    var insightWrap = root.querySelector('#revenue-mix-insight');
    if (insightWrap) insightWrap.innerHTML = renderInsight(state, revenue, esc);
    var breakEvenWrap = root.querySelector('#revenue-mix-breakeven');
    if (breakEvenWrap) {
      breakEvenWrap.innerHTML = renderBreakEvenTable(state, computeRevenue(state.inputs), esc);
    }
    var pieCaption = root.querySelector('#revenue-mix-pie-caption');
    if (pieCaption) {
      pieCaption.textContent =
        state.chartSource === 'actual'
          ? (actualSalesCache && actualSalesCache.monthLabel
              ? actualSalesCache.monthLabel + ' · Sales targets'
              : 'This month · Sales targets')
          : 'Monthly split · ex-VAT model';
    }
    root.querySelectorAll('[data-mix-source]').forEach(function (btn) {
      btn.classList.toggle(
        'is-active',
        btn.getAttribute('data-mix-source') === state.chartSource
      );
    });
    root.querySelectorAll('[data-mix-slider-value]').forEach(function (el) {
      var key = el.getAttribute('data-mix-slider-value');
      if (key && key in state.inputs) el.textContent = String(state.inputs[key]);
    });
  }

  function syncScenarioButtons(root, scenario) {
    root.querySelectorAll('[data-mix-scenario]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-mix-scenario') === scenario);
    });
  }

  function applyInputsToDom(root, inputs) {
    root.querySelectorAll('[data-mix-field]').forEach(function (el) {
      var key = el.getAttribute('data-mix-field');
      if (key && key in inputs) el.value = String(inputs[key]);
    });
    root.querySelectorAll('[data-mix-slider-value]').forEach(function (el) {
      var key = el.getAttribute('data-mix-slider-value');
      if (key && key in inputs) el.textContent = String(inputs[key]);
    });
  }

  function renderCharts(state) {
    if (!global.Chart) return;
    destroyCharts();

    var modelRevenue = computeRevenue(state.inputs);
    var usingActual = state.chartSource === 'actual' && actualSalesCache;
    var mixCanvas = document.getElementById('revenue-mix-chart-pie');
    if (mixCanvas) {
      var mixData = [];
      var mixLabels = [];
      var mixColors = [];
      if (usingActual) {
        var categoryColors = {
          events: '#1e3a5f',
          opportunities: '#6366f1',
          ticket_sales: '#059669',
          browse_organisers: '#0891b2',
          awards: '#d97706',
        };
        (actualSalesCache.byCategory || []).forEach(function (row) {
          if (!(row.amount > 0)) return;
          mixLabels.push(row.label);
          mixData.push(row.amount);
          mixColors.push(categoryColors[row.id] || '#64748b');
        });
        if (!mixData.length) {
          mixLabels = ['No sales logged this month'];
          mixData = [1];
          mixColors = ['#e2e8f0'];
        }
      } else {
        var revenue = modelRevenue;
        var pieces = [
          { label: 'Sponsorship', value: revenue.sponsorship, color: '#1e3a5f' },
          { label: 'Listings', value: revenue.listings, color: '#6366f1' },
          { label: 'Featured boosts', value: revenue.boosts, color: '#0891b2' },
          { label: 'Credit packs', value: revenue.credits, color: '#0d9488' },
          { label: 'Ticket fees', value: revenue.ticketFees, color: '#059669' },
          { label: 'Membership fees', value: revenue.membershipFees, color: '#65a30d' },
        ];
        pieces.forEach(function (piece) {
          if (!(piece.value > 0)) return;
          mixLabels.push(piece.label);
          mixData.push(piece.value);
          mixColors.push(piece.color);
        });
      }

      chartInstances.mix = new global.Chart(mixCanvas, {
        type: 'doughnut',
        data: {
          labels: mixLabels,
          datasets: [
            {
              data: mixData,
              backgroundColor: mixColors,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var v = ctx.raw;
                  if (usingActual && mixLabels[0] === 'No sales logged this month') {
                    return ' £0 this month';
                  }
                  return ' £' + Math.round(Number(v) || 0).toLocaleString('en-GB');
                },
              },
            },
          },
        },
      });
    }

    var ticketVolumes = [0, 500, 1000, 2500, 5000, 10000, 15000, 20000];
    var flat = modelRevenue.sponsorship + modelRevenue.organiserUpsells;
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
      var scenarioKeys = ['launch', 'growth', 'scale'];
      var scenarioLabels = ['Launch', 'Growth', 'Scale'];
      var sponsorshipData = scenarioKeys.map(function (k) {
        return computeRevenue(SCENARIOS[k]).sponsorship;
      });
      var upsellData = scenarioKeys.map(function (k) {
        return computeRevenue(SCENARIOS[k]).organiserUpsells;
      });
      var feeData = scenarioKeys.map(function (k) {
        return computeRevenue(SCENARIOS[k]).transactionFees;
      });
      if (actualSalesCache && actualSalesCache.mix) {
        scenarioLabels.push('Actual');
        sponsorshipData.push(actualSalesCache.mix.sponsorship);
        upsellData.push(actualSalesCache.mix.organiserUpsells);
        feeData.push(actualSalesCache.mix.transactionFees);
      }
      chartInstances.scenarios = new global.Chart(scenariosCanvas, {
        type: 'bar',
        data: {
          labels: scenarioLabels,
          datasets: [
            {
              label: 'Sponsorship',
              data: sponsorshipData,
              backgroundColor: '#1e3a5f',
            },
            {
              label: 'Organiser upsells',
              data: upsellData,
              backgroundColor: '#d97706',
            },
            {
              label: 'Transaction fees',
              data: feeData,
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

  function fetchActualSales(helpers) {
    var getter =
      helpers && typeof helpers.adminGet === 'function'
        ? helpers.adminGet
        : function (url) {
            return fetch(url, { credentials: 'include', cache: 'no-store' }).then(function (res) {
              return res.json();
            });
          };
    return getter('/api/admin/revenue-targets').then(function (data) {
      if (!data || data.ok === false) {
        throw new Error((data && data.message) || 'Could not load Sales targets');
      }
      var payload = data.revenueTargets || data;
      var snapshot = buildActualSalesSnapshot(payload);
      if (!snapshot) throw new Error('Sales targets returned no data');
      actualSalesCache = snapshot;
      return snapshot;
    });
  }

  function bindEvents(main, helpers) {
    var root = main.querySelector('#revenue-mix-root');
    if (!root) return;

    var esc = helpers.esc;
    var state = loadState();
    if (!state.chartSource) state.chartSource = 'actual';

    function refresh(fromDom) {
      if (fromDom) {
        state.inputs = readInputsFromDom(root);
        state.scenario = 'custom';
        syncScenarioButtons(root, 'custom');
      }
      saveState(state);
      paintDynamicSections(root, state, esc);
      renderCharts(state);
    }

    function setStatus(msg) {
      var statusEl = document.getElementById('revenue-mix-status');
      if (statusEl) statusEl.textContent = msg || '';
    }

    function loadActuals(showStatus) {
      if (showStatus) setStatus('Loading actual sales…');
      return fetchActualSales(helpers)
        .then(function (snapshot) {
          setStatus(
            'Linked to Sales targets — ' +
              (snapshot.monthLabel || 'this month') +
              ' · £' +
              Math.round(snapshot.mix.total || 0).toLocaleString('en-GB') +
              ' booked'
          );
          refresh(false);
        })
        .catch(function (err) {
          setStatus((err && err.message) || 'Could not load actual sales.');
        });
    }

    root.addEventListener('input', function (e) {
      if (!e.target.matches('[data-mix-field]')) return;
      if (e.target.getAttribute('data-mix-slider') === '1') {
        var key = e.target.getAttribute('data-mix-field');
        var label = root.querySelector('[data-mix-slider-value="' + key + '"]');
        if (label) label.textContent = e.target.value;
      }
      refresh(true);
    });

    root.addEventListener('click', function (e) {
      var sourceBtn = e.target.closest('[data-mix-source]');
      if (sourceBtn && root.contains(sourceBtn)) {
        var source = sourceBtn.getAttribute('data-mix-source');
        if (source === 'actual' || source === 'model') {
          state.chartSource = source;
          saveState(state);
          if (source === 'actual' && !actualSalesCache) {
            loadActuals(true);
            return;
          }
          refresh(false);
        }
        return;
      }

      var btn = e.target.closest('[data-mix-scenario]');
      if (!btn || !root.contains(btn)) return;
      var id = btn.getAttribute('data-mix-scenario');
      if (!id) return;
      state.scenario = id;
      if (id !== 'custom' && SCENARIOS[id]) {
        state.inputs = Object.assign({}, SCENARIOS[id]);
        applyInputsToDom(root, state.inputs);
      }
      syncScenarioButtons(root, id);
      refresh(false);
    });

    root.addEventListener('toggle', function (e) {
      if (!e.target || !e.target.matches || !e.target.matches('details.revenue-mix-details')) return;
      if (!e.target.open || !e.target.querySelector('canvas')) return;
      requestAnimationFrame(function () {
        renderCharts(state);
      });
    });

    var resetBtn = document.getElementById('revenue-mix-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        destroyCharts();
        state = {
          scenario: 'launch',
          inputs: Object.assign({}, SCENARIOS.launch),
          chartSource: state.chartSource || 'actual',
        };
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
        if (!actualSalesCache) loadActuals(false);
      });
    }

    var refreshActualsBtn = document.getElementById('revenue-mix-refresh-actuals');
    if (refreshActualsBtn) {
      refreshActualsBtn.addEventListener('click', function () {
        refreshActualsBtn.disabled = true;
        loadActuals(true).finally(function () {
          refreshActualsBtn.disabled = false;
        });
      });
    }

    var loadBtn = document.getElementById('revenue-mix-load-slots');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        loadBtn.disabled = true;
        setStatus('Loading sponsor slot fill…');
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
            applyInputsToDom(root, state.inputs);
            syncScenarioButtons(root, 'custom');
            refresh(false);
            setStatus('Updated Headline and Page Partner counts from live CMS slots.');
          })
          .catch(function (err) {
            setStatus((err && err.message) || 'Could not load slot availability.');
          })
          .finally(function () {
            loadBtn.disabled = false;
          });
      });
    }

    // Always pull latest actuals when the page opens so charts stay linked.
    loadActuals(true);
  }

  function render(main, helpers) {
    destroyCharts();
    var esc = helpers.esc || function (s) {
      return String(s == null ? '' : s);
    };
    var state = loadState();
    if (!state.chartSource) state.chartSource = 'actual';
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
