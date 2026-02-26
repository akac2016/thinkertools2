# WOI Multiplayer Lobby Migration Notes (Draft v3)

## Scope shipped

- `woi_games` contract expanded with lobby status + multiplayer lobby fields:
  - `status` now allows `lobby`
  - `total_player_slots`, `ai_player_slots`
  - `lobby_visibility`, `join_link_enabled`
  - `creator_role`, `seat_claims_locked`
- New tables:
  - `woi_game_slots`
  - `woi_game_invites`
  - `woi_game_viewers`
  - `woi_game_join_links`
  - `woi_roster_presets`
- New constraints/indexes include:
  - slot uniqueness and seat-type checks
  - invite status/channel checks + lookup indexes
  - viewer identity xor constraint (`user_id` xor `anon_session_id`)
  - partial unique indexes for active auth/anon viewer sessions

## Rollout order

1. Apply [schema.sql](/Users/alismac/development/thinkertools2/supabase/schema.sql).
2. Apply [policies.sql](/Users/alismac/development/thinkertools2/supabase/policies.sql).
3. Run [policies-check.sql](/Users/alismac/development/thinkertools2/supabase/policies-check.sql).

## Existing-data notes

- Existing `woi_games` rows are compatible via defaults:
  - `total_player_slots=2`
  - `ai_player_slots=0`
  - `lobby_visibility='hidden'`
  - `join_link_enabled=false`
  - `creator_role='player'`
  - `seat_claims_locked=false`
- Existing game statuses (`in_play`, `reflect`, `finished`) remain valid.

## RLS/read scaffolding notes

- Read helpers now include seat- and viewer-based access checks.
- New read policies were added for slot/viewer/invite/join-link/preset tables.
- Client-side writes remain blocked (server/service role writes only).

## Contract deviations from spec

- Link-token read access is not enforced directly in SQL RLS; token validation remains service-layer logic (as token context is not present in default RLS evaluation).
- Invite/join-link read policies are intentionally conservative:
  - invites: creator/invitee only
  - join links: creator only
  These can be widened later if product requirements require broader visibility.

## Final endpoint list (v1)

Creation and lifecycle:
- `POST /api/woi/games/create-with-slots`
- `POST /api/woi/games/{gameId}/start`

Lobby and join:
- `GET /api/woi/lobby/games`
- `POST /api/woi/games/{gameId}/claim-slot`
- `POST /api/woi/games/{gameId}/join-as-viewer`
- `POST /api/woi/games/{gameId}/viewer-heartbeat`
- `POST /api/woi/games/{gameId}/join-by-link`
- `GET /api/woi/games/{gameId}/join-link`
- `POST /api/woi/games/{gameId}/join-link`

Invites:
- `POST /api/woi/invites/{inviteId}/accept`
- `POST /api/woi/invites/{inviteId}/decline`

Supporting lookups:
- `GET /api/woi/users/search`
- `GET /api/woi/teams`
- `GET /api/woi/teams/{teamId}/members`
- `GET /api/woi/templates`
- `GET /api/woi/roster-presets`
- `POST /api/woi/roster-presets`

## Rollout notes (integration/QA pass)

1. Ship schema + policies first ([schema.sql](/Users/alismac/development/thinkertools2/supabase/schema.sql), [policies.sql](/Users/alismac/development/thinkertools2/supabase/policies.sql)).
2. Confirm `lobby` read/write flows on service-role routes (`create-with-slots`, `lobby/games`, `claim-slot`, `start`).
3. Validate viewer capacity behavior end-to-end:
   - allow idempotent rejoin for existing viewer sessions,
   - return generic `"room is full"` on cap violations.
4. Verify manual start from workspace UI:
   - creator-only action,
   - rejects when seats are not fully filled,
   - locks seat claims on transition to `in_play`.
5. Keep legacy WOI routes available during rollout (`/api/woi/games`, `/api/woi/games/quickstart`) until full adoption is complete.

## Known gaps

- Seat claim is best-effort atomic: RPC paths are attempted first and a conditional-update fallback exists; environments without claim RPCs still rely on optimistic retries.
- Join-link validation remains service-layer only (not RLS-context aware by token).
- Viewer heartbeat cleanup/expiry is heartbeat-window based; explicit session-leave endpoint is not yet implemented.
