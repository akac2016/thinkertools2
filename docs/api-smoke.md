# API Smoke Checks

Smoke checks are implemented in `scripts/smoke-api.sh` and target demo-critical endpoints.

## What is checked

Required endpoints:

- `GET /api/health`
- Representative Quipx endpoints:
  - `GET /api/quipx/sessions?teamId=...&limit=1`
  - `GET /api/quipx/sessions/:sessionId`
- Representative WOI endpoints:
  - `GET /api/woi/games?teamId=...`
  - `GET /api/woi/games/:gameId`
- `GET /api/library/public-games?limit=5`
- `POST /api/ai/template` (works with OpenAI or deterministic mock fallback)

## Usage

From repository root:

```sh
sh scripts/smoke-api.sh
```

Optional overrides:

```sh
BASE_URL=http://localhost:3000 \
DEMO_USER_ID=11111111-1111-4111-8111-111111111111 \
DEMO_TEAM_ID=10000000-0000-4000-8000-000000000001 \
QUIPX_SESSION_ID=60000000-0000-4000-8000-000000000001 \
WOI_GAME_ID=50000000-0000-4000-8000-000000000001 \
sh scripts/smoke-api.sh
```

## Assumptions and adaptation notes

- Script defaults align with IDs in `supabase/seed.sql`.
- If your environment uses different seed/test data, override the `*_ID` variables.
- `x-demo-user-id` is sent for authenticated routes.
- Quipx detail accepts `200` or `404` to tolerate missing specific session IDs while still verifying route responsiveness.
- WOI detail accepts `200`, `403`, or `404` to tolerate team/visibility differences while still verifying route responsiveness.

