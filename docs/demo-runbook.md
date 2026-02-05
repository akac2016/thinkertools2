# Demo Runbook

This runbook is for reliable local demos of Thinkertools2, with a **golden path** of **Quipx first, then WOI**.

## Required environment variables

Application runtime variables (validated in `lib/env.ts`):

- `NEXT_PUBLIC_SUPABASE_URL` (required)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (required)
- `SUPABASE_SECRET_KEY` (required)
- `OPENAI_API_KEY` (optional; if unset, AI endpoints return deterministic mock output)
- `DEMO_DEFAULT_USER_ID` (optional)

Demo operator variables (used by smoke/demo scripts):

- `BASE_URL` (optional, default `http://localhost:3000`)
- `DEMO_USER_ID` (recommended; sent as `x-demo-user-id`)
- `DEMO_TEAM_ID` (recommended for team-scoped endpoints)
- `QUIPX_SESSION_ID` (recommended for session detail checks)
- `WOI_GAME_ID` (recommended for game detail checks)

Seed defaults from `supabase/seed.sql`:

- `DEMO_USER_ID=11111111-1111-4111-8111-111111111111`
- `DEMO_TEAM_ID=10000000-0000-4000-8000-000000000001`
- `QUIPX_SESSION_ID=60000000-0000-4000-8000-000000000001`
- `WOI_GAME_ID=50000000-0000-4000-8000-000000000001`

## Local startup sequence

1. Install dependencies:
   - `npm install`
2. Configure `.env.local` with the required Supabase keys (and optional OpenAI/demo defaults).
3. Ensure schema + seed are applied to your Supabase project (`supabase/schema.sql`, then `supabase/seed.sql`).
4. Start app locally:
   - `npm run dev`
5. Run API smoke checks in a second terminal:
   - `sh scripts/smoke-api.sh`
6. Run lint before demo handoff:
   - `npm run lint`

## Golden demo path (Quipx -> WOI)

1. **Preflight**
   - Confirm `/api/health` returns `200`.
   - Confirm `/api/library/public-games` returns `200`.
2. **Quipx segment (first)**
   - Open `/quipx`.
   - Show session list/new-session flow (`/api/quipx/sessions`).
   - Open seeded session details (`/api/quipx/sessions/:sessionId`) and discuss/reflect context.
3. **Transition**
   - Summarize Quipx outcome and move to systems/game exploration.
4. **WOI segment (second)**
   - Open `/woi` and list team games (`/api/woi/games?teamId=...`).
   - Open a seeded game (`/api/woi/games/:gameId`) and show template/team/turn context.
   - Finish in `/library` using public game discovery (`/api/library/public-games`).

## Fast rollback / fallback plan (single endpoint failure)

When one endpoint fails, do not keep retrying live during the demo. Switch quickly:

1. `api/health` fails
   - Stop live API demo.
   - Fall back to prepared screenshots/video and explain environment outage.
2. Quipx endpoint fails (`/api/quipx/...`)
   - Skip Quipx interaction.
   - Move directly to WOI + Library flow.
3. WOI endpoint fails (`/api/woi/...`)
   - Complete demo in Quipx + Library only.
4. `/api/ai/template` fails
   - Use a prewritten template example (or previously captured response).
   - Note: missing `OPENAI_API_KEY` should still return mock output; hard failures usually indicate broader API/DB issues.
5. `/api/library/public-games` fails
   - Use WOI private/team game detail as closing artifact instead of public library browsing.

Operator checklist for fast fallback:

- Keep one known-good `DEMO_USER_ID`, `DEMO_TEAM_ID`, `QUIPX_SESSION_ID`, and `WOI_GAME_ID` ready.
- Keep one static backup artifact per module (Quipx screenshot, WOI screenshot, AI template sample).
- Keep smoke output from the latest successful run for quick credibility proof.
