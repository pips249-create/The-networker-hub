# Old-site reintroduction — The Networker UK

**Who:** The June 2026 import from the-networker.co.uk (`attendees.created_at` in June 2026 — about 1,300 people). `airtable_id` was not stored on those rows. People who already have a Hub login get “Open your account”; everyone else gets “Create your account now”. Later Hub signups are not in this list.  
**What:** One email introducing The Networker UK again. 6,500 events listed, more added every day. Create a free account to browse member offers, follow groups, see new events, and browse business opportunities.  
**Send via:** Resend, from the verified Networker UK address (`RESEND_FROM`). `the-networker.co.uk` is not verified on Resend, so that from-address is only used when `RESEND_FROM_LEGACY` is set. The letter still opens as the team from the-networker.co.uk.  
**Reply-to:** `catherine@thenetworkeruk.com`  
**Template:** `email-templates/legacy-site-reintroduction.html` (`legacy_site_reintroduction`)

People who already turned Hub emails off (`hub_accounts.emails_enabled = false`) are left out. Internal addresses are left out. Everyone else on the old-site import is included. Pass `--respect-legacy-opt-in` to keep only rows whose Airtable `marketing_opt_in` is true.

```bash
node scripts/send-legacy-site-reintroduction.js
node scripts/send-legacy-site-reintroduction.js --test catherine@thenetworkeruk.com
node scripts/send-legacy-site-reintroduction.js --send --limit=25
node scripts/send-legacy-site-reintroduction.js --send
```

A CSV (`email`, optional `name`) can stand in for the database list:

```bash
node scripts/send-legacy-site-reintroduction.js --csv=data/brevo-full-list.csv
```

Do not commit that CSV. Admin → Email campaigns can send the same template in batches of 50.
