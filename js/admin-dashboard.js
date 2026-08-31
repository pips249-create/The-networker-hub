(function () {
  var loading = document.getElementById('command-loading');
  var denied = document.getElementById('command-denied');
  var app = document.getElementById('command-app');
  var refreshTimer;

  function fmtMoney(n) {
    return Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function renderMetrics(m) {
    document.getElementById('m-revenue').textContent = fmtMoney(m.totalRevenue);
    document.getElementById('m-fees').textContent = fmtMoney(m.totalPlatformFees);
    document.getElementById('m-events').textContent = String(m.liveEvents);
    document.getElementById('m-organizers').textContent = String(m.totalOrganizers);
    document.getElementById('m-attendees').textContent = String(m.totalAttendees);
  }

  function renderLogs(logs) {
    var el = document.getElementById('logs-feed');
    if (!logs.length) {
      el.innerHTML = '<p class="log-feed-item">No log entries yet.</p>';
      return;
    }
    el.innerHTML = logs
      .map(function (log) {
        return (
          '<div class="log-feed-item">' +
          '<div class="log-time">' +
          fmtTime(log.time) +
          '<span class="log-type">' +
          (log.type || 'info') +
          '</span></div>' +
          '<div class="log-message">' +
          log.message +
          '</div></div>'
        );
      })
      .join('');
  }

  function renderAlerts(alerts) {
    var el = document.getElementById('alerts-feed');
    if (!alerts.length) {
      el.innerHTML = '<p class="alert-item">No active alerts.</p>';
      return;
    }
    el.innerHTML = alerts
      .map(function (a) {
        return (
          '<div class="alert-item">' +
          '<span class="alert-severity ' +
          (a.severity || 'medium') +
          '">' +
          (a.severity || 'alert') +
          '</span>' +
          '<div class="alert-title">' +
          a.title +
          '</div>' +
          '<div class="alert-detail">' +
          (a.detail || '') +
          '</div>' +
          '<div class="log-time">' +
          fmtTime(a.time) +
          '</div></div>'
        );
      })
      .join('');
  }

  function loadMetrics() {
    return fetch('/api/admin/metrics', { credentials: 'include' })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) throw result;
        renderMetrics(result.data.metrics);
        renderLogs(result.data.logs || []);
        renderAlerts(result.data.alerts || []);
      });
  }

  function showApp(user) {
    loading.hidden = true;
    denied.hidden = true;
    app.hidden = false;
    var emailEl = document.getElementById('admin-user-email');
    if (emailEl) emailEl.textContent = user.email;
    loadMetrics();
    refreshTimer = setInterval(loadMetrics, 60000);
  }

  function showDenied() {
    loading.hidden = true;
    denied.hidden = false;
    app.hidden = true;
  }

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok || !data.user || data.user.role !== 'admin') {
        showDenied();
        return;
      }
      showApp(data.user);
    })
    .catch(showDenied);

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .catch(function () {
          /* Network failures (e.g. Safari "Load failed") are fine — redirect anyway. */
        })
        .finally(function () {
          clearInterval(refreshTimer);
          window.location.href = '../login';
        });
    });
  }
})();
