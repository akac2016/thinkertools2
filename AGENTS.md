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

Supabase is moving new `public` tables from automatic Data API exposure to
explicit opt-in grants. The setting started becoming the default for new
projects on May 30, 2026 and is scheduled for existing projects on October 30,
2026. After that behavior applies, a new `public` table is invisible to the Data
API (PostgREST, GraphQL, and `supabase-js`) until privileges are granted, and
calls fail with `42501 permission denied for table ...`.

When a migration creates a `public` table, treat grants, RLS, and policies as
one unit:

- Grant only the privileges each role needs. Most app tables should grant DML to
  `service_role` and the narrowest necessary privileges to `authenticated`.
- Grant to `anon` only when unauthenticated users should truly access the data,
  and keep it minimal, usually `select`.
- If the table uses `serial`, identity columns, or an explicit sequence, grant
  the needed sequence privileges too.
- Do not blanket-grant all privileges to `anon`, `authenticated`, and
  `service_role`; that recreates the old default exposure model.

Use `supabase/MIGRATION_TEMPLATE.md` for a copy-paste starting point.

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

### RLS Policies: Clarify Access Before Writing SQL

This app has contextual access patterns: user profiles, teams, Quipx sessions,
WOI games, slots, invites, viewers, join links, roster presets, turns, authoring
drafts, mission progress, AI runs, and public template/library views. The right
RLS policy depends on the feature's intended sharing model, not just column
names.

Whenever you create a new `public` table, alter table access, add/change a
policy, or add a column that changes access semantics:

1. Infer the access model and state it explicitly. Example: "Rows are owned by
   `user_id`, and owner checks should use `public.current_app_user_id()`."
2. Ask the engineer only for missing policy facts that cannot be inferred:
   ownership column, read audience, write audience, team/shared-game rules,
   invite/join-link visibility, admin or service-only behavior, and whether any
   data is genuinely public to `anon`.
3. If you must proceed without answers, fail closed: enable RLS, default to
   owner-only or service-only access, and do not expose data to `anon`.

Guardrails:

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

References:

- Supabase changelog: `https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically`
- Supabase docs: `https://supabase.com/docs/guides/api/securing-your-api`
