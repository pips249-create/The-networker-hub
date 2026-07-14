/**
 * Breadcrumb progress bar for create / edit event listing flow.
 */
(function () {
  var STEPS = [
    { id: 'format', label: 'Group & format' },
    { id: 'details', label: 'Event details' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'publish', label: 'Publish' },
  ];

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

  function collectContext() {
    var params = new URLSearchParams(location.search);
    var editId = params.get('id') || '';
    var idsParam = params.get('ids') || '';
    var eventIds = idsParam
      ? idsParam
          .split(',')
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean)
      : [];

    if (!eventIds.length && editId) eventIds = [editId];

    var series = readSeriesMeta();
    if (!eventIds.length && series && Array.isArray(series.eventIds)) {
      eventIds = series.eventIds.filter(Boolean);
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
    if (stepId === 'details') {
      if (ctx.editId) return '/organiser/event-edit?id=' + encodeURIComponent(ctx.editId);
      if (ctx.format) return '/organiser/event-edit?format=' + encodeURIComponent(ctx.format);
      if (ctx.firstEventId) return '/organiser/event-edit?id=' + encodeURIComponent(ctx.firstEventId);
      return '/organiser/event-edit';
    }
    if (stepId === 'tickets') {
      if (!ctx.eventIds.length) return null;
      return '/organiser/event-tickets?ids=' + encodeURIComponent(ctx.eventIds.join(','));
    }
    return null;
  }

  function render(currentStepId, mount) {
    if (!mount) return;

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
      var isDone = i < currentIndex || (currentStepId === 'publish' && step.id === 'publish');
      var href = stepHref(step.id, ctx);
      var canLink = isDone && !isCurrent && href && step.id !== 'publish';

      var cls = 'ee-wizard-step';
      if (isCurrent) cls += ' is-current';
      else if (isDone) cls += ' is-done';

      var numContent = isDone && !isCurrent ? '✓' : String(i + 1);

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
  if (!isEmbedDrawer && step && mount) render(step, mount);
})();
