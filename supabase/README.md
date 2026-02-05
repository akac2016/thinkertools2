# Supabase Setup (Hackathon)

Run these in a new Supabase project SQL Editor, in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

## Quick sanity checks

```sql
select count(*) from users;
select count(*) from teams;
select count(*) from quipx_sessions;
select count(*) from woi_templates;
select count(*) from woi_games;
select count(*) from woi_turns;
```

## Expected demo data

- 5 users
- 2 teams
- 1 seeded Quipx session with discuss/reflection data
- 3 WOI templates
- 2 WOI games (1 public, 1 private)
- Sample comments + instrumentation rows

## Notes

- This schema is demo-first and intentionally minimal.
- RLS/auth hardening is intentionally deferred for speed.
- Use server-side Supabase client/service role for writes in Next.js.
- `updated_at` fields are present; set them in app update queries for now.
