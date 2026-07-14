# Publication Status Implementation Summary

## What Changed

Replaced `is_active` boolean with `publication_status` enum on all content tables to enable a staged publishing workflow.

### Database Changes

**Tables updated:**
- `trainings`
- `training_activity_groups`  
- `training_activities`
- `missions`

**New column:**
```sql
publication_status text not null default 'pending'
  check (publication_status in ('pending', 'live', 'archived'))
```

**Status meanings:**
- `'pending'` — Content submitted by educator, waiting for approval/release
- `'live'` — Visible to players
- `'archived'` — Was live, now retired/disabled

### Code Changes

**Type definitions updated:**
- `/lib/quests/domain-types.ts` — Updated `TrainingRow`, `TrainingActivityRow`, `MissionRow`
- `/lib/quests/activity-groups-query.ts` — Updated `RawActivityGroupRow`
- `/lib/quests/missions-query.ts` — Updated `RawMissionRow`
- `/lib/quests/trainings-query.ts` — Updated `RawTrainingRow`

**Player-facing routes (now filter by `publication_status = 'live'`):**
- `/app/api/thinkertools-missions/trainings/route.ts`
- `/app/api/thinkertools-missions/missions/route.ts`
- `/app/api/thinkertools-missions/missions/[missionSlug]/route.ts`
- `/app/api/thinkertools-missions/trainings/[trainingSlug]/groups/route.ts`
- `/app/api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/route.ts`
- `/app/api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit/route.ts`
- `/lib/quests/server-progress.ts`
- `/lib/missions/server.ts`

**Creator-facing routes (now insert with `publication_status = 'pending'`):**
- `/app/api/thinkertools-missions-create/trainings/route.ts` (POST)
- `/app/api/thinkertools-missions-create/activity-groups/route.ts` (POST)
- `/app/api/thinkertools-missions-create/drafts/[draftId]/publish/route.ts` (POST)

**New endpoint:**
- `/app/api/thinkertools-missions-create/drafts/[draftId]/release/route.ts` (POST)
  - Flips content from `'pending'` → `'live'`
  - Requires draft status = `'published'` with valid `published_ref_id`
  - Idempotent (returns success if already live)
  - Rejects archived content

## Migration File

`/supabase/migrations/20260612000000_add_publication_status.sql`

**What it does:**
1. Adds `publication_status` column to 4 tables
2. Backfills existing rows: `is_active = true` → `'live'`, `is_active = false` → `'archived'`
3. Drops `is_active` column
4. Adds comments explaining the lifecycle

## How to Apply

1. **Run the migration in Supabase SQL editor:**
   ```bash
   # Copy contents of supabase/migrations/20260612000000_add_publication_status.sql
   # Paste into Supabase SQL editor and run
   ```

2. **Verify TypeScript compiles:**
   ```bash
   npm run build
   ```

3. **Run tests:**
   ```bash
   npm test
   ```
   - Publication-status fixtures now use `publication_status` instead of `is_active`.

## Educator Workflow (New)

**Before this change:**
1. Educator creates draft → publishes → **immediately visible to players** ❌

**After this change:**
1. Educator creates draft → publishes (content goes to live table as `'pending'`)
2. Educator clicks "Go Live" → calls `/drafts/[id]/release` → status flips to `'live'`
3. Players can now see it ✅

**Future state (admin approval):**
1. Educator creates draft → publishes (status: `'pending'`)
2. Admin reviews → approves → calls release endpoint → status: `'live'`
3. Players can see it

## Remaining Work

1. **UI updates** (not done here):
   - Add "Go Live" button in educator dashboard for pending content
   - Show publication status badge (pending/live/archived) on content cards
   - Filter educator's content list by status



## Rollback Plan

If issues arise, revert by:
1. Running a reverse migration that adds `is_active` back and drops `publication_status`
2. Reverting the code changes

Note: No data loss — all existing content was migrated to `'live'` status.
