/**
 * Report misleading or inappropriate event / organiser / opportunity listings.
 */
(function (global) {
  var REASONS = [
    { value: 'misleading', label: 'Misleading or inaccurate' },
    { value: 'spam', label: 'Spam or scam' },
    { value: 'wrong_details', label: 'Wrong date, location, or price' },
    { value: 'offensive', label: 'Offensive or inappropriate' },
    { value: 'duplicate', label: 'Duplicate listing' },
    { value: 'other', label: 'Other' },
  ];

  var modalEl = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'listing-report-modal';
    modalEl.className = 'listing-report-modal';
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="listing-report-backdrop" data-close-report></div>' +
      '<div class="listing-report-dialog" role="dialog" aria-modal="true" aria-labelledby="listing-report-title">' +
      '<button type="button" class="listing-report-close" data-close-report aria-label="Close">×</button>' +
      '<h2 id="listing-report-title" class="listing-report-title">Report this listing</h2>' +
      '<p class="listing-report-lead" id="listing-report-lead"></p>' +
      '<form id="listing-report-form" class="listing-report-form">' +
      '<label class="listing-report-label">Reason<select name="reason" required class="listing-report-input">' +
      REASONS.map(function (r) {
        return '<option value="' + esc(r.value) + '">' + esc(r.label) + '</option>';
      }).join('') +
      '</select></label>' +
      '<label class="listing-report-label">Details <span class="listing-report-optional">(optional)</span>' +
      '<textarea name="details" rows="3" maxlength="2000" class="listing-report-input" placeholder="Tell us what seems wrong…"></textarea></label>' +
      '<p class="listing-report-msg" id="listing-report-msg" hidden></p>' +
      '<div class="listing-report-actions">' +
      '<button type="button" class="listing-report-btn listing-report-btn--ghost" data-close-report>Cancel</button>' +
      '<button type="submit" class="listing-report-btn listing-report-btn--primary" id="listing-report-submit">Send report</button>' +
      '</div></form></div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-report]')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
    });

    return modalEl;
  }

  function injectStyles() {
    if (document.getElementById('listing-report-styles')) return;
    var style = document.createElement('style');
    style.id = 'listing-report-styles';
    style.textContent =
      '.listing-report-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.listing-report-modal[hidden]{display:none!important}' +
      '.listing-report-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.45)}' +
      '.listing-report-dialog{position:relative;z-index:1;width:min(100%,420px);background:#fff;border-radius:14px;padding:20px;box-shadow:0 20px 50px rgba(15,23,42,.2)}' +
      '.listing-report-close{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:22px;line-height:1;color:#64748b;cursor:pointer}' +
      '.listing-report-title{margin:0 0 6px;font-size:18px;font-weight:700;color:#2d1b4e}' +
      '.listing-report-lead{margin:0 0 14px;font-size:14px;color:#64748b}' +
      '.listing-report-form{display:flex;flex-direction:column;gap:12px}' +
      '.listing-report-label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#475569}' +
      '.listing-report-optional{font-weight:400;color:#94a3b8}' +
      '.listing-report-input{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;font-size:14px}' +
      '.listing-report-msg{font-size:13px;margin:0}' +
      '.listing-report-msg.is-error{color:#b91c1c}.listing-report-msg.is-success{color:#047857}' +
      '.listing-report-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}' +
      '.listing-report-btn{border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent}' +
      '.listing-report-btn--ghost{background:#fff;border-color:#cbd5e1;color:#334155}' +
      '.listing-report-btn--primary{background:#5b2f99;color:#fff}' +
      '.listing-report-btn:disabled{opacity:.6;cursor:not-allowed}' +
      '.listing-report-trigger{font:inherit;font-size:13px;color:#64748b;background:transparent;border:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0}' +
      '.listing-report-trigger:hover{color:#5b2f99}';
    document.head.appendChild(style);
  }

  var pending = null;

  function openModal(opts) {
    injectStyles();
    ensureModal();
    pending = opts || {};
    var lead = document.getElementById('listing-report-lead');
    var msg = document.getElementById('listing-report-msg');
    var form = document.getElementById('listing-report-form');
    if (lead) {
      lead.textContent =
        'Reports are reviewed by The Networker team. Abuse of reporting may result in account action.';
    }
    if (msg) {
      msg.hidden = true;
      msg.textContent = '';
      msg.className = 'listing-report-msg';
    }
    if (form) form.reset();
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
    pending = null;
  }

  function bindForm() {
    ensureModal();
    var form = document.getElementById('listing-report-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pending) return;
      var btn = document.getElementById('listing-report-submit');
      var msg = document.getElementById('listing-report-msg');
      var fd = new FormData(form);
      var payload = {
        listing_type: pending.listingType,
        listing_title: pending.title || '',
        reason: String(fd.get('reason') || '').trim(),
        details: String(fd.get('details') || '').trim(),
      };
      if (pending.listingType === 'event') payload.event_id = pending.eventId;
      if (pending.listingType === 'organiser') payload.organiser_id = pending.organiserId;
      if (pending.listingType === 'opportunity') payload.opportunity_id = pending.opportunityId;

      if (btn) btn.disabled = true;
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Sending…';
        msg.className = 'listing-report-msg';
      }

      fetch('/api/auth/report-listing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (body) {
            if (!r.ok || body.ok === false) {
              throw new Error(body.message || body.error || 'Could not send report');
            }
            return body;
          });
        })
        .then(function () {
          if (msg) {
            msg.textContent = 'Thank you — we will review this listing.';
            msg.className = 'listing-report-msg is-success';
          }
          if (form) form.hidden = true;
          setTimeout(closeModal, 2200);
        })
        .catch(function (err) {
          if (msg) {
            msg.textContent = err.message || 'Could not send report. Try again.';
            msg.className = 'listing-report-msg is-error';
          }
          if (btn) btn.disabled = false;
        });
    });
  }

  function attachTrigger(el, opts) {
    if (!el) return;
    el.addEventListener('click', function () {
      bindForm();
      openModal(opts);
      var form = document.getElementById('listing-report-form');
      if (form) form.hidden = false;
    });
  }

  global.ListingReport = {
    attachTrigger: attachTrigger,
    open: openModal,
  };

  injectStyles();
})(window);
