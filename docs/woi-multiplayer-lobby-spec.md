# WOI Multiplayer + Lobby Spec (Draft v3)

Date: February 25, 2026  
Owner: WOI product + platform team  
Status: Draft for implementation planning

## 1) Purpose

Define an implementation-ready model for:

- slot-based player creation (`1-20` player slots for now, future-expandable),
- mixed human + AI player games (`0-4` AI player slots for now),
- explicit viewer participation (creator can be a viewer, and additional viewers can join),
- invite methods for human players,
- open lobby discovery and join-by-link,
- team reuse as a quality-of-life autofill (not the only multiplayer model).

This spec is designed to support parallel engineering tracks without contract churn.

## 2) Problem Statement

Current WOI game creation is team-centric and does not model:

- explicit player seat counts,
- distinct player vs viewer roles,
- human invite workflows (search/email/open seats),
- claimable lobby seats,
- durable join links with role-aware access.

As a result, "start a new game" UI and backend semantics are misaligned with intended multiplayer behavior.

## 3) Product Requirements

1. Step 2 is "Invite players / Add AI opponents".
2. Creator picks total player slots up to 20.
3. Creator picks AI player slots from 0 to 4.
4. Remaining player slots are human player slots and may be 0.
5. Human player slots can be filled via:
   - existing platform user search,
   - email invite,
   - open seat (joinable from lobby and/or link).
6. Creator can choose role at creation:
   - `player` (occupies a human seat), or
   - `viewer` (does not occupy any player seat).
7. Game supports viewers independent of player slots.
8. Creator can publish game with unfilled human player seats.
9. Open-seat games appear in "Find an existing game" lobby.
10. Game creator can share a join link.
11. Link holders can claim player seats while seat claims are unlocked.
12. Viewing does not require login (public/listed/link-based), but player claims require auth.
13. Future spectator chat can require authenticated users.

## 4) Scope and Non-Goals

## 4.1 In scope

- New player-seat + viewer model.
- Invite + join + lobby contracts.
- Access control updates for non-team participants.
- Realtime strategy for lobby/seat/viewer updates.

## 4.2 Out of scope for v1

- Anonymous participation as a player.
- Full social graph/friend system.
- Complex ranking/matchmaking.
- AI turn automation redesign.

## 5) Domain Model

## 5.1 Game lifecycle

Add `lobby` to `woi_games.status`:

- `lobby` -> roster still filling (open human player seats allowed).
- `in_play` -> active game.
- `reflect` -> reflection phase.
- `finished` -> concluded game, read-only.

Transitions:

1. Create game:
   - if open human player seats remain, default status = `lobby`;
   - if all player seats are already filled, creator may start immediately.
2. `lobby` -> `in_play` is manual and creator-only.
3. Creator can start only when all player seats are filled.
4. Player seat claims lock immediately when game enters `in_play`.
5. Viewer join remains allowed after `in_play` and after `finished`.
6. Existing transitions continue: `in_play` -> `reflect` -> `finished`.

## 5.2 Player seat model

Player seat constraints:

- `total_player_slots`: integer `1..20`
- `ai_player_slots`: integer `0..4`
- `human_player_slots = total_player_slots - ai_player_slots`
- `human_player_slots >= 0`

Creator role constraints:

- creator may be `player` or `viewer`.
- creator-as-viewer is valid, including games with 0 human player seats.

Seat states:

- `open`: claimable human seat, or unmaterialized AI placeholder.
- `invited`: human seat reserved for invite target but not accepted yet.
- `filled`: assigned to human user or AI profile.
- `released`: previously filled/invited seat reopened.
- `locked`: no further seat claims allowed (`in_play` onward).

Invite channels (human seats):

- `platform_search`: invite known existing user.
- `email`: invite external or existing email address.
- `open_lobby`: no direct invite; any eligible user can claim from lobby.
- `join_link`: claim via active game link token.

## 5.3 Viewer model

- Viewers do not consume player seats.
- Viewers can observe all game phases.
- Viewers cannot submit turns unless promoted into a player seat.
- Viewer access sources:
  - listed lobby game,
  - join link,
  - direct game URL when game is public,
  - explicit add by creator (future extension).

Viewer capacity policy:

- hard cap on active viewers per game in v1 for stability.
- recommended default: `500` active viewers per game.
- cap is configurable via server config (`WOI_VIEWER_CAP_PER_GAME`).

## 6) Data Model Changes (Additive-first)

## 6.1 Existing table updates

`public.woi_games`:

- add `status` check value `lobby` (in addition to existing values),
- add `total_player_slots integer not null default 2 check (total_player_slots between 1 and 20)`,
- add `ai_player_slots integer not null default 0 check (ai_player_slots between 0 and 4)`,
- add `lobby_visibility text not null default 'hidden' check (lobby_visibility in ('hidden','listed'))`,
- add `join_link_enabled boolean not null default false`,
- add `creator_role text not null default 'player' check (creator_role in ('player','viewer'))`,
- add `seat_claims_locked boolean not null default false`.

Notes:

- Keep `team_id` for compatibility and QoL grouping.
- `team_id` is no longer the only access path once seat/viewer models are introduced.

## 6.2 New tables

### `public.woi_game_slots`

- `id uuid pk`
- `game_id uuid not null references public.woi_games(id) on delete cascade`
- `slot_index integer not null check (slot_index between 1 and 20)`
- `seat_type text not null check (seat_type in ('human','ai'))`
- `state text not null check (state in ('open','invited','filled','released','locked'))`
- `assigned_user_id uuid null references public.users(id) on delete set null`
- `ai_profile jsonb null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique `(game_id, slot_index)`

Constraints:

- if `seat_type='human'`, `ai_profile` must be empty/null;
- if `seat_type='ai'`, `assigned_user_id` must be null.

### `public.woi_game_invites`

- `id uuid pk`
- `game_id uuid not null references public.woi_games(id) on delete cascade`
- `slot_id uuid not null references public.woi_game_slots(id) on delete cascade`
- `channel text not null check (channel in ('platform_search','email','join_link'))`
- `invited_user_id uuid null references public.users(id) on delete set null`
- `invited_email text null`
- `token_hash text null` (for email/link acceptance)
- `status text not null check (status in ('pending','sent','accepted','declined','expired','revoked','failed'))`
- `expires_at timestamptz null`
- `accepted_by_user_id uuid null references public.users(id) on delete set null`
- `accepted_at timestamptz null`
- `created_by uuid not null references public.users(id) on delete restrict`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(game_id, status)`
- `(slot_id, status)`
- `(invited_email)`
- `(invited_user_id, status)`

### `public.woi_game_viewers`

Purpose: track active viewer sessions for authenticated and unauthenticated viewers.

- `id uuid pk`
- `game_id uuid not null references public.woi_games(id) on delete cascade`
- `user_id uuid null references public.users(id) on delete cascade`
- `anon_session_id text null`
- `source text not null check (source in ('lobby','join_link','public_url','manual'))`
- `joined_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`
- `left_at timestamptz null`

Constraints:

- exactly one identity must be set (`user_id` xor `anon_session_id`).

Indexes:

- `(game_id, left_at, last_seen_at)`
- partial unique active auth viewer: `(game_id, user_id)` where `user_id is not null and left_at is null`
- partial unique active anon viewer: `(game_id, anon_session_id)` where `anon_session_id is not null and left_at is null`

### `public.woi_game_join_links`

- `id uuid pk`
- `game_id uuid not null references public.woi_games(id) on delete cascade`
- `token_hash text not null unique`
- `status text not null check (status in ('active','revoked','expired'))`
- `max_claims integer null check (max_claims is null or max_claims > 0)`
- `claims_count integer not null default 0`
- `expires_at timestamptz null`
- `created_by uuid not null references public.users(id) on delete restrict`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rule:

- one active link per game in v1 (enforced in service logic).

### `public.woi_roster_presets` (QoL)

- `id uuid pk`
- `owner_user_id uuid not null references public.users(id) on delete cascade`
- `team_id uuid null references public.teams(id) on delete set null`
- `name text not null`
- `source_game_id uuid null references public.woi_games(id) on delete set null`
- `slots jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## 7) Access Control and Authorization

`canActorReadGame` should return true when:

- game is public, or
- requester is creator, or
- requester is team member (legacy path), or
- requester is assigned to a human player seat, or
- requester is active viewer in `woi_game_viewers`, or
- requester has a valid link token for viewer access.

Write permissions:

- only creator (or future co-host role) can mutate roster/invites/start rules.
- player seat claim endpoints are auth-only.
- viewer join endpoint supports both auth and anon sessions.

## 8) API Contract (v1)

## 8.1 Create game with roster

`POST /api/woi/games/create-with-slots`

Request includes:

- topic/question context (step 1),
- `totalPlayerSlots`, `aiPlayerSlots`,
- `creatorRole` (`player` | `viewer`),
- human seat instructions (platform user, email, open),
- optional `presetId` (team/roster autofill),
- `lobbyVisibility`, `joinLinkEnabled`.

Response includes:

- game summary,
- normalized player seat array,
- invite summary,
- viewer summary,
- join link (if enabled),
- `status` (`lobby` or `in_play`).

## 8.2 Seat and invite management

- `PATCH /api/woi/games/{gameId}/slots/{slotId}`
- `POST /api/woi/games/{gameId}/slots/{slotId}/invite` (send/resend)
- `POST /api/woi/games/{gameId}/slots/{slotId}/release`
- `POST /api/woi/games/{gameId}/start` (manual start; validates all seats filled)

## 8.3 Invite target search

`GET /api/woi/users/search?q=...`

Rules:

- auth-only,
- minimum query length,
- rate limited,
- minimal fields.

## 8.4 Lobby and join

- `GET /api/woi/lobby/games` (listed games with open human seats)
- `POST /api/woi/games/{gameId}/claim-slot` (auth-only)
- `POST /api/woi/games/{gameId}/join-as-viewer` (auth or anon)
- `POST /api/woi/games/{gameId}/viewer-heartbeat` (updates `last_seen_at`)
- `POST /api/woi/games/{gameId}/join-by-link` (token -> claim seat or viewer session)

## 8.5 Join links and invite acceptance

- `POST /api/woi/games/{gameId}/join-link` (create/rotate/revoke)
- `GET /api/woi/games/{gameId}/join-link` (creator view)
- `POST /api/woi/invites/{inviteId}/accept`
- `POST /api/woi/invites/{inviteId}/decline`

## 9) Concurrency and Consistency

Player seat claim must be atomic.

Implement DB transaction/RPC:

- validate claimable seat + eligibility,
- reject when `seat_claims_locked=true`,
- fill seat and update invite/link counters,
- update game timestamps.

Viewer join must enforce cap:

- count active viewer sessions (`left_at is null` and recent heartbeat),
- reject new viewer joins when cap reached,
- allow idempotent rejoin for existing session/user.

## 10) Email Invites (Resend-ready)

Provider integration behind one server function:

- `sendWoiInviteEmail(inviteId)`.

Persist provider metadata in `woi_game_invites`:

- message id,
- send attempts,
- last error.

Resend behavior:

- new token issued,
- previous pending token invalidated.

## 11) Lobby and Link Behavior

## 11.1 Lobby listing

A game appears in player-join lobby when:

- `status='lobby'`,
- `lobby_visibility='listed'`,
- at least one open human player seat.

## 11.2 Link behavior

Join link may grant:

- player seat claim (if seat claims unlocked and seats available),
- viewer access (always, subject to viewer cap).

When game is `finished`:

- no new player seat claims,
- viewer/read access remains allowed.

## 12) Realtime Strategy

## 12.1 v1 baseline

- polling is acceptable for correctness.

## 12.2 v1.1 realtime upgrade

Use Supabase Realtime on:

- `woi_games` (status/open-seat/lock changes),
- `woi_game_slots` (seat assignment/state),
- `woi_game_viewers` (viewer presence),
- `woi_game_invites` (invite state).

Realtime is UX speed only; server transactions remain authoritative.

## 13) UX Model for New Game Flow

1. Step 1: define topic (manual + optional AI generation).
2. Step 2: invite players / add AI opponents:
   - choose total players (`1..20`),
   - choose AI players (`0..4`),
   - choose creator role (`player` or `viewer`),
   - configure human seats (search/email/open),
   - optional autofill from prior team/roster preset.
3. Create game -> likely `lobby` when any human seat is open.
4. Creator manually starts when all seats are filled.

## 14) Migration Plan

## 14.1 Phase 1 (additive)

- add new columns/tables,
- keep existing team-based routes untouched,
- add new create-with-slots route + UI path.

## 14.2 Phase 2 (adoption)

- update "Find existing game" with lobby seats,
- add viewer join and link flows,
- extend read guards.

## 14.3 Phase 3 (governance)

- move turn rotation source from team membership to filled player seats,
- enforce viewer non-turn behavior,
- keep team as roster autofill helper.

## 15) Parallel Workstream Plan

Track A: Data + API foundation

- migrations for seat/invite/link/viewer tables,
- atomic claim-seat RPC,
- start-lock logic,
- viewer cap enforcement.

Track B: Invite delivery

- provider integration,
- email templates,
- resend + observability.

Track C: Frontend creation + lobby UX

- step-2 seat builder,
- creator role selection,
- lobby join/claim/viewer flows,
- link management.

Track D: Auth + permission hardening

- read/write guard updates,
- token validation,
- endpoint rate limits.

## 16) Key Risks

1. Race conditions on seat claims if endpoint is not transactional.
2. ACL regressions if legacy team checks remain the only read path.
3. Invite spam/discovery abuse without throttling.
4. Viewer traffic spikes without cap + session cleanup.
5. UI state drift without server reconciliation.

## 17) Decisions (Locked)

1. Viewer cap: yes, hard cap in v1 for stability. Default `500`, configurable.
2. Last point for player seat claims: claims lock when creator manually starts game.
3. Start gating: creator can start only when all player seats are filled.
4. Viewer access auth: login not required for viewing.
5. Auto-start: no auto-start; manual creator start only.
6. AI-only games: allowed (0 human player seats is valid).

## 18) Decision Added

- Viewer cap is operational-only in v1. Do not expose the numeric limit in product UI; show a generic "room is full" message when the cap is reached.
