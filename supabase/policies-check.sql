-- Quick checks after running policies.sql

set search_path = public;

-- 1) Confirm RLS is enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'users', 'teams', 'team_members', 'comments',
    'quipx_sessions', 'quipx_discuss_entries', 'quipx_reflect_items', 'quipx_reflect_responses', 'quipx_reflections', 'quipx_improve_strategies',
    'woi_templates', 'woi_template_rules', 'woi_template_moves', 'woi_template_levels', 'woi_games',
    'woi_game_slots', 'woi_game_invites', 'woi_game_viewers', 'woi_game_join_links', 'woi_roster_presets', 'woi_turns',
    'event_log', 'ai_runs'
  )
order by tablename;

-- 2) Confirm policies exist
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Confirm helper functions exist
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_app_user_id',
    'is_team_member',
    'has_filled_human_seat',
    'has_active_viewer_session',
    'can_read_game',
    'can_read_session'
  )
order by p.proname;
