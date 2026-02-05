# RLS Debug Probe

This adds an isolated read-only debug surface to verify row-level security behavior before demo rehearsal.

## Files

- `app/api/debug/rls-probe/route.ts`
- `app/debug/rls/page.tsx`

## What the probe checks

For each table below, the API runs lightweight `select(..., { head: true, count: "exact" }).limit(1)` checks with:

1. anon client (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
2. service-role client (`SUPABASE_SECRET_KEY`)

Tables:

- `woi_games` (anon expected readable)
- `quipx_sessions` (anon expected denied or empty)
- `comments` (anon depends on context policy)

No write queries are used.

## How to use during demo prep

1. Start app: `npm run dev`
2. Open debug page: `http://localhost:3000/debug/rls`
3. Click **Refresh Probe** before rehearsal.
4. Review the **Expected vs Actual** matrix:
   - `woi_games` + `anon` should stay `PASS` with readable results.
   - `quipx_sessions` + `anon` should stay `PASS` when denied or empty.
   - `comments` + `anon` is context-dependent; confirm behavior matches your demo scenario.
5. If any strict row (`allow` or `deny-or-empty`) shows `FAIL`, treat as an RLS regression and investigate before the demo.

## Probe output example

```json
{
  "ok": true,
  "data": {
    "checkedAt": "2026-02-05T22:29:04.206Z",
    "latencyMs": 2222,
    "matrix": [
      {
        "table": "woi_games",
        "client": "anon",
        "expected": { "rule": "allow", "label": "Readable" },
        "actual": { "result": "rows", "rowCount": 1, "errorCode": null, "errorMessage": null },
        "pass": true
      },
      {
        "table": "woi_games",
        "client": "service-role",
        "expected": { "rule": "allow", "label": "Readable" },
        "actual": { "result": "rows", "rowCount": 2, "errorCode": null, "errorMessage": null },
        "pass": true
      },
      {
        "table": "quipx_sessions",
        "client": "anon",
        "expected": { "rule": "deny-or-empty", "label": "Denied or empty" },
        "actual": { "result": "empty", "rowCount": 0, "errorCode": null, "errorMessage": null },
        "pass": true
      },
      {
        "table": "quipx_sessions",
        "client": "service-role",
        "expected": { "rule": "allow", "label": "Readable" },
        "actual": { "result": "rows", "rowCount": 1, "errorCode": null, "errorMessage": null },
        "pass": true
      },
      {
        "table": "comments",
        "client": "anon",
        "expected": { "rule": "contextual", "label": "Context policy (verify)" },
        "actual": { "result": "rows", "rowCount": 1, "errorCode": null, "errorMessage": null },
        "pass": true,
        "note": "Rows visible with current anon context."
      },
      {
        "table": "comments",
        "client": "service-role",
        "expected": { "rule": "allow", "label": "Readable" },
        "actual": { "result": "rows", "rowCount": 2, "errorCode": null, "errorMessage": null },
        "pass": true
      }
    ]
  }
}
```
