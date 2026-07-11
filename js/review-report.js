/**
 * Report fake or inappropriate attendee reviews (CMA compliance).
 */
(function (global) {
  var REASONS = [
    { value: 'fake_or_paid', label: 'Fake or paid review' },
    { value: 'not_attendee', label: 'Reviewer did not attend' },
    { value: 'misleading', label: 'Misleading or inaccurate' },
    { value: 'offensive', label: 'Offensive or inappropriate' },
    { value: 'spam', label: 'Spam' },
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
    modalEl.id = 'review-report-modal';
    modalEl.className = 'listing-report-modal';
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="listing-report-backdrop" data-close-review-report></div>' +
      '<div class="listing-report-dialog" role="dialog" aria-modal="true" aria-labelledby="review-report-title">' +
      '<button type="button" class="listing-report-close" data-close-review-report aria-label="Close">×</button>' +
      '<h2 id="review-report-title" class="listing-report-title">Report this review</h2>' +
      '<p class="listing-report-lead" id="review-report-lead"></p>' +
      '<form id="review-report-form" class="listing-report-form">' +
      '<label class="listing-report-label">Reason<select name="reason" required class="listing-report-input">' +
      REASONS.map(function (r) {
        return '<option value="' + esc(r.value) + '">' + esc(r.label) + '</option>';
      }).join('') +
      '</select></label>' +
      '<label class="listing-report-label">Details <span class="listing-report-optional">(optional)</span>' +
      '<textarea name="details" rows="3" maxlength="2000" class="listing-report-input" placeholder="Why does this review seem wrong?"></textarea></label>' +
      '<p class="listing-report-msg" id="review-report-msg" hidden></p>' +
      '<div class="listing-report-actions">' +
      '<button type="button" class="listing-report-btn listing-report-btn--ghost" data-close-review-report>Cancel</button>' +
      '<button type="submit" class="listing-report-btn listing-report-btn--primary" id="review-report-submit">Send report</button>' +
      '</div></form></div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-close-review-report]')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeModal();
    });

    return modalEl;
  }

  function injectStyles() {
    if (!document.getElementById('listing-report-styles')) {
      var modalStyle = document.createElement('style');
      modalStyle.id = 'listing-report-styles';
      modalStyle.textContent =
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
        '.listing-report-btn:disabled{opacity:.6;cursor:not-allowed}';
      document.head.appendChild(modalStyle);
    }
    if (document.getElementById('review-report-extra-styles')) return;
    var style = document.createElement('style');
    style.id = 'review-report-extra-styles';
    style.textContent =
      '.review-report-btn,.org-review-report-btn{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:4px 10px;font:inherit;font-size:11px;font-weight:600;color:#7a94a3;background:#f4f8fa;border:1px solid #cfe4ea;border-radius:999px;cursor:pointer;text-decoration:none;line-height:1.2}' +
      '.review-report-btn:hover,.org-review-report-btn:hover{color:#4a6272;background:#e8f6f8;border-color:#9dd9cc}' +
      '.review-report-btn svg,.org-review-report-btn svg{width:12px;height:12px;flex-shrink:0;opacity:.8}';
    document.head.appendChild(style);
  }

  var REPORT_FLAG_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>' +
    '<line x1="4" y1="22" x2="4" y2="15"/></svg>';

  var pending = null;

  function openModal(opts) {
    injectStyles();
    if (global.ListingReport && typeof global.ListingReport.open === 'function') {
      /* Reuse listing-report modal styles when loaded together */
    }
    ensureModal();
    pending = opts || {};
    var msg = document.getElementById('review-report-msg');
    var form = document.getElementById('review-report-form');
    var lead = document.getElementById('review-report-lead');
    if (lead) {
      lead.textContent =
        'Suspect a fake or misleading review? Tell us — reports are reviewed by The Networker team.';
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
    var form = document.getElementById('review-report-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pending || !pending.reviewId) return;
      var btn = document.getElementById('review-report-submit');
      var msg = document.getElementById('review-report-msg');
      var fd = new FormData(form);
      var payload = {
        review_id: pending.reviewId,
        organiser_id: pending.organiserId || null,
        event_id: pending.eventId || null,
        review_snippet: pending.snippet || '',
        reason: String(fd.get('reason') || '').trim(),
        details: String(fd.get('details') || '').trim(),
      };

      if (btn) btn.disabled = true;
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Sending…';
        msg.className = 'listing-report-msg';
      }

      fetch('/api/auth/report-review', {
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
            msg.textContent = 'Thank you — we will review this feedback.';
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
    if (!el || !opts || !opts.reviewId) return;
    injectStyles();
    el.addEventListener('click', function () {
      bindForm();
      openModal(opts);
      var form = document.getElementById('review-report-form');
      if (form) form.hidden = false;
    });
  }

  function addReportButton(card, opts) {
    if (!card || !opts || !opts.reviewId) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'review-report-btn org-review-report-btn';
    btn.setAttribute('aria-label', 'Report review');
    btn.innerHTML = REPORT_FLAG_SVG + '<span>Report</span>';
    attachTrigger(btn, opts);
    card.appendChild(btn);
  }

  global.ReviewReport = {
    attachTrigger: attachTrigger,
    addReportButton: addReportButton,
    open: openModal,
  };

  injectStyles();
})(window);
