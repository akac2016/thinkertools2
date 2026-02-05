# Build Plan (Demo-First Next.js App Router)

## Goal

Ship a **workable, impressive hackathon demo** that recreates the strongest legacy behaviors and showcases OpenAI/Codex capabilities:

- Team collaboration workflow (Quipx session lifecycle)
- Turn-based inquiry gameplay (WOI)
- Public/private knowledge sharing
- AI-assisted generation and summarization moments during the demo

## Demo scope (must-have)

1. **Quipx core path**: create session -> discuss -> reflect -> improve -> review.
2. **WOI core path**: create game (from template or quick AI-generated template) -> play turns -> reflect/publish.
3. **Public discovery**: simple searchable list/grid of public games.
4. **Comments**: lightweight comments on session/game review pages.
5. **AI moments for demo impact**:
   - “Generate template from question” (rules/moves/levels draft).
   - “Suggest next move + rewrite turn text.”
   - “Summarize team outcomes for final review/publish text.”

## Minimal App Router architecture

### App structure

```txt
app/
  page.tsx                        # Demo landing
  quipx/
    page.tsx                      # Session list
    sessions/new/page.tsx
    sessions/[sessionId]/discuss/page.tsx
    sessions/[sessionId]/reflect/page.tsx
    sessions/[sessionId]/improve/page.tsx
    sessions/[sessionId]/review/page.tsx
  woi/
    page.tsx                      # Game list / launch
    games/new/page.tsx
    games/[gameId]/play/page.tsx
    games/[gameId]/reflect/page.tsx
  library/page.tsx                # Public games/templates
  api/
    quipx/...                     # CRUD endpoints or server-action wrappers
    woi/...
    comments/...
    ai/template/route.ts
    ai/turn/route.ts
    ai/summary/route.ts

lib/
  db.ts
  demo-auth.ts
  quipx/
  woi/
  ai/
components/
  shared/
  quipx/
  woi/
```

### Runtime choices (minimal)

- **Next.js App Router** with server components + server actions where practical.
- **Postgres** (Neon/Supabase) + **Prisma** (or Drizzle) for speed.
- **Polling** for “live” updates (discussion/comments/turn indicator) to match legacy behavior quickly.
- **Demo auth mode**: simple identity switcher/seeded users (full auth deferred).

## Minimal DB tables for the demo

### Shared
- `users(id, name, email_nullable, color, created_at)`
- `teams(id, name, created_at)`
- `team_members(id, team_id, user_id, role, created_at)`
- `comments(id, context_type, context_id, author_id, body, created_at)`
  - `context_type`: `quipx_session` | `woi_game`

### Quipx
- `quipx_sessions(id, team_id, creator_id, subject, objectives, starts_at_nullable, duration_min_nullable, created_at)`
- `quipx_discuss_entries(id, session_id, author_id, body_html, created_at)`
- `quipx_reflect_items(id, label, short_text, long_text, order_index)` (seed)
- `quipx_reflect_responses(id, reflect_item_id, score, text)` (seed)
- `quipx_reflections(id, session_id, reflect_item_id, user_id, score, justification, created_at, updated_at)`
- `quipx_improve_strategies(id, reflect_response_id, strategy_text)` (seed)

### WOI
- `woi_templates(id, creator_id, name, objective, category_nullable, is_public, created_at, updated_at)`
- `woi_template_rules(id, template_id, order_index, rule_text)`
- `woi_template_moves(id, template_id, order_index, move_text)`
- `woi_template_levels(id, template_id, order_index, level_name, level_objective)`
- `woi_games(id, template_id, team_id, creator_id, question, description, is_public, current_player_id, created_at, updated_at)`
- `woi_turns(id, game_id, level_index_nullable, player_id, move_id_nullable, rule_id_nullable, content_html, created_at)`

### Key indexes
- `team_members(team_id, user_id)` unique
- `quipx_reflections(session_id, reflect_item_id, user_id)` unique
- `woi_turns(game_id, created_at desc)`
- `comments(context_type, context_id, created_at desc)`
- `woi_games(is_public, updated_at desc)`

## API surface (minimal contract)

- `POST /api/quipx/sessions`
- `POST /api/quipx/sessions/:id/discuss`
- `POST /api/quipx/sessions/:id/reflect`
- `GET /api/quipx/sessions/:id/improve`
- `GET /api/quipx/sessions/:id/review`

- `POST /api/woi/games`
- `POST /api/woi/games/:id/turns`
- `POST /api/woi/games/:id/current-player` (creator override)
- `GET /api/woi/games/:id`
- `GET /api/library/public-games?query=...`

- `POST /api/comments`
- `GET /api/comments?contextType=...&contextId=...`

- `POST /api/ai/template` (question -> objective/rules/moves/levels draft)
- `POST /api/ai/turn` (existing board text + selected move/rule -> suggested turn text)
- `POST /api/ai/summary` (discussion/turn history -> concise review summary)

## 4 parallel workstreams

## 1. `db` workstream

Deliverables:
- Schema + migrations for tables above.
- Seed scripts for:
  - users/teams/team_members demo data
  - reflect items/responses/strategies
  - 2-3 starter WOI templates
- Query helpers for core reads/writes.

Definition of done:
- Fresh DB + seed -> usable demo dataset in one command.
- All primary flows can read/write without manual SQL.

## 2. `api` workstream

Deliverables:
- Route handlers/server actions for session/game/comment flows.
- Turn sequencing logic (`current_player_id` rotation).
- Reflection aggregation logic for improve/review views.
- AI endpoints wrapping OpenAI calls with strict JSON outputs.

Definition of done:
- Postman/curl smoke tests for each endpoint.
- Deterministic error shape and status codes.

## 3. `ui` workstream

Deliverables:
- Fast, clean demo UI for Quipx and WOI paths.
- Reusable components:
  - session/game headers
  - phase navigation
  - live feed panels (polling)
  - turn form and reflection form
  - summary cards (strength/weakness/improve)
- AI affordances:
  - “Draft with AI”
  - “Improve text”
  - “Summarize now”

Definition of done:
- End-to-end happy paths complete without dev tools.
- Works on desktop + mobile breakpoints.

## 4. `deploy` workstream

Deliverables:
- Vercel project setup.
- Managed Postgres setup + migration pipeline.
- Environment variables for DB and OpenAI key.
- Preview/staging deployment URL for judges.

Definition of done:
- One-click deploy from main branch.
- Seeded demo environment reproducible before presentation.

## Suggested execution order (while staying parallel)

1. `db` defines schema/contracts first (half day).
2. `api` and `ui` start in parallel against agreed contracts + mock data.
3. `deploy` starts immediately with scaffold and env wiring.
4. Integrate AI endpoints once core CRUD flow is stable.

## Explicitly deferred (post-hackathon)

- Full auth system (OAuth/password reset/email verification)
- Hardened authorization and RBAC auditing
- CSRF/rate limiting/abuse prevention
- Advanced sanitization and content moderation
- Comprehensive automated test suite
- Observability stack (structured logs, tracing, alerting)
- Realtime sockets/collaboration conflict handling
- Rich search ranking + full-text indexes tuning
- Accessibility and UX polish beyond demo-critical paths
- Background jobs/notifications/webhooks

## Hackathon demo script (recommended)

1. Start from landing, pick a seeded user/team.
2. Create a Quipx session, generate/refine discussion text with AI.
3. Complete reflect/improve/review and show auto summary.
4. Create WOI game from an AI-generated template from a fresh question.
5. Play 2-3 turns across levels, show suggested next move text.
6. Publish final results and show discoverability in library/search.

