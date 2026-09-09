/**
 * Prompt organisers to review admin-prepared ticket setup and accept terms.
 */
(function () {
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function formatDateShort(raw) {
    if (!raw) return 'Date TBC';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return 'Date TBC';
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function ticketsEditUrl(review) {
    const qs = new URLSearchParams();
    if (review && review.eventId) qs.set('ids', review.eventId);
    return '/organiser/event-tickets?' + qs.toString();
  }

  function renderReviewBody(review) {
    const parts = [];
    parts.push(
      '<p class="org-setup-review-path"><strong>Booking path:</strong> ' +
        esc(review.bookingPath || '—') +
        '</p>'
    );

    if (review.tickets && review.tickets.length) {
      parts.push('<div class="org-setup-review-block"><h3>Ticket prices</h3><ul class="org-setup-review-list">');
      review.tickets.forEach(function (t) {
        parts.push(
          '<li><span class="org-setup-review-item-name">' +
            esc(t.name) +
            '</span> <span class="org-setup-review-item-price">' +
            esc(t.priceLabel || '—') +
            '</span></li>'
        );
      });
      parts.push('</ul></div>');
    }

    if (review.membership && review.membership.length) {
      parts.push('<div class="org-setup-review-block"><h3>Membership</h3><ul class="org-setup-review-list">');
      review.membership.forEach(function (m) {
        parts.push(
          '<li><span class="org-setup-review-item-name">' +
            esc(m.label) +
            '</span> <span class="org-setup-review-item-price">' +
            esc(m.priceLabel || '—') +
            '</span></li>'
        );
      });
      parts.push('</ul></div>');
    }

    if (review.vatTreatmentLabel) {
      parts.push(
        '<p class="org-setup-review-meta"><strong>VAT:</strong> ' +
          esc(review.vatTreatmentLabel) +
          '</p>'
      );
    }

    parts.push('<div class="org-setup-review-block org-setup-review-refund">');
    parts.push('<h3>Refund policy</h3>');
    if (review.refundPolicyLabel) {
      parts.push('<p class="org-setup-review-refund-label">' + esc(review.refundPolicyLabel) + '</p>');
    }
    parts.push(
      '<p class="org-setup-review-refund-text">' + esc(review.refundPolicyText || 'No refund policy set.') + '</p>'
    );
    parts.push('</div>');

    return parts.join('');
  }

  function shouldDeferModal(state) {
    if (!state || state.adminView) return true;
    if ((state.pendingClaimGroups || []).length > 0) return true;
    if ((state.pendingClaimOpportunities || []).length > 0) return true;
    return false;
  }

  function hideModal() {
    const modal = document.getElementById('org-setup-review');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('org-group-claim-active');
  }

  function showModal(review, opts) {
    opts = opts || {};
    const modal = document.getElementById('org-setup-review');
    if (!modal || !review) return false;

    const titleEl = document.getElementById('org-setup-review-title');
    const introEl = document.getElementById('org-setup-review-intro');
    const bodyEl = document.getElementById('org-setup-review-body');
    const editBtn = document.getElementById('org-setup-review-edit');
    const acceptBtn = document.getElementById('org-setup-review-accept');
    const checkbox = document.getElementById('org-setup-review-terms');
    const errEl = document.getElementById('org-setup-review-error');
    const queueEl = document.getElementById('org-setup-review-queue');

    if (titleEl) {
      titleEl.textContent = review.title || 'Your event';
    }
    if (introEl) {
      introEl.textContent =
        "We've added an event for you — please review the information below. You can edit ticket setup first, or accept the organiser terms if everything looks right.";
    }
    if (bodyEl) bodyEl.innerHTML = renderReviewBody(review);
    if (editBtn) editBtn.href = ticketsEditUrl(review);
    if (queueEl) {
      const total = Number(opts.total) || 1;
      const index = Number(opts.index) || 1;
      queueEl.hidden = total <= 1;
      queueEl.textContent = 'Event ' + index + ' of ' + total + ' waiting for your review';
    }
    if (checkbox) checkbox.checked = false;
    if (acceptBtn) acceptBtn.disabled = true;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('org-group-claim-active');
    return true;
  }

  function bindOnce(state, apiFn) {
    const modal = document.getElementById('org-setup-review');
    if (!modal || modal.dataset.boundSetupReview) return;
    modal.dataset.boundSetupReview = '1';

    const checkbox = document.getElementById('org-setup-review-terms');
    const acceptBtn = document.getElementById('org-setup-review-accept');
    const errEl = document.getElementById('org-setup-review-error');

    if (checkbox && acceptBtn) {
      checkbox.addEventListener('change', function () {
        acceptBtn.disabled = !checkbox.checked;
      });
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', async function () {
        const list = state.pendingSetupReviews || [];
        const review = list[0];
        if (!review || !checkbox || !checkbox.checked) return;
        acceptBtn.disabled = true;
        if (errEl) errEl.hidden = true;
        try {
          const res = await apiFn('/api/organiser/setup-review', {
            method: 'POST',
            body: JSON.stringify({ eventId: review.eventId }),
          });
          if (!res || !res.ok) {
            const data = (res && res.data) || {};
            throw new Error(data.message || data.error || 'Could not save acceptance');
          }
          state.pendingSetupReviews = list.filter(function (item) {
            return item.eventId !== review.eventId;
          });
          if (window.HubOrganiserTerms && window.HubOrganiserTerms.markAcceptedLocal) {
            /* no-op if not exposed */
          }
          try {
            localStorage.setItem('hub_organiser_terms_v2', '1');
          } catch {
            /* ignore */
          }
          hideModal();
          if (state.pendingSetupReviews.length) {
            renderModal(state, apiFn);
          }
        } catch (err) {
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = err.message || 'Could not save acceptance. Try again.';
          }
          acceptBtn.disabled = !checkbox.checked;
        }
      });
    }

    modal.querySelector('.org-group-claim-backdrop')?.addEventListener('click', function () {
      /* modal is blocking — organiser must review or edit */
    });
  }

  function renderModal(state, apiFn) {
    if (shouldDeferModal(state)) {
      hideModal();
      return false;
    }
    const list = state.pendingSetupReviews || [];
    if (!list.length) {
      hideModal();
      return false;
    }
    bindOnce(state, apiFn);
    return showModal(list[0], { total: list.length, index: 1 });
  }

  window.HubOrganiserSetupReview = {
    render: renderModal,
    hide: hideModal,
    shouldDefer: shouldDeferModal,
  };
})();
