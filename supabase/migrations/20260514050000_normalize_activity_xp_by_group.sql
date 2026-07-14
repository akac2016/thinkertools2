-- Migration: normalize_activity_xp_by_group
-- Data-only migration that sets per-question xp_reward to a uniform value
-- within each activity group, based on the group's display_order:
--   display_order 1 (Contradiction Spotting)    → 10 XP
--   display_order 2 (Rule vs. Exception)        → 25 XP
--   display_order 3 (Principle vs. Action)      → 45 XP
--   display_order 4 (Universal vs. Edge Case)   → 75 XP
--   display_order 5 (Incompatible Belief Set)   → 105 XP
--
-- No DDL — no columns added, altered, or dropped.
-- Does not touch training_activity_attempts.awarded_xp (past XP unchanged).
-- Idempotent: rows already holding their normalized value are skipped.

begin;

update public.training_activities ta
set
  xp_reward = case g.display_order
    when 1 then 10
    when 2 then 25
    when 3 then 45
    when 4 then 75
    when 5 then 105
  end,
  updated_at = now()
from public.training_activity_groups g
where ta.activity_group_id = g.id
  and g.display_order between 1 and 5
  and ta.xp_reward is distinct from (
    case g.display_order
      when 1 then 10
      when 2 then 25
      when 3 then 45
      when 4 then 75
      when 5 then 105
    end
  );

commit;
