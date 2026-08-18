/**
 * Contextual (i) field tips — hover/tap popover with optional Ask Hubert link.
 */
(function (global) {
  var activeBtn = null;
  var closeOnScroll = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function getTip(id) {
    var registries = [
      global.OrganiserFieldTips,
      global.ForOrganisersFeatureTips,
      global.ForAttendeesFeatureTips,
      global.EventIntakeFieldTips,
    ];
    for (var i = 0; i < registries.length; i++) {
      if (registries[i] && registries[i][id]) return registries[i][id];
    }
    return null;
  }

  function ensurePopover() {
    var pop = document.getElementById('hub-field-tip-popover');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'hub-field-tip-popover';
    pop.className = 'hub-field-tip-popover';
    pop.hidden = true;
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);
    return pop;
  }

  function closePopover() {
    var pop = document.getElementById('hub-field-tip-popover');
    if (pop) pop.hidden = true;
    if (activeBtn) {
      activeBtn.setAttribute('aria-expanded', 'false');
      activeBtn = null;
    }
    if (closeOnScroll) {
      global.removeEventListener('scroll', closeOnScroll, true);
      closeOnScroll = null;
    }
  }

  function positionPopover(btn, pop) {
    var rect = btn.getBoundingClientRect();
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    pop.style.left = '0';
    pop.style.top = '0';
    var width = pop.offsetWidth;
    var height = pop.offsetHeight;
    var left = rect.left + rect.width / 2 - width / 2;
    var top = rect.bottom + 8;
    if (left < 12) left = 12;
    if (left + width > global.innerWidth - 12) {
      left = Math.max(12, global.innerWidth - width - 12);
    }
    if (top + height > global.innerHeight - 12) {
      top = Math.max(12, rect.top - height - 8);
    }
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.visibility = '';
  }

  function askHubert(prompt) {
    if (!prompt) return;
    closePopover();
    if (global.HubFlowTour && global.HubFlowTour.openHelp) {
      global.HubFlowTour.openHelp();
    }
    if (global.HubertOrganiserGuide && global.HubertOrganiserGuide.ask) {
      global.setTimeout(function () {
        global.HubertOrganiserGuide.ask(prompt);
      }, 80);
    }
  }

  function openPopover(btn, tip) {
    if (!tip) return;
    var pop = ensurePopover();
    if (activeBtn && activeBtn !== btn) activeBtn.setAttribute('aria-expanded', 'false');
    activeBtn = btn;
    btn.setAttribute('aria-expanded', 'true');

    var hubertLink = tip.hubertPrompt
      ? '<button type="button" class="hub-field-tip-ask" data-hub-tip-ask="' +
        esc(tip.hubertPrompt) +
        '">Ask Hubert</button>'
      : '';

    pop.innerHTML =
      '<p class="hub-field-tip-title">' +
      esc(tip.title) +
      '</p>' +
      '<p class="hub-field-tip-body">' +
      esc(tip.body) +
      '</p>' +
      hubertLink;

    var askBtn = pop.querySelector('[data-hub-tip-ask]');
    if (askBtn) {
      askBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        askHubert(askBtn.getAttribute('data-hub-tip-ask'));
      });
    }

    positionPopover(btn, pop);

    if (!closeOnScroll) {
      closeOnScroll = function () {
        closePopover();
      };
      global.addEventListener('scroll', closeOnScroll, true);
    }
  }

  function createButton(tipId, tip) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-field-tip-btn';
    btn.setAttribute('aria-label', 'More about ' + (tip.title || tipId));
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('data-hub-tip-id', tipId);
    btn.innerHTML = '<span aria-hidden="true">?</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (activeBtn === btn && !document.getElementById('hub-field-tip-popover').hidden) {
        closePopover();
        return;
      }
      openPopover(btn, tip);
    });
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    return btn;
  }

  function attach(el, tipId) {
    if (!el || el.getAttribute('data-hub-tip-bound') === '1') return;
    var tip = getTip(tipId);
    if (!tip) return;
    el.setAttribute('data-hub-tip-bound', '1');
    var btn = createButton(tipId, tip);
    if (
      el.tagName === 'H2' ||
      el.tagName === 'H3' ||
      el.classList.contains('ee-mode-btn') ||
      el.classList.contains('ee-attendance-card') ||
      el.classList.contains('ei-card') ||
      el.classList.contains('ei-label-block')
    ) {
      el.classList.add('hub-field-tip-host');
      el.appendChild(btn);
    } else {
      var wrap = document.createElement('span');
      wrap.className = 'hub-field-tip-inline';
      wrap.appendChild(btn);
      el.appendChild(wrap);
    }
  }

  function init(selector) {
    var nodes = document.querySelectorAll(selector || '[data-hub-tip]');
    nodes.forEach(function (el) {
      attach(el, el.getAttribute('data-hub-tip'));
    });
  }

  document.addEventListener('click', function (e) {
    var t = e && e.target;
    if (t && t.nodeType !== 1) t = t.parentElement;
    if (!t || typeof t.closest !== 'function') return;
    if (t.closest('.hub-field-tip-btn') || t.closest('.hub-field-tip-popover') || t.closest('[data-hub-tip-ask]')) {
      return;
    }
    closePopover();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopover();
  });

  global.HubFieldTip = {
    init: init,
    attach: attach,
    close: closePopover,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init('[data-hub-tip]');
    });
  } else {
    init('[data-hub-tip]');
  }
})(typeof window !== 'undefined' ? window : globalThis);
