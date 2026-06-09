(function () {
  const PENDING_KEY = 'hub_booking_pending';
  const lead = document.getElementById('booking-success-lead');
  const status = document.getElementById('booking-success-status');
  const actions = document.getElementById('booking-success-actions');

  function readPending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function showReady(message) {
    if (lead) lead.textContent = message || 'Your ticket is confirmed. Check your email for details.';
    if (status) {
      status.textContent = '';
      status.classList.remove('is-error');
    }
    if (actions) actions.hidden = false;
  }

  function showError(message) {
    if (lead) lead.textContent = 'We received your payment but could not confirm your ticket yet.';
    if (status) {
      status.textContent =
        message ||
        'Your booking should appear shortly. If it does not, contact support with your payment receipt.';
      status.classList.add('is-error');
    }
    if (actions) actions.hidden = false;
  }

  async function confirmBooking() {
    const params = new URLSearchParams(window.location.search);
    const isFree = params.get('free') === '1';
    const alreadyConfirmed = params.get('confirmed') === '1';
    const pending = readPending();
    const sessionId = params.get('session_id') || params.get('checkout_session_id');

    if (alreadyConfirmed) {
      clearPending();
      showReady('Your free ticket is confirmed. We have emailed you the details.');
      return;
    }

    if (!pending && !sessionId) {
      showReady('If you just paid, your ticket should appear in your account within a minute.');
      return;
    }

    const body = {
      eventId: pending && pending.eventId,
      ticketId: pending && pending.ticketId,
      stripeCheckoutSessionId: sessionId || null,
      paymentStatus: isFree ? 'Free' : 'Paid',
    };

    if (isFree) {
      body.amountPaid = 0;
    }

    try {
      const res = await fetch('/api/auth/complete-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      clearPending();

      if (!res.ok || !data.ok) {
        if (data.action === 'exists' || data.error === 'booking_failed') {
          showReady('Your ticket is already confirmed.');
          return;
        }
        showError((data && data.message) || (data && data.error) || 'Confirmation is still processing.');
        return;
      }

      if (data.action === 'exists') {
        showReady('Your ticket is already confirmed.');
        return;
      }

      showReady('Your ticket is confirmed. We have emailed you the details.');
    } catch (e) {
      showError('Could not reach the server. Your webhook may still complete the booking shortly.');
    }
  }

  confirmBooking();
})();
