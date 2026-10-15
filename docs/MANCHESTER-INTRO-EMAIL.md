# Manchester intro email (Resend)

Same layout as the Birmingham intro — paste **`data/manchester-intro-resend-broadcast.html`** into a Resend Broadcast.

**Primary link:** [thenetworkeruk.com/networking/manchester](https://www.thenetworkeruk.com/networking/manchester)

**CSV import:** Same columns as `data/birmingham-intro-resend-import-template.csv` (use a separate segment e.g. `Manchester intro`).

## Suggested subject lines

- `Your invitation to Manchester growth — events on The Networker UK`
- `Looking to grow your business in Manchester? Check out these events`
- `Networking in Manchester — see what's on (free to browse)`

## Preheader

Matches hidden text in HTML: *Networking, workshops and trade shows in Manchester — see what's on, free on The Networker UK.*

## Checklist

1. Import contacts (dedupe on `email`; map **`company_name`** in Resend).
2. Paste **full** HTML — confirm `<!-- manchester-resend-v1 -->`.
3. Before send: `node scripts/build-city-intro-resend-events.js manchester`
4. Segment → Broadcast → test send.

See also **`docs/BIRMINGHAM-INTRO-EMAIL.md`** for Resend CSV / topic notes (same workflow).
