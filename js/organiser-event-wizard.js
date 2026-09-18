/**
 * Breadcrumb progress bar for create / edit event listing flow.
 * Location sits on step 1 (details) with the event form.
 */
(function () {
  var STEPS = [
    { id: 'details', label: 'Details & location' },
    { id: 'tickets', label: 'Set up tickets' },
    { id: 'review', label: 'Review' },
    { id: 'publish', label: 'Publish' },
  ];

  var currentStepComplete = false;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function readSeriesMeta() {
    try {
      var raw = sessionStorage.getItem('hub_event_series');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var UUID_FIND = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  function coerceEventId(value) {
    var raw = Array.isArray(value) ? String(value[0] || '').trim() : String(value || '').trim();
    if (!raw) return '';
    if (UUID_RE.test(raw)) return raw;
    try {
      var decoded = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
      if (decoded) raw = decoded;
    } catch (err) {
      /* keep raw */
    }
    if (UUID_RE.test(raw)) return raw;
    var cut = raw.search(/[?#]/);
    if (cut > 0) {
      var head = raw.slice(0, cut).trim();
      if (UUID_RE.test(head)) return head;
    }
    var match = raw.match(UUID_FIND);
    return match ? match[0] : '';
  }

  function collectContext() {
    var params = new URLSearchParams(location.search);
    var editId = coerceEventId(params.get('id') || '');
    var idsParam = params.get('ids') || '';
    var eventIds = idsParam
      ? idsParam
          .split(',')
          .map(function (s) {
            return coerceEventId(s);
          })
          .filter(Boolean)
      : [];

    if (!eventIds.length && editId) eventIds = [editId];

    var series = readSeriesMeta();
    if (!eventIds.length && series && Array.isArray(series.eventIds)) {
      eventIds = series.eventIds.map(coerceEventId).filter(Boolean);
    }

    var format = params.get('format') || '';
    if (!format) {
      try {
        format = sessionStorage.getItem('hub_event_format') || '';
      } catch {
        format = '';
      }
    }

    return {
      editId: editId,
      eventIds: eventIds,
      format: format,
      firstEventId: eventIds[0] || editId || '',
    };
  }

  function stepHref(stepId, ctx) {
    if (stepId === 'format') return '/organiser/event-format';
    if (stepId === 'details' || stepId === 'location') {
      if (ctx.editId) return '/organiser/event-edit?id=' + encodeURIComponent(ctx.editId);
      if (ctx.format) return '/organiser/event-edit?format=' + encodeURIComponent(ctx.format);
      if (ctx.firstEventId) return '/organiser/event-edit?id=' + encodeURIComponent(ctx.firstEventId);
      return '/organiser/event-edit';
    }
    if (stepId === 'tickets') {
      if (!ctx.eventIds.length) return null;
      return '/organiser/event-tickets?ids=' + encodeURIComponent(ctx.eventIds.join(','));
    }
    if (stepId === 'review') {
      if (!ctx.eventIds.length) return null;
      return '/organiser/event-review?ids=' + encodeURIComponent(ctx.eventIds.join(','));
    }
    return null;
  }

  function normalizeStepId(stepId) {
    if (stepId === 'location') return 'details';
    return stepId;
  }

  function render(currentStepId, mount) {
    if (!mount) return;
    currentStepId = normalizeStepId(currentStepId);

    var currentIndex = STEPS.findIndex(function (s) {
      return s.id === currentStepId;
    });
    if (currentIndex < 0) return;

    var ctx = collectContext();
    var stepNum = currentIndex + 1;
    var total = STEPS.length;
    var remaining = Math.max(0, total - stepNum);
    var currentLabel = STEPS[currentIndex].label;

    var remainingText =
      currentStepId === 'publish'
        ? 'Listing complete'
        : remaining === 1
          ? '1 step left'
          : remaining + ' steps left';

    var parts = [
      '<nav class="ee-wizard" aria-label="Create event progress">',
      '<p class="ee-wizard-summary">',
      '<span class="ee-wizard-step-count">Step ',
      String(stepNum),
      ' of ',
      String(total),
      '</span>',
      '<span class="ee-wizard-sep" aria-hidden="true">·</span>',
      '<span class="ee-wizard-current">',
      esc(currentLabel),
      '</span>',
      '<span class="ee-wizard-sep" aria-hidden="true">·</span>',
      '<span class="ee-wizard-remaining">',
      esc(remainingText),
      '</span>',
      '</p>',
      '<ol class="ee-wizard-steps">',
    ];

    STEPS.forEach(function (step, i) {
      var isCurrent = step.id === currentStepId;
      var isDone =
        i < currentIndex ||
        (isCurrent && currentStepComplete) ||
        (currentStepId === 'publish' && step.id === 'publish');
      var href = stepHref(step.id, ctx);
      var canLink = isDone && !isCurrent && href && step.id !== 'publish';

      var cls = 'ee-wizard-step';
      if (isCurrent) cls += ' is-current';
      if (isDone) cls += ' is-done';

      var numContent = isDone ? '✓' : String(i + 1);

      parts.push('<li class="' + cls + '"');
      if (isCurrent) parts.push(' aria-current="step"');
      parts.push('>');

      if (canLink) {
        parts.push(
          '<a class="ee-wizard-link" href="',
          esc(href),
          '"><span class="ee-wizard-num" aria-hidden="true">',
          numContent,
          '</span><span class="ee-wizard-label">',
          esc(step.label),
          '</span></a>'
        );
      } else {
        parts.push(
          '<span class="ee-wizard-link"><span class="ee-wizard-num" aria-hidden="true">',
          numContent,
          '</span><span class="ee-wizard-label">',
          esc(step.label),
          '</span></span>'
        );
      }

      parts.push('</li>');
    });

    parts.push('</ol></nav>');
    mount.innerHTML = parts.join('');
  }

  var script = document.currentScript;
  var step = script && script.getAttribute('data-step');
  var mount = document.getElementById('ee-wizard-mount');
  var params = new URLSearchParams(location.search);
  var isEmbedDrawer = params.get('embed') === '1' || window.self !== window.top;

  function setStepComplete(done) {
    currentStepComplete = Boolean(done);
    if (!isEmbedDrawer && step && mount) render(step, mount);
  }

  window.HubEventWizard = {
    setStepComplete: setStepComplete,
    coerceEventId: coerceEventId,
  };

  if (!isEmbedDrawer && step && mount) render(step, mount);
})();
