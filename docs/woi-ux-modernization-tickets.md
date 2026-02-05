# WOI UX Modernization Tickets

Scope: Web of Inquiry only (`/woi`, `/library`, WOI game flow).  
Goal: move from ID-driven, multi-page admin-like flows to a modern collaborative workspace experience.

## Ticket 1: Fix Public Library Search (currently no-op)
- Priority: P0
- Why: Search input appears to work but query is not applied.
- Evidence:
  - `components/woi/client.ts` sends `query` param.
  - `app/api/library/public-games/route.ts` expects `q`.
- Problem: User types search terms and gets same results, eroding trust.
- Proposed change:
  - Align client and API query param (`q`).
  - Add visible active-query chip and clear button.
- Acceptance criteria:
  - Typing a unique term narrows results.
  - URL reflects search state.
  - Empty-state message shows searched term.

## Ticket 2: Replace Manual Team ID Input With Team Picker
- Priority: P0
- Why: Asking users for UUIDs is a developer workflow, not product UX.
- Evidence:
  - `components/woi/home-screen.tsx` requires raw `teamId` input.
- Problem: High friction and error-prone start flow.
- Proposed change:
  - Add endpoint for actor-visible teams.
  - Replace free-text field with searchable select/list.
- Acceptance criteria:
  - User can load games without copying UUIDs.
  - Last team persists and restores automatically.

## Ticket 3: Replace Template UUID Input With Template Browser
- Priority: P0
- Why: New game creation currently requires `templateId` UUID.
- Evidence:
  - `components/woi/new-game-screen.tsx` has raw `Template ID` input.
- Problem: Users cannot discover templates from creation flow.
- Proposed change:
  - Add template list API and in-form template chooser.
  - Show template metadata (category, objective, public/private).
- Acceptance criteria:
  - User can create a game by selecting template by name.
  - No UUID copy/paste required.

## Ticket 4: Replace Move/Rule UUID Inputs With Labeled Selectors
- Priority: P0
- Why: Turn submission requests `moveId` and `ruleId` as UUID strings.
- Evidence:
  - `components/woi/play-screen.tsx` uses free-text UUID fields.
- Problem: Turn form feels internal and causes invalid submissions.
- Proposed change:
  - Populate move/rule dropdowns from game template.
  - Optional quick filter by “most used” and keyboard search.
- Acceptance criteria:
  - User can submit valid turns without knowing IDs.
  - Invalid move/rule ID errors are eliminated in normal usage.

## Ticket 5: Convert WOI Multi-Page Flow Into Unified Game Workspace
- Priority: P1
- Why: Play and Reflect are split routes with repeated context loading.
- Evidence:
  - Separate pages for `/play` and `/reflect`.
- Problem: Context switching feels old and slows collaboration.
- Proposed change:
  - Create one route: `/woi/games/[gameId]` with tabs/panels:
    - Play
    - Reflect
    - Comments
    - Activity/turn history
- Acceptance criteria:
  - No full-page nav required to move between play and reflect.
  - Header context (question, status, current player) persists.

## Ticket 6: Add Real-Time/Realtime-Like Updates for Turn State and Comments
- Priority: P1
- Why: Current polling is coarse/inconsistent (15s in play, none in reflect comments).
- Evidence:
  - `components/woi/play-screen.tsx` polls every 15s.
  - `components/woi/reflect-screen.tsx` loads comments once.
- Problem: Team members miss near-live changes.
- Proposed change:
  - Use Supabase Realtime channels or short adaptive polling (2-5s when active).
  - Trigger UI toasts on new turn/comment.
- Acceptance criteria:
  - New turns/comments appear automatically without refresh.
  - Current player updates within 3s during active game.

## Ticket 7: Build a Visual “Board” View Instead of Pure List Timeline
- Priority: P1
- Why: WOI concept is level-based inquiry, but UI is mostly text cards/lists.
- Evidence:
  - `components/woi/play-screen.tsx` renders turns as list.
- Problem: Hard to understand level progression and state at a glance.
- Proposed change:
  - Add board view with level columns and latest state per level.
  - Keep list timeline as alternate view.
- Acceptance criteria:
  - User can quickly see progress by level.
  - Can switch board/list modes without data reload.

## Ticket 8: Turn Composer Upgrade (Autosave + AI Assist + Rich Preview)
- Priority: P1
- Why: Turn authoring is plain textarea; AI endpoints exist but are unused in UI.
- Evidence:
  - `app/api/ai/turn/route.ts` exists.
  - `components/woi/play-screen.tsx` does not use AI assist.
- Problem: Authoring quality and speed lag demo expectations.
- Proposed change:
  - Add “Draft with AI” and “Improve text” actions.
  - Autosave local draft per game/user.
  - Markdown/rich preview before submit.
- Acceptance criteria:
  - User can generate/refine turn text inline.
  - Draft survives navigation or accidental refresh.

## Ticket 9: Modern Game Creation Wizard (Step-Based)
- Priority: P2
- Why: Current form is flat and technical.
- Evidence:
  - `components/woi/new-game-screen.tsx`.
- Problem: New users don’t understand sequence or completion state.
- Proposed change:
  - Multi-step wizard:
    1) choose team
    2) choose template
    3) define question + description
    4) visibility + review
- Acceptance criteria:
  - Completion progress is visible.
  - Validation errors are step-local and actionable.

## Ticket 10: Improve Turn Governance UX (Current Player, Queue, and Guardrails)
- Priority: P2
- Why: Non-current users can click submit and discover failure after server rejection.
- Evidence:
  - `components/woi/play-screen.tsx` warning only; submit still enabled.
- Problem: Avoidable failed actions frustrate users.
- Proposed change:
  - Disable submit when not current player (unless creator override mode).
  - Show turn queue and “you are up next” indicator.
  - Add explicit creator “override current player” UI.
- Acceptance criteria:
  - Non-current players cannot submit by default.
  - Queue/next player is visible.

## Ticket 11: Library Discovery Upgrade (Cards + Filters + Sort)
- Priority: P2
- Why: Library is functional but basic and lacks modern discovery controls.
- Evidence:
  - `components/woi/library-screen.tsx`.
- Problem: Hard to explore by category, freshness, or activity.
- Proposed change:
  - Add filters: category, updated date range, creator/team.
  - Add sort options: most recent, most active, A-Z.
  - Add result count, pagination/infinite scroll.
- Acceptance criteria:
  - User can filter and sort with visible active filters.
  - URL state is shareable.

## Ticket 12: Stabilize Client Contracts and Remove Overly Defensive Normalization
- Priority: P2
- Why: Client mapping logic is large and permissive, indicating unstable response contracts.
- Evidence:
  - `components/woi/client.ts` extensive shape normalization/fallback parsing.
- Problem: Increases maintenance overhead and hidden UI inconsistencies.
- Proposed change:
  - Define strict API response types per endpoint.
  - Validate response shape once and fail fast with actionable error UI.
- Acceptance criteria:
  - Client parser complexity reduced significantly.
  - Endpoint contracts documented and tested.

---

## Suggested Delivery Sequence
1. P0 tickets (1-4) first: removes UUID-driven friction and fixes broken search.
2. P1 tickets (5-8): establishes modern interaction model and “wow” demo moments.
3. P2 tickets (9-12): polish, discoverability, and contract hardening.
