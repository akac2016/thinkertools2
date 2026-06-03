# Supabase Migration Template: Public Tables and Grants

Use this template when adding a new table in the `public` schema. Supabase is
moving Data API exposure for new `public` tables and functions to an explicit
grant model, so migrations should bundle grants, RLS, and policies together.

If the grants are missing, the table may exist but `supabase-js`, PostgREST, and
GraphQL calls can fail with:

```json
{ "code": "42501", "message": "permission denied for table your_table" }
```

## Table Template

```sql
begin;

-- 1. Create the table.
create table if not exists public.your_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- ...columns...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_your_table_user_id
  on public.your_table (user_id);

-- 2. Grants: explicit and scoped.
-- service_role is used by server-only privileged clients and admin flows.
grant select, insert, update, delete on table public.your_table to service_role;

-- authenticated = signed-in users; rows are still scoped by RLS below.
grant select, insert, update, delete on table public.your_table to authenticated;

-- anon = unauthenticated/public. Omit unless the data is genuinely public.
-- If needed, keep it minimal, usually:
-- grant select on table public.your_table to anon;

-- If the table uses a sequence (serial, identity, or explicit sequence), grant
-- sequence access to inserting roles as well:
-- grant usage, select on sequence public.your_table_id_seq to authenticated;

-- 3. Enable RLS.
alter table public.your_table enable row level security;

-- 4. Policies: adapt these to the confirmed access model.
drop policy if exists your_table_owner_select on public.your_table;
create policy your_table_owner_select
on public.your_table
for select
to authenticated
using (public.current_app_user_id() = user_id);

drop policy if exists your_table_owner_insert on public.your_table;
create policy your_table_owner_insert
on public.your_table
for insert
to authenticated
with check (public.current_app_user_id() = user_id);

drop policy if exists your_table_owner_update on public.your_table;
create policy your_table_owner_update
on public.your_table
for update
to authenticated
using (public.current_app_user_id() = user_id)
with check (public.current_app_user_id() = user_id);

drop policy if exists your_table_owner_delete on public.your_table;
create policy your_table_owner_delete
on public.your_table
for delete
to authenticated
using (public.current_app_user_id() = user_id);

commit;
```

## RPC / Function Grants

If a `public` function should be callable through `supabase.rpc()` or PostgREST,
grant `execute` on its full signature to only the roles that need it.

```sql
grant execute on function public.your_function(uuid) to service_role;
grant execute on function public.your_function(uuid) to authenticated;
-- grant execute on function public.your_function(uuid) to anon; -- only if public
```

RLS does not apply to functions. Review `SECURITY DEFINER` functions carefully,
and prefer deriving the acting user from `public.current_app_user_id()` or auth
context inside the function rather than accepting a trusted `user_id` parameter.

## Adapt Before Using

- Confirm who owns a row and whether ownership is `public.users(id)`,
  `auth.users(id)`, team-based, game/session-based, invite-based, or service-only.
- Confirm read and write audiences separately.
- Grant to `anon` only for genuinely public data such as intentionally public
  library/template views.
- For read-only reference/config tables, grant `select` to `authenticated`,
  full DML to `service_role`, and avoid authenticated write policies.
- For materialized views or views exposed through the Data API, add explicit
  `grant select ...` statements for the intended roles.
- After schema changes, update `supabase/schema.sql` and any relevant policy or
  verification SQL files.
