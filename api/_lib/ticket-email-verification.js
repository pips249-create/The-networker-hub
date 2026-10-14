/**
 * Ticket buyers must prove they own the inbox on their account.
 * Confirmation is the 6-digit code stored on hub_accounts.organiser_email_verified_at.
 * Admins and people who have already confirmed pass. Paid Stripe completions are
 * handled separately so a payment already taken can still be recorded.
 */
const { getOrganiserAccessStatus } = require('./organiser-access-guard');
const { buildEmailVerifyRedirect } = require('./organiser-email-verify-paths');

const TICKET_EMAIL_NOT_VERIFIED_MESSAGE =
  "Sorry, it seems you haven't confirmed your email. Please do so now.";

function isFreeTicketClaim(body) {
  const paymentStatusRaw = String(body?.paymentStatus || body?.payment_status || '').trim();
  return (
    paymentStatusRaw === 'Free' ||
    paymentStatusRaw === 'free' ||
    body?.amountPaid === 0 ||
    body?.amount_paid === 0
  );
}

function ticketEmailNotVerifiedBody(session, next) {
  return {
    ok: false,
    error: 'email_not_verified',
    message: TICKET_EMAIL_NOT_VERIFIED_MESSAGE,
    redirect: buildEmailVerifyRedirect({
      next: next || '/account/',
      email: session?.email || '',
    }),
  };
}

async function assertTicketBuyerEmailVerified(session, next) {
  const email = String(session?.email || '').trim();
  if (!session?.sub || !email) {
    return {
      ok: false,
      status: 401,
      body: {
        ok: false,
        error: 'not_authenticated',
        message: 'Please sign in or create a free account to complete your booking.',
      },
    };
  }
  const access = await getOrganiserAccessStatus(session);
  if (access.organiserEmailVerified) return { ok: true };
  return {
    ok: false,
    status: 403,
    body: ticketEmailNotVerifiedBody(session, next),
  };
}

module.exports = {
  isFreeTicketClaim,
  assertTicketBuyerEmailVerified,
  TICKET_EMAIL_NOT_VERIFIED_MESSAGE,
};
