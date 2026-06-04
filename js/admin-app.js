/**
 * The Networker — unified admin panel (SPA, hash routing).
 */
(function () {
  var MOCK = {
    metrics: {
      revenue: 48250.5,
      fees: 2140.32,
      listings: { meetings: 124, exhibitions: 38, training: 52, total: 214 },
      organisers: 89,
      providers: 34,
      attendees: 4210,
    },
    alerts: [
      { id: 1, severity: 'high', title: 'Stripe webhook timeout', detail: 'Organiser payout hook failed 3× in 10 min.' },
      { id: 2, severity: 'medium', title: 'Support queue', detail: '4 unhandled organiser tickets.' },
    ],
    activity: [
      { time: '2026-06-04T11:18:00Z', text: 'Organizer Meridian Events posted a new exhibition in Birmingham.' },
      { time: '2026-06-04T11:05:00Z', text: 'User Y registered — London, SW1A.' },
      { time: '2026-06-04T10:42:00Z', text: 'PAID: Ticket confirmed for Lunch & learn — Liverpool. Platform fee routed.' },
      { time: '2026-06-04T10:30:00Z', text: 'SUCCESS: Stripe Checkout link generated & sent via Resend.' },
      { time: '2026-06-04T10:28:00Z', text: 'Organiser approved application from User A (Industry: Tech).' },
    ],
    users: [
      { id: 'u1', name: 'Pip Hancher', email: 'pips249@gmail.com', role: 'Organiser', city: 'Liverpool', postcode: 'L1 8JQ', status: 'Active', featured: true },
      { id: 'u2', name: 'Sarah Chen', email: 'sarah@meridian.io', role: 'Organiser', city: 'Birmingham', postcode: 'B1 1AA', status: 'Active', featured: true },
      { id: 'u3', name: 'James Okonkwo', email: 'james@train.co.uk', role: 'Training Provider', city: 'London', postcode: 'EC2A 4NE', status: 'Active', featured: false },
      { id: 'u4', name: 'Alex Rivera', email: 'alex.r@email.com', role: 'Attendee', city: 'Manchester', postcode: 'M1 4BT', status: 'Active', featured: false },
      { id: 'u5', name: 'Spam Bot 22', email: 'bot@temp-mail.net', role: 'Attendee', city: '—', postcode: '—', status: 'Suspended', featured: false },
    ],
    listings: [
      { id: 'e1', title: 'Lunch & learn — Liverpool', type: 'Meeting', organiser: 'Pip Hancher', city: 'Liverpool', status: 'Live', sold: 28, capacity: 40 },
      { id: 'e2', title: 'Summer Tech Expo', type: 'Exhibition', organiser: 'Sarah Chen', city: 'Birmingham', status: 'Live', sold: 120, capacity: 200 },
      { id: 'e3', title: 'SEO Masterclass', type: 'Workshop', organiser: 'James Okonkwo', city: 'Online', status: 'Draft', sold: 0, capacity: 50 },
      { id: 'e4', title: 'Leadership Seminar', type: 'Seminar', organiser: 'James Okonkwo', city: 'London', status: 'Live', sold: 45, capacity: 60 },
    ],
    reviews: [
      { id: 'r1', user: 'Alex Rivera', event: 'Lunch & learn — Liverpool', rating: 5, text: 'Great networking, well organised.', time: '2026-06-03T14:00:00Z' },
      { id: 'r2', user: 'Unknown', event: 'Summer Tech Expo', rating: 1, text: 'Buy cheap watches!!!', time: '2026-06-04T09:00:00Z', spam: true },
    ],
    stripeAccounts: [
      { organiser: 'Meridian Events', balance: '£2,340.00', lastPayout: '2026-05-28', status: 'Connected' },
      { organiser: 'Pip Hancher', balance: '£890.50', lastPayout: '2026-05-30', status: 'Connected' },
    ],
    payoutQueue: [
      { id: 'p1', organiser: 'Train UK Ltd', amount: '£1,200.00', requested: '2026-06-04T08:00:00Z' },
    ],
    automationLog: [
      { ts: '2026-06-04T10:25:00Z', line: 'Application Submitted by User A (Industry: Technology)', status: 'info' },
      { ts: '2026-06-04T10:28:00Z', line: 'Organiser Approved User A', status: 'info' },
      { ts: '2026-06-04T10:30:00Z', line: 'SUCCESS: Stripe Checkout Link generated & sent via Resend', status: 'ok' },
      { ts: '2026-06-04T10:42:00Z', line: 'PAID: User A ticket confirmed. Platform fee routed to Admin.', status: 'ok' },
      { ts: '2026-06-04T10:55:00Z', line: 'ERROR: Resend email bounce — organiser@invalid.domain', status: 'error' },
    ],
  };

  var PAGE_META = {
    dashboard: { title: 'Overview Dashboard', subtitle: 'System-wide performance health check' },
    users: { title: 'User & Account Directory', subtitle: 'Manage all platform accounts' },
    moderation: { title: 'Content Moderation', subtitle: 'Review listings and attendee feedback' },
    financials: { title: 'Financial Hub', subtitle: 'Stripe ledger, payouts & automation logs' },
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

  function renderDashboard() {
    var m = MOCK.metrics;
    var alerts = MOCK.alerts
      .map(function (a) {
        var bg = a.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900';
        return (
          '<div class="rounded-lg border p-4 ' +
          bg +
          '"><p class="font-semibold text-sm">' +
          esc(a.title) +
          '</p><p class="text-xs mt-1 opacity-90">' +
          esc(a.detail) +
          '</p></div>'
        );
      })
      .join('');

    var activity = MOCK.activity
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
      .join('');

    main.innerHTML =
      '<div class="space-y-6">' +
      '<section class="space-y-3">' +
      '<h3 class="text-sm font-bold uppercase tracking-wide text-slate-500">Critical alerts</h3>' +
      '<div class="grid gap-3">' +
      alerts +
      '</div></section>' +
      '<section class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">' +
      card('Revenue & fees', fmtMoney(m.revenue), 'Platform fees: ' + fmtMoney(m.fees), 'emerald') +
      card('Live listings', String(m.listings.total), 'Meetings ' + m.listings.meetings + ' · Exhibitions ' + m.listings.exhibitions + ' · Training ' + m.listings.training, 'brand') +
      card('Organisers & providers', String(m.organisers), 'Active providers: ' + m.providers, 'violet') +
      card('Attendees / users', String(m.attendees), 'Registered platform users', 'blue') +
      '</section>' +
      '<section class="grid lg:grid-cols-2 gap-6">' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-4">Recent system activity</h3>' +
      '<ul class="">' +
      activity +
      '</ul></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-2">Live API metrics</h3>' +
      '<p class="text-sm text-slate-500 mb-4">Loaded from Airtable when available.</p>' +
      '<pre id="live-metrics" class="text-xs bg-slate-50 p-4 rounded-lg overflow-auto max-h-64 text-slate-600">Loading…</pre>' +
      '</div></section></div>';

    fetch('/api/admin/metrics', { credentials: 'include' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var el = document.getElementById('live-metrics');
        if (el) el.textContent = JSON.stringify(data, null, 2);
      })
      .catch(function () {
        var el = document.getElementById('live-metrics');
        if (el) el.textContent = 'Could not load live metrics.';
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
    var roleOpts = ['All', 'Organiser', 'Training Provider', 'Attendee'];
    main.innerHTML =
      '<div class="space-y-4">' +
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
      '<tbody id="users-tbody"></tbody></table></div></div>';

    function filterUsers() {
      var q = (document.getElementById('user-search').value || '').toLowerCase();
      var role = document.getElementById('user-role-filter').value;
      return MOCK.users.filter(function (u) {
        if (role !== 'All' && u.role !== role) return false;
        if (q && (u.name + u.email).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function paint() {
      var tbody = document.getElementById('users-tbody');
      tbody.innerHTML = filterUsers()
        .map(function (u) {
          var st =
            u.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800';
          return (
            '<tr class="border-t border-slate-100 hover:bg-brand-50/50 cursor-pointer user-row" data-user-id="' +
            u.id +
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
          var u = MOCK.users.find(function (x) {
            return x.id === id;
          });
          if (u) openUserDrawer(u);
        });
      });
    }

    document.getElementById('user-search').addEventListener('input', paint);
    document.getElementById('user-role-filter').addEventListener('change', paint);
    paint();
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

  function renderModeration() {
    var rows = MOCK.listings
      .map(function (l) {
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
          '<td class="px-4 py-3 min-w-[120px]"><div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:' +
          pct +
          '%"></div></div><span class="text-xs text-slate-500">' +
          l.sold +
          '/' +
          l.capacity +
          '</span></td>' +
          '<td class="px-4 py-3"><button type="button" class="text-brand-700 font-semibold text-xs hover:underline edit-listing-btn">Edit</button></td></tr>'
        );
      })
      .join('');

    var reviews = MOCK.reviews
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
          '★'.repeat(r.rating) +
          '</p></div><time class="text-xs text-slate-400">' +
          fmtTime(r.time) +
          '</time></div>' +
          '<p class="text-sm text-slate-600 mt-2">' +
          esc(r.text) +
          '</p>' +
          '<button type="button" class="mt-3 text-xs font-bold text-red-600 hover:underline">Delete / Flag as Spam</button></article>'
        );
      })
      .join('');

    main.innerHTML =
      '<div class="space-y-6">' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100 font-bold text-brand-900">All listings</div>' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tickets</th><th class="px-4 py-3"></th></tr></thead>' +
      '<tbody>' +
      rows +
      '</tbody></table></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-4">Review moderation</h3>' +
      '<div class="space-y-3">' +
      reviews +
      '</div></div></div>';
  }

  function renderFinancials() {
    var stripe = MOCK.stripeAccounts
      .map(function (s) {
        return (
          '<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium">' +
          esc(s.organiser) +
          '</td><td class="px-4 py-3">' +
          esc(s.balance) +
          '</td><td class="px-4 py-3">' +
          esc(s.lastPayout) +
          '</td><td class="px-4 py-3 text-emerald-600 font-medium">' +
          esc(s.status) +
          '</td></tr>'
        );
      })
      .join('');

    var queue = MOCK.payoutQueue
      .map(function (p) {
        return (
          '<div class="flex flex-wrap items-center justify-between gap-3 p-4 border border-slate-200 rounded-lg">' +
          '<div><p class="font-semibold">' +
          esc(p.organiser) +
          '</p><p class="text-sm text-slate-500">' +
          esc(p.amount) +
          ' · ' +
          fmtTime(p.requested) +
          '</p></div>' +
          '<button type="button" class="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700">Approve Payout</button></div>'
        );
      })
      .join('');

    var log = MOCK.automationLog
      .map(function (l) {
        var cls =
          l.status === 'error'
            ? 'text-red-600 bg-red-50'
            : l.status === 'ok'
              ? 'text-emerald-700'
              : 'text-slate-600';
        return (
          '<div class="font-mono text-xs py-2 border-b border-slate-100 ' +
          cls +
          '">' +
          '<span class="text-slate-400">[' +
          fmtTime(l.ts) +
          ']</span> — ' +
          esc(l.line) +
          (l.status === 'error'
            ? ' <button type="button" class="ml-2 font-sans font-bold text-red-700 underline">Retry workflow</button>'
            : '') +
          '</div>'
        );
      })
      .join('');

    main.innerHTML =
      '<div class="space-y-6">' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<h3 class="px-4 py-3 font-bold border-b border-slate-100">Stripe Connect ledger</h3>' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
      '<tr><th class="px-4 py-3 text-left">Organiser</th><th class="px-4 py-3">Balance</th><th class="px-4 py-3">Last payout</th><th class="px-4 py-3">Status</th></tr></thead>' +
      '<tbody>' +
      stripe +
      '</tbody></table></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-4">Manual payout requests</h3><div class="space-y-3">' +
      queue +
      '</div></section>' +
      '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
      '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-4">Automation activity log</h3>' +
      log +
      '</section></div>';
  }

  var routes = {
    dashboard: renderDashboard,
    users: renderUsers,
    moderation: renderModeration,
    financials: renderFinancials,
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
