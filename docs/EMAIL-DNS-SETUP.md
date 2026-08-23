# Email authentication — SPF, DKIM, DMARC

**Domain:** `thenetworkeruk.com`  
**Sending address today:** `hello@mail.thenetworkeruk.com` (Resend)  
**Owner:** Tech (Catherine)  
**Last updated:** 5 August 2026

*Operational checklist. Confirm DNS records in the Resend dashboard before go-live.*

---

## 1. Why this matters

Without complete SPF, DKIM, and DMARC on the **exact domain in `RESEND_FROM`**, booking confirmations and nurture emails often land in Outlook Junk / Other and Gmail spam.

**Pre-launch:** Do not send bulk marketing until authentication is verified.

---

## 2. Current live DNS audit (5 Aug 2026)

Checked publicly for the platform send path:

| Check | Status | Notes |
|-------|--------|--------|
| Apex SPF (`thenetworkeruk.com`) | Microsoft only | `v=spf1 include:spf.protection.outlook.com -all` — authorises Microsoft 365 for the root inbox, **not** Resend |
| DKIM on `mail.thenetworkeruk.com` | Present | `resend._domainkey.mail` TXT in Vercel |
| SPF / return-path | Present | `send.mail` TXT (`include:amazonses.com`) + MX (`feedback-smtp.eu-west-1.amazonses.com`) |
| DMARC (`_dmarc.thenetworkeruk.com`) | Present | `v=DMARC1; p=none;` (optional: add `rua=mailto:hello@thenetworkeruk.com`) |
| Apex MX | Microsoft 365 | Correct for receiving at `hello@thenetworkeruk.com` |

**Bottom line:** Resend auth for `mail.thenetworkeruk.com` is in place (DKIM + `send.mail` SPF/MX + apex DMARC). Remaining junk/Other placement is mostly domain reputation and engagement — warm gently, ask recipients to move to Inbox, and avoid double nurture sends.

---

## 3. Resend setup (do this in order)

1. Log in to [Resend](https://resend.com) → **Domains**.
2. Open (or add) **`mail.thenetworkeruk.com`** — must match the domain in `RESEND_FROM`.
3. Copy **every** record Resend shows (typically DKIM TXT + SPF/MX on a `send` hostname). Exact values come from Resend — do not invent them.
4. Add them in **Vercel DNS** for `thenetworkeruk.com` (NS is `ns1`/`ns2.vercel-dns.com`).
5. Click **Verify** in Resend. Wait until status is **Verified** (minutes to 48h).
6. Publish DMARC if Resend did not create it (apex is enough for subdomains unless you set a separate policy):

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:hello@thenetworkeruk.com
```

7. Confirm Vercel env:
   - `RESEND_API_KEY`
   - `RESEND_FROM` = `The Networker UK <hello@mail.thenetworkeruk.com>` (or another address on the **verified** domain)
8. Redeploy. Send a test from Command Centre to Gmail **and** Outlook. Open the message → View headers → look for `spf=pass`, `dkim=pass`, `dmarc=pass`.

Optional later: verify apex `thenetworkeruk.com` in Resend too if you want From addresses like `hello@thenetworkeruk.com` without the `mail.` prefix. Do **not** merge Resend into the existing Microsoft SPF on apex without care — you need a single SPF record that includes both `spf.protection.outlook.com` and Resend’s include.

For organiser **Email 1** rebrand campaigns, also verify **`the-networker.co.uk`** and set `RESEND_FROM_LEGACY` (e.g. `Rosie @ The Networker <hello@the-networker.co.uk>`). That domain already has DMARC via Brevo; keep SPF includes aligned with whoever actually sends.

---

## 4. Records to expect from Resend

Exact hostnames/values come from the Resend Domains UI. Typically for `mail.thenetworkeruk.com`:

| Type | Host (example) | Purpose |
|------|----------------|---------|
| TXT | `resend._domainkey` | DKIM signing |
| MX + TXT | `send` (return-path) | SPF / bounce feedback for Resend |
| TXT | `_dmarc` (apex) | DMARC policy |

**DMARC starter policy (after SPF + DKIM pass):**

```
v=DMARC1; p=none; rua=mailto:hello@thenetworkeruk.com
```

Move to `p=quarantine` or `p=reject` once rua reports look clean (weeks, not days).

---

## 5. After DNS — reputation & content (Outlook Other / Junk)

Authentication is the gate. Then:

1. **Warm gently** — avoid large blast days while the domain is new. The dual signup-nudge catch-up is fixed in code so Email 1 and Email 2 no longer go out in the same cron.
2. **Ask recipients to move one message to Inbox** and add `The Networker UK` / `hello@mail.thenetworkeruk.com` as a contact (strong signal for Outlook).
3. **Reply to a test** from your own Outlook inbox — engagement helps more than subject-line tricks.
4. In Resend, open the failed/junk send → **Deliverability Insights**.
5. Keep unsubscribe visible (templates already include it; sends also set `List-Unsubscribe` + one-click `List-Unsubscribe-Post`).
6. Prefer fewer HTML-heavy marketing sends while warming; transactional booking mail usually fares better once SPF/DKIM/DMARC pass.

Register for monitoring when volume grows:

- [Google Postmaster Tools](https://postmaster.google.com/)
- [Microsoft SNDS](https://sendersupport.olc.protection.outlook.com/snds/)

---

## 6. Verification checklist

| Step | Done |
|------|:----:|
| `mail.thenetworkeruk.com` added in Resend | ☐ |
| All Resend DNS records published in Vercel DNS | ☐ |
| Resend shows domain **Verified** | ☐ |
| DMARC TXT published (`p=none` minimum) | ☐ |
| Message headers show `spf=pass` `dkim=pass` `dmarc=pass` | ☐ |
| Test to Gmail + Outlook lands in **Inbox** (not Other/Junk) | ☐ |
| `RESEND_FROM` uses the verified domain (not `onboarding@resend.dev`) | ☐ |
| `GET /api/auth/config-check` shows `emailSendingConfigured: true` | ☐ Open as admin / with `CONFIG_CHECK_SECRET` |
| Free ticket smoke | ☑ `npm run check:free-ticket` (6 Aug) |

---

## 7. Related

- `docs/COMPLIANCE-RUNBOOK.md` — Tab 10 must-have
- `AUTH-SETUP.md` / `SUPABASE-NO-EMAIL.md` — auth email vs Resend transactional
- Resend: [Why are my emails going to spam?](https://resend.com/docs/knowledge-base/why-are-my-emails-going-to-spam) · [Outlook spam guide](https://resend.com/docs/knowledge-base/how-do-i-avoid-outlooks-spam-folder)
