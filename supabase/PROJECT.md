# Supabase project

| | |
|--|--|
| **Dashboard** | [Project uztgzbjrmjbonfniyqcu](https://supabase.com/dashboard/project/uztgzbjrmjbonfniyqcu) |
| **Project ref** | `uztgzbjrmjbonfniyqcu` |
| **API URL** | `https://uztgzbjrmjbonfniyqcu.supabase.co` |

## Migrations (run in order)

1. `migrations/001_initial_schema.sql` — core tables (from Claude)
2. `migrations/002_hub_platform.sql` — `hub_accounts`, organiser `listing_status`, extra RLS

**SQL Editor:** Dashboard → SQL → paste each file → Run.

## Vercel env

```env
SUPABASE_URL=https://uztgzbjrmjbonfniyqcu.supabase.co
SUPABASE_ANON_KEY=<from Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<from Settings → API — server only>
DATA_PROVIDER=supabase
```

Keep `SESSION_SECRET` until auth is fully on Supabase Auth.
