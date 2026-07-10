# Email authentication — SPF, DKIM, DMARC

**Domain:** `thenetworkerhub.com` (and any subdomain used in `RESEND_FROM`)  
**Owner:** Tech (Catherine)  
**Last updated:** 10 July 2026

*Operational checklist. Confirm DNS records in Resend dashboard before go-live.*

---

## 1. Why this matters

Without SPF, DKIM, and DMARC, booking confirmations, password resets, and lifecycle emails may land in spam — and you have weaker protection against domain spoofing.

**Pre-launch:** Do not send bulk marketing until authentication is verified.

---

## 2. Resend setup

1. Log in to [Resend](https://resend.com) → **Domains** → Add `thenetworkerhub.com` (or your sending domain).
2. Resend will show required DNS records (TXT/CNAME). Add them at your DNS host (often Cloudflare, GoDaddy, or Vercel DNS).
3. Wait for verification (usually minutes to 48 hours).
4. Set production env in Vercel:
   - `RESEND_API_KEY`
   - `RESEND_FROM` = e.g. `The Networker Hub <hello@thenetworkerhub.com>`
5. Redeploy and send a test from Command Centre or `scripts/send-test-booking-confirmation.js`.

---

## 3. Records to add (typical)

Exact values come from Resend — do not copy generic examples. Expect:

| Type | Purpose |
|------|---------|
| TXT | SPF — authorises Resend to send on your behalf |
| CNAME | DKIM — cryptographic signing for deliverability |
| TXT | DMARC — policy for failed authentication (`p=none` initially, tighten later) |

**DMARC starter policy (after SPF + DKIM pass):**

```
v=DMARC1; p=none; rua=mailto:hello@thenetworkerhub.com
```

Move to `p=quarantine` or `p=reject` once confident (post-launch).

---

## 4. Verification checklist

| Step | Done |
|------|:----:|
| Domain added in Resend | ☐ |
| SPF record published | ☐ |
| DKIM CNAME(s) published | ☐ |
| DMARC TXT published | ☐ |
| Resend shows domain **Verified** | ☐ |
| Test email to Gmail + Outlook — lands in inbox | ☐ |
| `RESEND_FROM` uses verified domain (not `onboarding@resend.dev`) | ☐ |
| `GET /api/auth/config-check` shows `emailSendingConfigured: true` | ☐ |

---

## 5. Related

- `docs/COMPLIANCE-RUNBOOK.md` — Tab 10 must-have
- `AUTH-SETUP.md` / `SUPABASE-NO-EMAIL.md` — auth email vs Resend transactional
