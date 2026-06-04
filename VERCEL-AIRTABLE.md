# Fix `configured: false` on the live site

If you see this at https://the-networker-hub.vercel.app/api/events :

```json
"envCheck": { "hasApiKey": false, "hasBaseId": false }
```

Vercel is **not** passing your secrets to the deployment yet.

## 1. Add variables (exact names)

**Vercel** → project **the-networker-hub** → **Settings** → **Environment Variables** → **Add Environment Variable**

| Key (copy exactly) | Value |
|--------------------|--------|
| `AIRTABLE_API_KEY` | `pat…` from [airtable.com/create/tokens](https://airtable.com/create/tokens) |
| `AIRTABLE_BASE_ID` | `appQwgOxCrFFNweHe` |
| `AIRTABLE_EVENTS_TABLE` | `tblOwGcn7BKt71j6b` |
| `AIRTABLE_EVENTS_VIEW` | `viwuzobg711IGzgev` |

For **each** variable, enable **Production** (and Preview if you use preview URLs).

**Do not use:** `AIRTABLE_KEY`, `API_KEY`, `BASE_ID`, or quotes around values.

## 2. Redeploy (required)

Saving variables does **not** update a deployment that is already live.

1. **Deployments** tab  
2. Latest row → **⋯** → **Redeploy**  
3. Wait for **Ready**

## 3. Confirm

Open: https://the-networker-hub.vercel.app/api/events

Success:

```json
"configured": true,
"envCheck": { "hasApiKey": true, "hasBaseId": true }
```

## Still false after redeploy?

- Confirm you’re on **pipstestingsite / the-networker-hub** (not another project).
- Open **Environment Variables** — you should see **4 rows**, not “No Environment Variables Added”.
- Edit each variable → **Production** must be checked.
- Create a **new** deployment: push any small change to GitHub, or Redeploy again without cache.

## Airtable token

1. [airtable.com/create/tokens](https://airtable.com/create/tokens)  
2. Scope: **data.records:read**  
3. Access: base `appQwgOxCrFFNweHe`  
4. Copy token once → paste into `AIRTABLE_API_KEY`
