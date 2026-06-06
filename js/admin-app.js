/**
 * The Networker — unified admin panel (SPA, hash routing).
 */
(function () {
  var liveUsers = [];
  var liveListings = [];
  var liveReviews = [];

  var PAGE_META = {
    dashboard: { title: 'Overview Dashboard', subtitle: 'System-wide performance health check' },
    'event-health': {
      title: 'Event data issues',
      subtitle: 'Fix published events missing dates, organisers, VAT, or profile data',
    },
    users: { title: 'User & Account Directory', subtitle: 'Manage all platform accounts' },
    moderation: { title: 'Content Moderation', subtitle: 'Review listings and attendee feedback' },
    financials: { title: 'Financial Hub', subtitle: 'Stripe ledger, payouts & automation logs' },
    sponsorship: {
      title: 'Sponsorship & Advertisement Management',
      subtitle: 'Swap Sponsor Hub image, copy, and tracking link without code changes',
    },
  };

  var EVENT_TYPES = [
    'Networking meeting',
    'Netwalking',
    'Conference',
    'Exhibition',
    'Awards ceremony',
  ];
  var MEETING_FORMATS = ['In person', 'Online', 'Hybrid'];
  var healthCache = null;

  /** Default creative for events-sponsor-hub (matches events browse Sponsor Hub). */
  var SPONSOR_SLOT_DEFAULTS = {
    slotKey: 'events-sponsor-hub',
    label: 'Events — Sponsor Hub',
    companyName: '',
    logoUrl: '',
    tagline: 'Get sponsored: Reach 10k founders monthly from £2,000/month',
    bullets: [
      'Premium placement beside Featured events',
      'Short line of copy',
      'Direct link to your landing page',
    ],
    ctaLabel: 'Enquire now',
    ctaUrl: 'mailto:sales@the-networker.co.uk?subject=Sponsor%20Hub%20enquiry',
    active: true,
  };

  var shell = document.getElementById('admin-shell');
  var gate = document.getElementById('admin-gate');
  var main = document.getElementById('admin-main');
  var currentUser = null;
  var selectedUser = null;

  function fmtMoney(n) {
    return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function attrEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function formField(form, name) {
    if (!form || !form.elements) return null;
    return form.elements.namedItem(name);
  }

  function formFieldVal(form, name) {
    var el = formField(form, name);
    return el ? String(el.value || '').trim() : '';
  }

  function setActiveNav(route) {
    document.querySelectorAll('.admin-nav-link').forEach(function (a) {
      var on = a.getAttribute('data-route') === route;
      a.classList.toggle('bg-white/15', on);
      a.classList.toggle('text-white', on);
      a.classList.toggle('text-white/80', !on);
    });
    var meta = PAGE_META[route] || PAGE_META.dashboard;
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.subtitle;
  }

  function updateHealthBadge(count) {
    var badge = document.getElementById('admin-health-badge');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.remove('hidden');
      badge.setAttribute('aria-label', n + ' events need data fixes');
    } else {
      badge.classList.add('hidden');
      badge.setAttribute('aria-label', 'No event data issues');
    }
  }

  function adminGet(url) {
    return fetch(url, { credentials: 'include' }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          data = data || {};
          data.error = data.error || data.message || 'request_failed';
        }
        return data;
      });
    });
  }

  function alertCard(a) {
    var bg =
      a.severity === 'high'
        ? 'bg-red-50 border-red-200 text-red-800'
        : a.severity === 'medium'
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-slate-50 border-slate-200 text-slate-700';
    return (
      '<div class="rounded-lg border p-4 ' +
      bg +
      '"><p class="font-semibold text-sm">' +
      esc(a.title) +
      '</p><p class="text-xs mt-1 opacity-90">' +
      esc(a.detail) +
      '</p></div>'
    );
  }

  function fetchEventHealth() {
    return fetch('/api/admin/event-health', { credentials: 'include' })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) {
            data = data || {};
            data.error = data.error || 'request_failed';
            return data;
          }
          if (data && data.configured !== false) {
            healthCache = data;
            updateHealthBadge(data.count);
          }
          return data;
        });
      })
      .catch(function () {
        return { error: 'network_error' };
      });
  }

  function issueBadge(issue) {
    var cls =
      issue.severity === 'high'
        ? 'bg-red-100 text-red-800'
        : issue.severity === 'medium'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';
    return (
      '<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 ' +
      cls +
      '">' +
      esc(issue.label) +
      '</span>'
    );
  }

  function toDatetimeLocalValue(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var pad = function (n) {
        return String(n).padStart(2, '0');
      };
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch (e) {
      return '';
    }
  }

  function organiserOptionsHtml(organisers, selectedId) {
    var sorted = (organisers || []).slice().sort(function (a, b) {
      var aPub = a.listingStatus === 'published' ? 0 : 1;
      var bPub = b.listingStatus === 'published' ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return (
      '<option value="">— Choose organiser —</option>' +
      sorted
        .map(function (o) {
          var label = o.name || o.id;
          if (o.listingStatus && o.listingStatus !== 'published') {
            label += ' (' + o.listingStatus + ')';
          }
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (selectedId === o.id ? ' selected' : '') +
            '>' +
            esc(label) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function saveEventHealthForm(form) {
    var article = form.closest('[data-event-id]');
    var id = article && article.getAttribute('data-event-id');
    var msg = form.querySelector('.event-health-msg');
    var btn = form.querySelector('button[type="submit"]');
    if (!id) return;

    var payload = { id: id };
    var starts = formFieldVal(form, 'starts_at');
    if (starts) payload.starts_at = new Date(starts).toISOString();
    else payload.starts_at = null;
    payload.organiser_id = formFieldVal(form, 'organiser_id') || null;
    payload.event_type = formFieldVal(form, 'event_type') || null;
    payload.meeting_type = formFieldVal(form, 'meeting_type') || null;
    payload.vat_treatment = formFieldVal(form, 'vat_treatment') || null;

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'event-health-msg text-xs text-slate-500';
    }

    fetch('/api/admin/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Save failed (' + r.status + ')');
          }
          return body;
        });
      })
      .then(function () {
        if (msg) {
          msg.textContent = 'Saved — rescanning…';
          msg.className = 'event-health-msg text-xs text-emerald-700 font-semibold';
        }
        return fetchEventHealth();
      })
      .then(function () {
        renderEventHealth();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'event-health-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function bindEventHealthForms() {
    if (!main || main.dataset.healthBound) return;
    main.dataset.healthBound = '1';
    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList || !form.classList.contains('event-health-form')) return;
      e.preventDefault();
      saveEventHealthForm(form);
    });
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-use-first-organiser]');
      if (!btn) return;
      var article = btn.closest('[data-event-id]');
      var form = article && article.querySelector('.event-health-form');
      var select = form && formField(form, 'organiser_id');
      var firstId = btn.getAttribute('data-use-first-organiser');
      if (select && firstId) {
        select.value = firstId;
        select.focus();
      }
    });
  }

  function renderEventHealth() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="event-health-status" class="text-sm text-slate-500">Scanning published events…</div>' +
      '<div id="event-health-summary" class="hidden grid sm:grid-cols-2 xl:grid-cols-4 gap-3"></div>' +
      '<div id="event-health-list" class="space-y-3"></div></div>';

    fetchEventHealth().then(function (data) {
      var status = document.getElementById('event-health-status');
      var summary = document.getElementById('event-health-summary');
      var list = document.getElementById('event-health-list');
      if (!status || !summary || !list) return;

      if (!data || data.error) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load event health (' +
          esc(data && data.error ? data.error : 'unknown') +
          '). Try signing in again.</span>';
        return;
      }

      if (data.configured === false) {
        status.textContent = 'Supabase is not configured — event health checks are unavailable.';
        return;
      }

      if (!data.count) {
        status.innerHTML =
          '<span class="text-emerald-700 font-semibold">All published events look complete.</span>';
        summary.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      var organisers = data.organisers || [];
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        data.count +
        ' published event' +
        (data.count === 1 ? '' : 's') +
        ' need attention.</span>' +
        (organisers.length
          ? ' <span class="text-slate-500">(' +
            organisers.length +
            ' organisers available to link)</span>'
          : ' <span class="text-red-700 font-semibold">No organisers found — create one in Organiser dashboard first.</span>');

      var issueCards = Object.keys(data.issuesByCode || {})
        .map(function (code) {
          var sample = (data.events[0] && data.events[0].issues.find(function (i) {
            return i.code === code;
          })) || { label: code, severity: 'low' };
          return (
            '<div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">' +
            '<p class="text-xs text-slate-500 uppercase font-semibold">' +
            esc(sample.label) +
            '</p>' +
            '<p class="text-xl font-bold text-brand-900 mt-1">' +
            data.issuesByCode[code] +
            '</p></div>'
          );
        })
        .join('');
      summary.innerHTML = issueCards;
      summary.classList.remove('hidden');

      var sortedOrganisers = organisers.slice().sort(function (a, b) {
        var aPub = a.listingStatus === 'published' ? 0 : 1;
        var bPub = b.listingStatus === 'published' ? 0 : 1;
        if (aPub !== bPub) return aPub - bPub;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      var firstOrganiserId = sortedOrganisers.length ? sortedOrganisers[0].id : '';

      list.innerHTML = (data.events || [])
        .map(function (ev) {
          var issueHtml = (ev.issues || []).map(issueBadge).join('');
          var needsOrganiser = (ev.issues || []).some(function (i) {
            return i.code === 'missing_organiser';
          });
          var typeOptions = EVENT_TYPES.map(function (t) {
            return (
              '<option value="' +
              attrEsc(t) +
              '"' +
              (ev.event_type === t ? ' selected' : '') +
              '>' +
              esc(t) +
              '</option>'
            );
          }).join('');
          var formatOptions = MEETING_FORMATS.map(function (f) {
            return (
              '<option value="' +
              attrEsc(f) +
              '"' +
              (ev.meeting_type === f ? ' selected' : '') +
              '>' +
              esc(f) +
              '</option>'
            );
          }).join('');
          var vatVal = ev.vat_treatment || '';
          var hasOrgProfileIssue = (ev.issues || []).some(function (i) {
            return i.code === 'missing_organiser_logo' || i.code === 'missing_organiser_profile';
          });

          return (
            '<article class="bg-white rounded-xl border border-slate-200 shadow-sm" data-event-id="' +
            attrEsc(ev.id) +
            '">' +
            '<div class="p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">' +
            '<div class="min-w-0 flex-1">' +
            '<h3 class="font-bold text-brand-900">' +
            esc(ev.title || 'Untitled') +
            '</h3>' +
            '<p class="text-xs text-slate-500 mt-1">/' +
            esc(ev.slug || '') +
            '</p>' +
            '<div class="mt-2">' +
            issueHtml +
            '</div>' +
            (needsOrganiser
              ? '<p class="text-xs text-red-800 mt-2">Select an organiser below, then click <strong>Save fixes</strong>.</p>'
              : '') +
            '</div>' +
            '<div class="flex flex-wrap gap-2 shrink-0">' +
            '<a href="../events/' +
            esc(ev.slug || '') +
            '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View page</a>' +
            (ev.organiser_id
              ? '<a href="../organiser/group-edit.html" target="_blank" rel="noopener" class="text-xs font-semibold text-slate-600 hover:underline">Organiser profile</a>'
              : '') +
            '</div></div>' +
            '<form class="event-health-form p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date & time</label>' +
            '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value="' +
            attrEsc(toDatetimeLocalValue(ev.starts_at)) +
            '"></div>' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser</label>' +
            '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white' +
            (needsOrganiser ? ' ring-2 ring-red-200' : '') +
            '">' +
            organiserOptionsHtml(organisers, ev.organiser_id) +
            '</select>' +
            (needsOrganiser && firstOrganiserId
              ? '<button type="button" class="mt-2 text-xs font-semibold text-brand-700 hover:underline" data-use-first-organiser="' +
                attrEsc(firstOrganiserId) +
                '">Use first available organiser</button>'
              : '') +
            '</div>' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
            '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
            '<option value="">—</option>' +
            typeOptions +
            '</select></div>' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
            '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
            '<option value="">—</option>' +
            formatOptions +
            '</select></div>' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">VAT (paid tickets)</label>' +
            '<select name="vat_treatment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
            '<option value="">—</option>' +
            '<option value="included"' +
            (vatVal === 'included' ? ' selected' : '') +
            '>Prices include VAT</option>' +
            '<option value="added"' +
            (vatVal === 'added' ? ' selected' : '') +
            '>VAT added at checkout</option>' +
            '</select></div>' +
            '<div class="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 pt-1">' +
            (hasOrgProfileIssue
              ? '<p class="text-xs text-amber-800">Logo or organiser bio must be updated in the organiser profile.</p>'
              : '') +
            '<button type="submit" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900 disabled:opacity-50">Save fixes</button>' +
            '<span class="event-health-msg text-xs text-slate-500"></span>' +
            '</div></form></article>'
          );
        })
        .join('');
    });
  }

  function renderDashboard() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<div id="dashboard-event-health-alert"></div>' +
      '<section class="space-y-3">' +
      '<h3 class="text-sm font-bold uppercase tracking-wide text-slate-500">Critical alerts</h3>' +
      '<div class="grid gap-3" id="dashboard-alerts"><p class="text-sm text-slate-500">Loading from Supabase…</p></div>' +
      '</section>' +
      '<section class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4" id="dashboard-metrics">' +
      card('Revenue & fees', '…', 'Loading…', 'emerald') +
      card('Live listings', '…', 'Loading…', 'brand') +
      card('Organisers & providers', '…', 'Loading…', 'violet') +
      card('Attendees / users', '…', 'Loading…', 'blue') +
      '</section>' +
      '<section class="grid lg:grid-cols-2 gap-6">' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-4">Recent system activity</h3>' +
      '<ul id="dashboard-activity"><li class="text-sm text-slate-500">Loading…</li></ul></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-2">Supabase snapshot</h3>' +
      '<p class="text-sm text-slate-500 mb-4">Live counts from events, registrations, organisers, and users.</p>' +
      '<pre id="live-metrics" class="text-xs bg-slate-50 p-4 rounded-lg overflow-auto max-h-64 text-slate-600">Loading…</pre>' +
      '</div></section></div>';

    adminGet('/api/admin/metrics').then(function (data) {
      var alertsEl = document.getElementById('dashboard-alerts');
      var metricsEl = document.getElementById('dashboard-metrics');
      var activityEl = document.getElementById('dashboard-activity');
      var preEl = document.getElementById('live-metrics');

      if (!data || data.error || data.configured === false) {
        if (alertsEl) {
          alertsEl.innerHTML =
            '<p class="text-sm text-red-700">Could not load dashboard data. Check Supabase env vars on Vercel.</p>';
        }
        if (preEl) preEl.textContent = JSON.stringify(data || { error: 'unavailable' }, null, 2);
        return;
      }

      var m = data.metrics || {};
      var listings = m.listings || {};

      if (metricsEl) {
        metricsEl.innerHTML =
          card('Revenue & fees', fmtMoney(m.revenue || 0), 'Platform fees: ' + fmtMoney(m.fees || 0), 'emerald') +
          card(
            'Live listings',
            String(listings.total || 0),
            'Meetings ' +
              (listings.meetings || 0) +
              ' · Exhibitions ' +
              (listings.exhibitions || 0) +
              ' · Training ' +
              (listings.training || 0),
            'brand'
          ) +
          card(
            'Organisers & providers',
            String(m.organisers || 0),
            'Workshops / training: ' + (m.providers || 0),
            'violet'
          ) +
          card('Attendees / users', String(m.attendees || 0), 'Hub accounts & attendee profiles', 'blue');
      }

      if (alertsEl) {
        var alerts = data.alerts || [];
        alertsEl.innerHTML = alerts.length
          ? alerts.map(alertCard).join('')
          : '<p class="text-sm text-emerald-700">No critical alerts right now.</p>';
      }

      if (activityEl) {
        var activity = data.activity || [];
        activityEl.innerHTML = activity.length
          ? activity
              .map(function (item) {
                return (
                  '<li class="relative pl-6 pb-6 border-l-2 border-brand-200 last:pb-0">' +
                  '<span class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-500"></span>' +
                  '<time class="text-xs text-slate-400 block">' +
                  fmtTime(item.time) +
                  '</time>' +
                  '<p class="text-sm text-slate-700 mt-1">' +
                  esc(item.text) +
                  '</p></li>'
                );
              })
              .join('')
          : '<li class="text-sm text-slate-500">No recent activity yet.</li>';
      }

      if (preEl) preEl.textContent = JSON.stringify(data, null, 2);
    });

    fetchEventHealth().then(function (data) {
      var slot = document.getElementById('dashboard-event-health-alert');
      if (!slot || !data || !data.count) return;
      slot.innerHTML =
        '<a href="#event-health" class="block rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 hover:bg-red-100/80 transition">' +
        '<p class="font-semibold text-sm">' +
        data.count +
        ' published event' +
        (data.count === 1 ? '' : 's') +
        ' missing data</p>' +
        '<p class="text-xs mt-1 opacity-90">Dates, organisers, VAT, or profile fields need fixing before pages show correctly. Open Event data issues to edit rows.</p>' +
        '</a>';
    });
  }

  function card(title, value, sub, color) {
    var accents = {
      emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200',
      brand: 'from-brand-500/10 to-brand-500/5 border-brand-200',
      violet: 'from-violet-500/10 to-violet-500/5 border-violet-200',
      blue: 'from-blue-500/10 to-blue-500/5 border-blue-200',
    };
    return (
      '<article class="bg-gradient-to-br ' +
      (accents[color] || accents.brand) +
      ' border rounded-xl p-5 shadow-sm">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">' +
      esc(title) +
      '</p>' +
      '<p class="text-2xl font-bold text-brand-900 mt-2">' +
      esc(value) +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-2">' +
      esc(sub) +
      '</p></article>'
    );
  }

  function renderUsers() {
    var roleOpts = ['All', 'Admin', 'Organiser', 'Attendee'];
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="users-status" class="text-sm text-slate-500">Loading users from Supabase…</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">' +
      '<div class="flex-1 min-w-[200px]"><label class="text-xs font-semibold text-slate-500 uppercase">Search</label>' +
      '<input type="search" id="user-search" placeholder="Name or email…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase">Role</label>' +
      '<select id="user-role-filter" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">' +
      roleOpts.map(function (r) {
        return '<option>' + r + '</option>';
      }).join('') +
      '</select></div></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<table class="w-full text-sm text-left"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th></tr></thead>' +
      '<tbody id="users-tbody"><tr><td colspan="5" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table></div></div>';

    function filterUsers() {
      var q = (document.getElementById('user-search').value || '').toLowerCase();
      var role = document.getElementById('user-role-filter').value;
      return liveUsers.filter(function (u) {
        if (role !== 'All' && u.role !== role) return false;
        if (q && (u.name + u.email).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function paint() {
      var tbody = document.getElementById('users-tbody');
      if (!tbody) return;
      var rows = filterUsers();
      if (!rows.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="px-4 py-6 text-slate-500">No users match your filters.</td></tr>';
        return;
      }
      tbody.innerHTML = rows
        .map(function (u) {
          var st =
            u.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800';
          return (
            '<tr class="border-t border-slate-100 hover:bg-brand-50/50 cursor-pointer user-row" data-user-id="' +
            esc(u.id) +
            '">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(u.name) +
            '</td>' +
            '<td class="px-4 py-3 text-slate-600">' +
            esc(u.email) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.role) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.city) +
            '</td>' +
            '<td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded-full ' +
            st +
            '">' +
            esc(u.status) +
            '</span></td></tr>'
          );
        })
        .join('');
      tbody.querySelectorAll('.user-row').forEach(function (row) {
        row.addEventListener('click', function () {
          var id = row.getAttribute('data-user-id');
          var u = liveUsers.find(function (x) {
            return x.id === id;
          });
          if (u) openUserDrawer(u);
        });
      });
    }

    adminGet('/api/admin/users').then(function (data) {
      var status = document.getElementById('users-status');
      if (!data || data.error || data.configured === false) {
        liveUsers = [];
        if (status) status.textContent = 'Could not load users from Supabase.';
        paint();
        return;
      }
      liveUsers = data.users || [];
      if (status) {
        status.textContent = liveUsers.length + ' account' + (liveUsers.length === 1 ? '' : 's') + ' from Supabase';
      }
      paint();
    });

    document.getElementById('user-search').addEventListener('input', paint);
    document.getElementById('user-role-filter').addEventListener('change', paint);
  }

  function openUserDrawer(u) {
    selectedUser = u;
    document.getElementById('drawer-name').textContent = u.name;
    document.getElementById('drawer-email').textContent = u.email;
    document.getElementById('drawer-body').innerHTML =
      '<button type="button" class="w-full rounded-lg bg-brand-700 text-white py-2.5 text-sm font-semibold hover:bg-brand-900">Change / Reset Password</button>' +
      '<div><h4 class="text-sm font-bold text-slate-700 mb-2">Edit profile</h4>' +
      '<label class="block text-xs text-slate-500 mb-1">Company / display name</label>' +
      '<input class="w-full border rounded-lg px-3 py-2 text-sm mb-3" value="' +
      esc(u.name) +
      '">' +
      '<label class="block text-xs text-slate-500 mb-1">Industry preferences</label>' +
      '<input class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Technology, Hospitality"></div>' +
      '<div class="flex items-center justify-between py-3 border-t border-slate-100">' +
      '<span class="text-sm font-medium">Suspend / ban account</span>' +
      '<button type="button" class="w-12 h-6 rounded-full ' +
      (u.status === 'Suspended' ? 'bg-red-500' : 'bg-slate-300') +
      ' relative"><span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow"></span></button></div>' +
      '<div class="flex items-center justify-between py-3 border-t border-slate-100">' +
      '<span class="text-sm font-medium">Featured organiser (carousel)</span>' +
      '<button type="button" class="w-12 h-6 rounded-full ' +
      (u.featured ? 'bg-brand-500' : 'bg-slate-300') +
      ' relative"><span class="absolute top-1 ' +
      (u.featured ? 'left-7' : 'left-1') +
      ' w-4 h-4 bg-white rounded-full shadow transition-all"></span></button></div>' +
      '<button type="button" class="w-full rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Save changes</button>';
    document.getElementById('user-drawer').classList.remove('hidden');
  }

  function listingsTableHtml(listings) {
    if (!listings.length) {
      return '<tr><td colspan="7" class="px-4 py-6 text-slate-500">No events in Supabase yet.</td></tr>';
    }
    return listings
      .map(function (l) {
        var soldLabel = l.capacity ? l.sold + '/' + l.capacity : String(l.sold || 0) + ' sold';
        var pct = l.capacity ? Math.round((l.sold / l.capacity) * 100) : 0;
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-4 py-3 font-medium">' +
          esc(l.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.type) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.organiser) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.city) +
          '</td>' +
          '<td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100">' +
          esc(l.status) +
          '</span></td>' +
          '<td class="px-4 py-3 min-w-[120px]">' +
          (l.capacity
            ? '<div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:' +
              pct +
              '%"></div></div>'
            : '') +
          '<span class="text-xs text-slate-500">' +
          esc(soldLabel) +
          '</span></td>' +
          '<td class="px-4 py-3"><a href="#event-health" class="text-brand-700 font-semibold text-xs hover:underline">Review data</a></td></tr>'
        );
      })
      .join('');
  }

  function reviewsHtml(reviews) {
    if (!reviews.length) {
      return '<p class="text-sm text-slate-500">No reviews yet.</p>';
    }
    return reviews
      .map(function (r) {
        return (
          '<article class="border border-slate-200 rounded-lg p-4 ' +
          (r.spam ? 'bg-red-50/50' : 'bg-white') +
          '">' +
          '<div class="flex justify-between gap-2"><div><p class="font-semibold text-sm">' +
          esc(r.user) +
          ' · ' +
          esc(r.event) +
          '</p><p class="text-amber-500 text-sm">' +
          '★'.repeat(Math.max(0, Math.min(5, r.rating))) +
          '</p></div><time class="text-xs text-slate-400">' +
          fmtTime(r.time) +
          '</time></div>' +
          '<p class="text-sm text-slate-600 mt-2">' +
          esc(r.text) +
          '</p>' +
          (r.spam
            ? '<p class="mt-2 text-xs font-semibold text-red-700">Flagged as possible spam</p>'
            : '') +
          '</article>'
        );
      })
      .join('');
  }

  function renderModeration() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="moderation-status" class="text-sm text-slate-500">Loading listings and reviews from Supabase…</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100 font-bold text-brand-900">All listings</div>' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tickets</th><th class="px-4 py-3"></th></tr></thead>' +
      '<tbody id="moderation-listings"><tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-4">Review moderation</h3>' +
      '<div class="space-y-3" id="moderation-reviews">Loading…</div></div></div>';

    adminGet('/api/admin/moderation').then(function (data) {
      var status = document.getElementById('moderation-status');
      var listingsEl = document.getElementById('moderation-listings');
      var reviewsEl = document.getElementById('moderation-reviews');
      if (!data || data.error || data.configured === false) {
        liveListings = [];
        liveReviews = [];
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        if (listingsEl) listingsEl.innerHTML = listingsTableHtml([]);
        if (reviewsEl) reviewsEl.innerHTML = reviewsHtml([]);
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      if (status) {
        status.textContent =
          liveListings.length + ' events · ' + liveReviews.length + ' reviews from Supabase';
      }
      if (listingsEl) listingsEl.innerHTML = listingsTableHtml(liveListings);
      if (reviewsEl) reviewsEl.innerHTML = reviewsHtml(liveReviews);
    });
  }

  function renderFinancials() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading financial data from Supabase…</p>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<h3 class="px-4 py-3 font-bold border-b border-slate-100">Stripe Connect ledger</h3>' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-4 py-3 text-left">Organiser</th><th class="px-4 py-3">Paid registrations</th><th class="px-4 py-3">Last payout</th><th class="px-4 py-3">Status</th></tr></thead>' +
      '<tbody id="financials-stripe"><tr><td colspan="4" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-2">Manual payout requests</h3>' +
      '<p class="text-sm text-slate-500 mb-4">Payout queue is not stored in Supabase yet.</p>' +
      '<div class="space-y-3" id="financials-queue"><p class="text-sm text-slate-500">None pending.</p></div></section>' +
      '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
      '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-4">Registration activity log</h3>' +
      '<div id="financials-log">Loading…</div></section></div>';

    adminGet('/api/admin/financials').then(function (data) {
      var status = document.getElementById('financials-status');
      var stripeEl = document.getElementById('financials-stripe');
      var logEl = document.getElementById('financials-log');

      if (!data || data.error || data.configured === false) {
        if (status) status.textContent = 'Could not load financial data from Supabase.';
        return;
      }

      var stripe = data.stripeAccounts || [];
      var log = data.automationLog || [];

      if (status) {
        status.textContent =
          stripe.length + ' organiser' + (stripe.length === 1 ? '' : 's') + ' · registration log from Supabase';
      }

      if (stripeEl) {
        stripeEl.innerHTML = stripe.length
          ? stripe
              .map(function (s) {
                var statusCls = s.status === 'Connected' ? 'text-emerald-600' : 'text-slate-500';
                return (
                  '<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium">' +
                  esc(s.organiser) +
                  '</td><td class="px-4 py-3">' +
                  esc(s.balance) +
                  '</td><td class="px-4 py-3">' +
                  esc(s.lastPayout) +
                  '</td><td class="px-4 py-3 font-medium ' +
                  statusCls +
                  '">' +
                  esc(s.status) +
                  '</td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="4" class="px-4 py-6 text-slate-500">No organisers in Supabase yet.</td></tr>';
      }

      if (logEl) {
        logEl.innerHTML = log.length
          ? log
              .map(function (l) {
                var cls =
                  l.status === 'error'
                    ? 'text-red-300 bg-red-950/30'
                    : l.status === 'ok'
                      ? 'text-emerald-300'
                      : 'text-slate-300';
                return (
                  '<div class="font-mono text-xs py-2 border-b border-white/10 ' +
                  cls +
                  '"><span class="text-slate-500">[' +
                  fmtTime(l.ts) +
                  ']</span> — ' +
                  esc(l.line) +
                  '</div>'
                );
              })
              .join('')
          : '<p class="text-sm text-slate-400">No registrations logged yet.</p>';
      }
    });
  }

  function sponsorHeadlineHtml(headline) {
    var safe = esc(String(headline || '').trim());
    if (!safe) return '';
    if (safe.indexOf(':') !== -1) {
      var parts = safe.split(':');
      return '<em>' + parts[0].trim() + ':</em> ' + parts.slice(1).join(':').trim();
    }
    return safe;
  }

  function sponsorBulletsFromBody(html) {
    var temp = document.createElement('div');
    temp.innerHTML = String(html || '');
    return Array.prototype.map
      .call(temp.querySelectorAll('li'), function (li) {
        return li.textContent.trim();
      })
      .filter(Boolean);
  }

  function sponsorTaglineFromBlock(block) {
    if (window.CmsSponsorFields) return window.CmsSponsorFields.tagline(block);
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function sponsorBulletsHtml(bullets) {
    if (!bullets.length) return '';
    return (
      '<ul class="sponsor-list">' +
      bullets
        .map(function (line) {
          return '<li>' + esc(line) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function sponsorBodyFromForm(creative) {
    return sponsorBulletsHtml(creative.bullets);
  }

  function sponsorPreviewLogoHtml(logoUrl) {
    if (logoUrl && /^(https?:|\/)/i.test(logoUrl)) {
      return (
        '<img src="' +
        esc(logoUrl) +
        '" alt="" class="block max-w-[200px] max-h-[100px] object-contain mb-3">'
      );
    }
    return (
      '<div class="w-[200px] h-[100px] mb-3 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-500">Your logo here</div>'
    );
  }

  function applySponsorBlockToForm(block) {
    if (!block) return;
    var company = document.getElementById('sponsor-company');
    var logoUrl = document.getElementById('sponsor-logo-url');
    var tagline = document.getElementById('sponsor-tagline');
    var bullets = document.getElementById('sponsor-bullets');
    var ctaLabel = document.getElementById('sponsor-cta-label');
    var ctaUrl = document.getElementById('sponsor-cta-url');
    var active = document.getElementById('sponsor-active');
    var lines = sponsorBulletsFromBody(block.body);

    if (company) company.value = String(block.company_name || '').trim();
    if (logoUrl) {
      logoUrl.value = String(block.logo_url || block.image_url || '').trim();
    }
    if (tagline) tagline.value = sponsorTaglineFromBlock(block);
    if (bullets && lines.length) bullets.value = lines.join('\n');
    if (ctaLabel && block.cta_label) ctaLabel.value = block.cta_label;
    if (ctaUrl && block.cta_url) ctaUrl.value = block.cta_url;
    if (active) active.checked = block.active !== false;
  }

  function renderSponsorship() {
    var d = SPONSOR_SLOT_DEFAULTS;
    var bulletsVal = d.bullets.join('\n');
    var sponsorLogoBase64 = null;
    var sponsorLogoMime = '';
    var sponsorLogoFilename = '';

    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="sponsor-status" class="text-sm text-slate-500">Loading Sponsor Hub from Supabase…</p>' +
      '<div class="grid lg:grid-cols-2 gap-6">' +
      '<form id="sponsor-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Placement slot</label>' +
      '<select id="sponsor-slot" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" disabled>' +
      '<option value="' +
      esc(d.slotKey) +
      '">' +
      esc(d.label) +
      '</option></select>' +
      '<p class="text-xs text-slate-500 mt-1">Published to the Events browse page Sponsor Hub block.</p></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="sponsor-active" class="rounded border-slate-300" checked> ' +
      'Sponsor active (uncheck to show “Become a sponsor” placeholder on site)</label>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-company">Company name</label>' +
      '<input type="text" id="sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Acme Ltd" value="' +
      esc(d.companyName) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-logo-url">Company logo URL</label>' +
      '<input type="text" id="sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2" placeholder="https://…" value="' +
      esc(d.logoUrl) +
      '">' +
      '<label class="block text-xs text-slate-500 mb-1" for="sponsor-logo-file">Or upload logo (max 2MB, 200×100 recommended)</label>' +
      '<input type="file" id="sponsor-logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="block w-full text-sm text-slate-600"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-tagline">Tagline / offer</label>' +
      '<input type="text" id="sponsor-tagline" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(d.tagline) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-bullets">Bullet copy (one line each)</label>' +
      '<textarea id="sponsor-bullets" rows="4" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      esc(bulletsVal) +
      '</textarea></div>' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-label">CTA button label</label>' +
      '<input type="text" id="sponsor-cta-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(d.ctaLabel) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-url">CTA link (https:// or mailto:)</label>' +
      '<input type="text" id="sponsor-cta-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(d.ctaUrl) +
      '"></div></div>' +
      '<div class="flex flex-wrap gap-3 pt-2">' +
      '<button type="button" id="sponsor-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Update preview</button>' +
      '<button type="button" id="sponsor-publish-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Publish to site</button>' +
      '</div></form>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">' +
      '<h3 class="font-bold text-brand-900 mb-1">Live preview</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Matches the Events browse Sponsor Hub block.</p>' +
      '<aside id="sponsor-preview" class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] max-w-md shadow-[0_4px_18px_rgba(91,47,153,0.1)]"></aside>' +
      '</section></div></div>';

    function setSponsorStatus(text, tone) {
      var el = document.getElementById('sponsor-status');
      if (!el) return;
      el.textContent = text;
      el.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function readForm() {
      var bullets = (document.getElementById('sponsor-bullets').value || '')
        .split('\n')
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean);
      var activeEl = document.getElementById('sponsor-active');
      var logoUrl = document.getElementById('sponsor-logo-url').value.trim();
      if (sponsorLogoBase64) logoUrl = sponsorLogoBase64;
      return {
        active: activeEl ? activeEl.checked : true,
        companyName: document.getElementById('sponsor-company').value.trim(),
        logoUrl: logoUrl,
        tagline: document.getElementById('sponsor-tagline').value.trim(),
        bullets: bullets.length ? bullets : d.bullets.slice(),
        ctaLabel: document.getElementById('sponsor-cta-label').value.trim() || d.ctaLabel,
        ctaUrl: document.getElementById('sponsor-cta-url').value.trim() || d.ctaUrl,
      };
    }

    function renderPreview() {
      var creative = readForm();
      var el = document.getElementById('sponsor-preview');
      if (!el) return;

      if (!creative.active) {
        el.innerHTML =
          '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3">★ Sponsor Hub</div>' +
          '<p class="text-base font-extrabold mb-2">Your brand here</p>' +
          '<p class="text-sm text-slate-600 mb-4">Reach 10k+ professionals monthly</p>' +
          '<span class="inline-block rounded-lg border border-[#c9a8d8] text-[#5b2f99] text-sm font-bold px-4 py-2">Find out more →</span>';
        return;
      }

      var taglineHtml = sponsorHeadlineHtml(creative.tagline);
      var list = sponsorBulletsHtml(creative.bullets);
      el.innerHTML =
        '<span class="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Sponsored</span>' +
        '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3 pr-16">★ Sponsor Hub</div>' +
        sponsorPreviewLogoHtml(creative.logoUrl) +
        (creative.companyName
          ? '<p class="text-sm font-extrabold mb-1">' + esc(creative.companyName) + '</p>'
          : '') +
        (taglineHtml ? '<p class="text-sm font-semibold leading-snug mb-3">' + taglineHtml + '</p>' : '') +
        '<div class="text-xs text-slate-600 mb-4">' +
        list +
        '</div>' +
        '<span class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-sm font-bold px-4 py-2.5">' +
        esc(creative.ctaLabel) +
        '</span>';
    }

    document.getElementById('sponsor-preview-btn').addEventListener('click', renderPreview);
    [
      'sponsor-company',
      'sponsor-logo-url',
      'sponsor-tagline',
      'sponsor-bullets',
      'sponsor-cta-label',
      'sponsor-cta-url',
      'sponsor-active',
    ].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener('input', renderPreview);
      if (input && input.type === 'checkbox') input.addEventListener('change', renderPreview);
    });

    document.getElementById('sponsor-logo-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setSponsorStatus('Logo must be under 2MB.', 'error');
        ev.target.value = '';
        return;
      }
      sponsorLogoMime = file.type || 'image/jpeg';
      sponsorLogoFilename = file.name || 'logo.jpg';
      var reader = new FileReader();
      reader.onload = function () {
        sponsorLogoBase64 = String(reader.result || '');
        document.getElementById('sponsor-logo-url').value = '';
        renderPreview();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('sponsor-publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('sponsor-publish-btn');
      var creative = readForm();
      var body = sponsorBodyFromForm(creative);
      if (creative.active && !creative.bullets.length) {
        setSponsorStatus('Add at least one bullet before publishing an active sponsor.', 'error');
        return;
      }
      if (creative.active && (!creative.ctaLabel || !creative.ctaUrl)) {
        setSponsorStatus('CTA label and link are required for an active sponsor.', 'error');
        return;
      }

      if (btn) btn.disabled = true;
      setSponsorStatus('Publishing…');

      var payload = {
        title: creative.tagline,
        body: body || '<ul class="sponsor-list"><li>Placeholder</li></ul>',
        cta_label: creative.ctaLabel,
        cta_url: creative.ctaUrl,
        company_name: creative.companyName,
        logo_url: sponsorLogoBase64 ? '' : document.getElementById('sponsor-logo-url').value.trim(),
        active: creative.active,
      };
      if (sponsorLogoBase64) {
        payload.logoBase64 = sponsorLogoBase64;
        payload.logoMime = sponsorLogoMime;
        payload.logoFilename = sponsorLogoFilename;
      }

      fetch('/api/admin/sponsor', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              throw new Error(data.message || data.error || 'Publish failed (' + r.status + ')');
            }
            return data;
          });
        })
        .then(function (data) {
          sponsorLogoBase64 = null;
          sponsorLogoMime = '';
          sponsorLogoFilename = '';
          var fileInput = document.getElementById('sponsor-logo-file');
          if (fileInput) fileInput.value = '';
          if (data.block) applySponsorBlockToForm(data.block);
          setSponsorStatus(
            creative.active
              ? 'Published — live on the Events browse page.'
              : 'Saved — site will show the “Become a sponsor” placeholder.',
            'ok'
          );
          renderPreview();
        })
        .catch(function (err) {
          setSponsorStatus(err.message || 'Could not publish Sponsor Hub.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    renderPreview();

    adminGet('/api/admin/sponsor')
      .then(function (data) {
        if (data.configured === false) {
          setSponsorStatus('Supabase is not configured — showing defaults only.', 'error');
          return;
        }
        if (data.error) {
          setSponsorStatus('Could not load Sponsor Hub: ' + data.error, 'error');
          return;
        }
        if (data.block) {
          applySponsorBlockToForm(data.block);
          setSponsorStatus('Loaded live Sponsor Hub from Supabase.');
        } else {
          setSponsorStatus('No Sponsor Hub row yet — edit below and publish.');
        }
        renderPreview();
      })
      .catch(function () {
        setSponsorStatus('Could not load Sponsor Hub.', 'error');
      });
  }

  var routes = {
    dashboard: renderDashboard,
    'event-health': renderEventHealth,
    users: renderUsers,
    moderation: renderModeration,
    financials: renderFinancials,
    sponsorship: renderSponsorship,
  };

  function route() {
    var hash = (location.hash || '#dashboard').replace('#', '');
    if (!routes[hash]) hash = 'dashboard';
    setActiveNav(hash);
    routes[hash]();
  }

  function boot(user) {
    currentUser = user;
    document.getElementById('sidebar-user').textContent = user.email;
    gate.classList.add('hidden');
    shell.classList.remove('hidden');
    document.body.classList.add('hub-page-admin');
    bindEventHealthForms();
    fetchEventHealth();
    route();
    window.addEventListener('hashchange', route);
  }

  document.querySelectorAll('[data-close-drawer]').forEach(function (el) {
    el.addEventListener('click', function () {
      document.getElementById('user-drawer').classList.add('hidden');
    });
  });

  document.getElementById('admin-signout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
      window.location.href = '../login.html';
    });
  });

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok || !data.user || data.user.role !== 'admin') {
        gate.innerHTML =
          '<div class="text-center max-w-md"><p class="text-slate-600 mb-4">Admin access required. Sign in with an admin account.</p>' +
          '<a href="../login.html?next=/admin/index.html" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Sign in</a></div>';
        return;
      }
      boot(data.user);
    })
    .catch(function () {
      document.getElementById('admin-gate-msg').textContent = 'Could not verify session.';
    });
})();
