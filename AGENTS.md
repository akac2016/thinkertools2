# Agent Guidelines for Thinkertools 2

This is a Next.js/Supabase app. Keep changes scoped to the existing project
shape, and do not import assumptions from other repos unless the dependency or
directory exists here.

## Verification

- For minor code changes, do not run the linter by default. Run `npm run lint`
  only when the change touches shared logic, build config, imports, types, or
  multiple files; when the edit is risky enough that lint is likely to catch a
  real issue; or when the user explicitly asks for verification.
- For docs, copy, styling-only, and trivial one-line edits, summarize the change
  and note that lint was skipped.
- Run `npm run test` or a focused equivalent when changing domain logic,
  validation, auth, API behavior, game/lobby state transitions, mission/training
  behavior, or database access.
- Never commit secrets. Environment values belong in `.env.local`, not tracked
  files.

## Project Shape

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- Backend/API: Next.js route handlers in `app/api/`.
- Database/auth: Supabase Postgres, Supabase Auth, and `@supabase/supabase-js`.
- AI: OpenAI-backed authoring and game/template routes.
- Tests: Node test runner via `npm run test`.

Directory conventions:

- Pages and layouts live in `app/`; API route handlers live in `app/api/`.
- Components live in `components/`; shared server/client logic lives in `lib/`.
- Domain tests live in `tests/`; project notes live in `docs/`.
- Supabase SQL lives in `supabase/`: `schema.sql`, `seed.sql`,
  `policies.sql`, `policies-check.sql`, and timestamped files in
  `supabase/migrations/`.
- There is no `src/` directory in this repo. Do not refer agents to `src/*`,
  `backend-v2/*`, Contentful, shadcn/ui, React Query, or other source-project
  infrastructure unless it is added here first.

## TypeScript and Next.js

- Keep strict TypeScript. Avoid `any` unless there is no practical alternative.
- Follow existing parser/validation patterns, especially `zod` for request,
  environment, and schema validation.
- Prefer Server Components. Use `"use client"` only when browser state, effects,
  event handlers, or browser-only APIs are needed.
- API route handlers should validate input, return consistent JSON/status
  errors, and keep privileged database work server-side.

## Supabase Clients and Auth

- Read server environment through `lib/env.ts`.
- Browser components should use `getSupabaseBrowserClient()` from
  `lib/supabase/browser.ts`.
- Server-only code that needs the publishable-key client can use
  `supabaseServer` from `lib/supabase/server.ts`.
- Privileged server-only operations use `supabaseAdmin` from
  `lib/supabase/admin.ts`.
- Never expose `SUPABASE_SECRET_KEY`, a service-role key, or `supabaseAdmin` to
  client-side code.
- Authenticated API requests should resolve the actor through
  `lib/auth/actor.ts`; it syncs Supabase Auth users into `public.users`.

## Database Changes

- Put schema changes in timestamped SQL migrations under `supabase/migrations/`.
- Keep `supabase/schema.sql` in sync when changing tables, columns, indexes,
  functions, triggers, RLS, grants, or other schema objects.
- Keep `supabase/policies.sql` and `supabase/policies-check.sql` aligned when
  policy changes are part of the work.
- If a change is made directly through the Supabase dashboard or SQL editor,
  mirror it in a migration and update the tracked SQL snapshots.
- Existing setup docs describe the schema as demo-first with some RLS hardening
  deferred for speed. Do not extend that shortcut for new schema work: new
  tables/functions should include explicit grants and clear RLS intent.

### New Public Tables Need Explicit Data API Grants

This app talks to Supabase through the Data API (`@supabase/supabase-js`):
`service_role` via the admin client (`lib/supabase/admin.ts`) for almost all
reads/writes, and `anon`/`authenticated` via the server/browser clients
(`lib/supabase/server.ts`, `lib/supabase/browser.ts`) for auth and a few direct
client reads.

Supabase is changing the default so a **new** table in the `public` schema is
not reachable via the Data API until an explicit `GRANT` is added. Without one,
every Data API call returns `{ "code": "42501", "message": "permission denied
for table ..." }`. This is an existing project, so the change is enforced here
on **Oct 30, 2026**. Tables created before then keep their current grants and
are unaffected — this convention is about getting **new** tables right.

#### Before Any SQL: Decide the *Intended* Access Model (Two Layers)

Grants and RLS policies follow from how the app is *meant* to use the data —
which lives in the human's head, not the code. Work through Layer A first, then
Layer B. An agent MUST ask these and wait for answers; do not infer the answer
from how the table happens to be accessed today.

##### Layer A — Intent and Data Ownership

The point of Layer A is to decide whether the current "everything flows through
the server-side `service_role` client, row-scoping done in app code" pattern is
*correct* for this table — not to take it as given. That pattern may be a
deliberate security boundary, or it may be leftover convenience: the project
README says RLS was "intentionally deferred for speed," so do not treat the
status quo as an intentional decision. Force it to be one:

1. **Who owns each row?** Global/catalog (no per-user owner), per-user,
   per-team/shared, or public-with-owner? This, not the transport, is what
   determines whether row-level rules exist at all.
2. **What's the blast radius if one user could read or write another user's rows
   here?** Progress/XP is lowish; PII, credentials, payments, private authored
   content is high. Higher blast radius → stronger case for DB-enforced rules.
3. **Should the *database* enforce that ownership (RLS), or is the only
   guarantee application code remembering to filter (`.eq("user_id", actorId)`)
   on every query?** A single missing filter in a route is a silent cross-user
   leak; RLS fails closed. Relying on app code alone is a valid choice only as a
   conscious, documented risk acceptance — not a default.
4. **Is routing all access through server-side `service_role` an intentional
   architecture or convenience?** If intentional, state the rule that preserves
   it (e.g. "no browser supabase client may query domain tables; clients only
   call our API routes"). If it can't be stated, it's convenience, and Layer A
   should probably land on real RLS.
5. **Future intent:** will a client *ever* touch this table directly — realtime
   subscriptions, edge functions running as `authenticated`, a future mobile app
   on supabase-js? If plausibly yes, design RLS now instead of retrofitting it
   under pressure later.

**Layer A output** is an explicit decision, e.g.:
- *"Per-user data, DB must enforce ownership"* → RLS **on**, per-user policies,
  even if every current read goes through `service_role`.
- *"Global catalog / server-only by deliberate rule"* → RLS **on with no
  policies** as a fail-closed backstop; `service_role` keeps working.
- *"Accept app-layer-only scoping for now"* → document it as a known risk with
  an owner, don't leave it implicit.

Default recommendation: enable RLS on every domain table regardless, because
`service_role` bypasses it (so server-only access is unaffected) while it closes
the door on accidental client access. Leaving RLS off is the choice that needs
justifying, not turning it on.

##### Layer B — Mechanics

1. **Who reads/writes this table?**
   - Only Next.js API routes (server, via the `supabaseAdmin` service_role
     client)? → service_role grant only; no client grant.
   - Also the browser/client directly (supabase-js with the publishable key,
     i.e. `anon`/`authenticated`)? → that role needs a grant **and** RLS
     policies. Triggers for "client reads directly": Supabase Realtime
     subscriptions, dropping an API route for plain CRUD, or moving identity
     onto Supabase Auth + `auth.uid()`.

2. **Is any of this data meant to be public (readable by signed-out users)?**
   - Yes (e.g. a public catalog like `trainings`/`missions`, public games) →
     `grant select ... to anon` + a permissive read policy.
   - No → never grant `anon`.

3. **For client reads, what rows should each role see?** This is the RLS policy.
   - Only the user's own rows → `using (user_id = public.current_app_user_id())`.
   - Team/shared visibility → reuse a helper like `public.is_team_member(...)`
     or `public.can_read_game(...)` (see `supabase/policies.sql`).
   - Public-or-owner → `using (is_public or creator_id = current_app_user_id())`.

4. **Which operations does the client role perform — read only, or writes too?**
   - Read only → `grant select` + a `for select` policy.
   - Writes → grant the specific verbs and add matching
     `for insert`/`update`/`delete` policies with `with check` where relevant.
   - Note: this app currently has **no** client-side write policies by design —
     writes go through service_role. Adding client writes is a deliberate change
     worth flagging.

5. **Does the table have a non-uuid sequence (serial/identity)?** Almost always
   no here (uuid PKs). If yes, the inserting client role also needs
   `grant usage, select on sequence ...`.

If Layer B says "service_role only," the table still gets `enable row level
security` (defense in depth) with no client grant and no policy. If any client
role is involved, write the scoped grant + policies from the answers above.

RLS guardrails:

- Enable RLS on every new `public` table.
- Prefer owner checks through `public.current_app_user_id()` when rows reference
  `public.users(id)`. Use `auth.uid()` only when the table is intentionally
  keyed directly to Supabase Auth users.
- Always specify the target role on a policy (`to authenticated`, `to anon`, or
  `to service_role`).
- Never use `using (true)` or `with check (true)` for insert, update, or delete
  policies. `select using (true)` is acceptable only for confirmed public or
  read-only reference data.
- For `SECURITY DEFINER` functions that act on user data, derive the acting user
  from auth context or `public.current_app_user_id()` inside the function; do
  not trust a caller-provided `user_id`.

#### Convention for Any New Table in `public`

Treat **GRANT → ENABLE RLS → POLICIES** as one unit, in the same migration that
creates the table. Use scoped grants per role — never blanket-grant every
privilege to all three roles (that recreates the old insecure default).

- `service_role` — the admin client; bypasses RLS. Almost every table needs
  `grant select, insert, update, delete ... to service_role;`. Server-only
  tables need this grant + `enable row level security` and no policy.
- `authenticated` — only if a signed-in client reads the table directly via the
  Data API; pair the grant with an RLS policy scoping rows (usually on
  `public.current_app_user_id()`).
- `anon` — only if the data is genuinely public (e.g. public games/templates);
  keep it to `grant select` and pair with a policy.
- Sequences: this app uses `uuid` PKs, so sequence grants are normally not
  needed. If a table uses a `serial`/identity column, the inserting client role
  also needs `grant usage, select on sequence ...`.

Start from `supabase/migrations/TEMPLATE_new_public_table.sql`.

### Public Functions and RPCs Need Explicit Execute Grants

The same Data API exposure model applies to `public` functions. If a migration
creates or changes a function intended to be called through `supabase.rpc()` or
PostgREST, explicitly grant `execute` on the full function signature to only the
roles that should call it:

- `grant execute on function public.<function_name>(<arg_types>) to service_role;`
- `grant execute on function public.<function_name>(<arg_types>) to authenticated;`
- Grant to `anon` only when unauthenticated callers should be able to run it.

RLS does not apply to functions. Review `SECURITY DEFINER` functions carefully
because they can bypass table-level RLS. For helper functions that are not meant
to be public RPCs, prefer a non-exposed schema when practical; if they remain in
`public`, treat execute grants as part of the access review.

### Workflow (No Supabase CLI)

1. Write the migration from the template.
2. Run it in the Supabase SQL editor.
3. Mirror the new table + its grants/RLS/policies into `supabase/schema.sql` and
   `supabase/policies.sql`, and keep `supabase/policies-check.sql` aligned.

### Code-Review Checklist

- [ ] Intended access model decided with the human (Layer A: row ownership,
      blast radius, DB-vs-app enforcement) — not inherited from how the table
      happens to be accessed today.
- [ ] RLS decision is explicit: on with policies, on as fail-closed backstop, or
      off as a documented, owned risk acceptance.
- [ ] New `public` table → migration includes scoped grants + `enable row level
      security` + policies, bundled together.
- [ ] Grants are scoped per role (no blanket grant-all to anon/authenticated/
      service_role); `anon` only when the data is genuinely public.
- [ ] Every table a client role reads has a matching RLS policy; server-only
      tables have RLS enabled with no client grant.
- [ ] `supabase/schema.sql`, `supabase/policies.sql`, and
      `supabase/policies-check.sql` updated to match.

### Do Not Touch Live Infra Without Sign-Off

Do not run the project-wide opt-in (`alter default privileges for role postgres
in schema public revoke ...`) on production. Adopt it only after new-table
migrations include grants and it's been validated on staging. Existing tables
keep their grants and need no retroactive change.

References:

- Supabase changelog:
  `https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically`
- Supabase docs: `https://supabase.com/docs/guides/api/securing-your-api`
