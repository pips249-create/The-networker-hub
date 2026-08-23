# Stripe Connect — platform setup & organiser walkthrough

**Last updated:** June 2026  
**Audience:** Hub platform admin (you) and event organisers

The Networker UK uses **Stripe Connect (Express)** so organisers receive the **full ticket price** in their own connected Stripe account. The Hub keeps only the attendee **booking fee** (4.5% + 20p per ticket) at checkout.

Organisers do **not** sign up for a separate Stripe product or paste API keys. They complete a short **Connect Stripe** flow inside the organiser dashboard; Stripe hosts the bank and identity form.

---

## Part 1 — What you (platform admin) need to connect

**Yes — you need one Stripe account for The Networker UK.** That is the *platform* account. Organisers connect *to* your platform; they do not replace your account.

### One-time: Stripe Dashboard (platform account)

1. **Create or use your Hub Stripe account**  
   [dashboard.stripe.com](https://dashboard.stripe.com) — this is The Networker UK’s business account (test mode first, then live).

2. **Enable Connect**  
   - **Settings → Connect** (or [Connect settings](https://dashboard.stripe.com/settings/connect))  
   - Turn on **Connect** if prompted  
   - Account type: **Express** (matches the code — organisers get Stripe Express onboarding)  
   - Complete any **platform profile** Stripe asks for (business details, support URL, etc.)

3. **Branding (optional but recommended)**  
   - **Settings → Connect → Branding**  
   - Add Hub name, icon, and colours so organisers see “The Networker UK” during onboarding

4. **Webhook endpoint** (if not already done)  
   - **Developers → Webhooks → Add endpoint**  
   - URL: `https://<your-production-domain>/api/stripe-webhook`  
   - Events: at minimum **`checkout.session.completed`**; also **`charge.refunded`** if you want refund confirmation emails  
   - Copy the **Signing secret**

### Vercel environment variables

| Variable | Required for Connect | Notes |
|----------|----------------------|--------|
| `STRIPE_SECRET_KEY` | **Yes** | Platform secret key (`sk_test_…` or `sk_live_…`) from **your** Stripe account |
| `STRIPE_WEBHOOK_SECRET` | **Yes (production)** | From the webhook above |
| `STRIPE_CONNECT_ENABLED` | **Yes** | Set to `true` to turn on Connect checkout and organiser onboarding |
| `SITE_URL` | **Yes** | Used for return URLs after Stripe onboarding, e.g. `https://the-networker-hub.vercel.app` |

Redeploy after changing env vars.

**You do not need:**

- A separate Stripe account per organiser (Connect creates connected accounts automatically)
- Organisers to give you their Stripe secret keys
- Manual “linking” of each organiser in the Stripe Dashboard (onboarding is self-service from the Hub)

### Test vs live

| Mode | Platform key | Organiser onboarding |
|------|--------------|----------------------|
| **Test** | `sk_test_…` | Connect creates **test** connected accounts; use [Stripe test cards](https://docs.stripe.com/testing) |
| **Live** | `sk_live_…` | Real bank details and real payouts |

Use test mode end-to-end before flipping `STRIPE_CONNECT_ENABLED=true` on production with live keys.

### Quick platform checklist

- [ ] Hub Stripe account created
- [ ] Connect enabled (Express)
- [ ] Platform Connect profile complete
- [ ] Webhook endpoint live with signing secret in Vercel
- [ ] `STRIPE_SECRET_KEY` set in Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` set in Vercel
- [ ] `STRIPE_CONNECT_ENABLED=true` in Vercel
- [ ] `SITE_URL` matches production domain
- [ ] Redeployed
- [ ] One test organiser completed Connect and sold one paid ticket

---

## Part 2 — Organiser walkthrough (what to send them)

Share this section with organisers who want to sell **paid** tickets.

### When is Stripe Connect required?

| Ticket type | Connect needed? |
|-------------|-----------------|
| **Free events / £0 tickets** | No |
| **Paid tickets** | **Yes** — before you can publish a paid event |

If Connect is not finished, the Hub blocks publishing paid ticket types and shows a **Connect Stripe** prompt.

### What organisers receive

- **Full ticket price** paid by attendees → their connected Stripe balance  
- **Booking fee** (4.5% + 20p per ticket) → paid by attendees to The Networker UK at checkout (not deducted from the organiser’s ticket price)

### Step-by-step: Connect Stripe

**Before you start**

- Sign in at **Organiser dashboard** (`/organiser/`)
- Have your **group profile** set up (the group that owns the event)
- For paid events: know your **refund policy** (you choose this when publishing tickets)

**1. Open Revenue**

- In the sidebar, go to **My events → Revenue**  
  (or use **Revenue & payout** from a group’s action menu)

**2. Connect Stripe**

- If Connect is not complete, you’ll see a banner: **“Connect Stripe to sell paid tickets”**
- Click **Connect Stripe for [your group name]**
- You are sent to **Stripe’s secure onboarding page** (Stripe Express — not a separate Stripe signup)

**3. Complete Stripe’s form**

Stripe will ask for typical payout details, for example:

- Business or individual details (name, address)
- Identity verification (may vary by account type)
- **UK bank account** for payouts (sort code + account number)
- Confirmation of terms

This usually takes **5–10 minutes**. You can save and return if interrupted.

**4. Return to the Hub**

- After submitting, Stripe redirects you back to the organiser dashboard (**Revenue**)
- You should see **“Stripe account updated”** or the Connect banner disappears when setup is complete

**5. Publish paid tickets**

- Create or edit your event → **Tickets** step
- Add a paid ticket type (£ amount)
- Set your **refund policy** and confirm you understand refunds are your responsibility via your connected Stripe account
- **Publish** the event

Paid checkout is only live once Connect shows as ready for your group.

**6. When someone buys a ticket**

- The attendee pays on the event page (ticket + booking fee)
- **Ticket price** goes to **your** Stripe connected account
- You can view balances and payouts in **Stripe Express** (link from Stripe emails or dashboard access Stripe provides after onboarding)
- Sales also appear in the Hub under **Revenue**, **Attendees**, and **Tickets sold**

### Refunds (organiser responsibility)

The Hub does **not** issue refunds from the dashboard today. You handle refunds in **your Stripe dashboard**:

1. Open **Cancellations** under My events when an attendee cancels (or check **Attendees**)
2. Note the **booking reference** (e.g. `HUB-A7D2B119`) and attendee email
3. In **Stripe**, find the payment and issue a refund if your policy requires it
4. If you **cancel a whole event**, refund all paid attendees in Stripe first, then use **Confirm refunds issued** in the Hub when prompted

Attendees are told refunds are processed by the organiser through Stripe, not by the Hub.

### Troubleshooting for organisers

| Issue | What to do |
|-------|------------|
| **“Connect Stripe” banner won’t go away** | Open Revenue → click Connect again; finish any missing steps in Stripe |
| **Onboarding interrupted** | Return to Revenue → **Connect Stripe** — Stripe resumes where you left off |
| **Can’t publish paid tickets** | Connect must be complete for that group; free tickets still work without Connect |
| **Checkout says organiser hasn’t finished setup** | Group owner needs to complete Connect; contact hello@thenetworkeruk.com if it persists after connecting |
| **Where is my money?** | Stripe Express dashboard / Stripe emails — not the Hub bank account. Hub Revenue shows sales totals only |
| **How do I refund?** | Stripe dashboard → Payments → Refund. Use booking ref from Hub **Cancellations** |

### Free events only?

No Stripe setup needed. Create tickets at **£0**, publish, and attendees register without payment.

---

## Part 3 — How it works technically (for your reference)

```
Attendee pays at checkout
  → Platform Stripe account creates Checkout Session
  → Destination charge: ticket subtotal → organiser’s connected account
  → Application fee (= booking fee only) → Hub platform account
  → Webhook creates registration in Supabase
```

Key code paths:

| Area | Location |
|------|----------|
| Connect onboarding API | `POST /api/organiser/stripe-connect` |
| Express account creation | `api/_lib/stripe-connect.js` |
| Block paid publish without Connect | `assertOrganiserReadyForPaidPublish` |
| Destination charges at checkout | `buildConnectCheckoutParams` in `stripe-connect.js` |
| Dashboard UI | Revenue tab + `#stripe-connect-banner` in `organiser/index.html` |

---

## Part 4 — Email copy you can send organisers

**Subject:** Connect Stripe to sell paid tickets on The Networker UK

Hi [name],

To sell **paid** tickets on The Networker UK, you need to connect a Stripe account once per group profile. It takes about 5–10 minutes and is done entirely inside the organiser dashboard — you don’t need your own Stripe API keys.

**Steps:**

1. Sign in at [your site]/organiser/
2. Go to **My events → Revenue**
3. Click **Connect Stripe for [group name]**
4. Complete Stripe’s form (business details + UK bank account)
5. Return to the dashboard and publish your paid event

**Money:** You receive the **full ticket price**. Attendees pay a separate booking fee (4.5% + 20p per ticket) to The Networker UK at checkout.

**Refunds:** If an attendee cancels and a refund is due, you issue it from your **Stripe dashboard** using the booking reference shown in **My events → Cancellations**.

Free events do not require Stripe.

Questions? Reply to this email or contact hello@thenetworkeruk.com.

---

## Related docs

- `CHECKOUT-SETUP.md` — env vars, webhooks, checkout flow  
- `STRIPE-AND-TICKETS.md` — tickets, booking fee, webhook overview  
- `docs/REFUNDS-AND-STRIPE-CONNECT.md` — refund strategy and roadmap  
