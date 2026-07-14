# Publication Status Implementation - COMPLETE

## Summary

Successfully implemented a staged publishing workflow where educators can create content that waits in a "pending" state before going live to players.

---

## What Was Implemented

### 1. Database Migration ✅
- **File:** `supabase/migrations/20260612000000_add_publication_status.sql`
- Added `publication_status` column to 4 content tables (trainings, training_activity_groups, training_activities, missions)
- Values: `'pending'`, `'live'`, `'archived'`
- Backfilled existing data: `is_active = true` → `'live'`, `is_active = false` → `'archived'`
- Dropped `is_active` column

### 2. Type Definitions Updated ✅
- `/lib/quests/domain-types.ts` - TrainingRow, TrainingActivityRow, MissionRow
- `/lib/quests/activity-groups-query.ts` - RawActivityGroupRow
- `/lib/quests/missions-query.ts` - RawMissionRow
- `/lib/quests/trainings-query.ts` - RawTrainingRow
- `/app/thinkertools-missions-create/page.tsx` - Training type

### 3. Player-Facing Routes (Filter by `publication_status = 'live'`) ✅
All these routes now only show live content to players:
- `GET /api/thinkertools-missions/trainings`
- `GET /api/thinkertools-missions/missions`
- `GET /api/thinkertools-missions/missions/[missionSlug]`
- `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups`
- `GET /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities`
- `POST /api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit`
- `/lib/quests/server-progress.ts`
- `/lib/missions/server.ts`

### 4. Creator-Facing Routes (Insert with `publication_status = 'pending'`) ✅
Content starts in pending state:
- `POST /api/thinkertools-missions-create/trainings` → creates training as `'pending'`
- `POST /api/thinkertools-missions-create/activity-groups` → creates group as `'pending'`
- `POST /api/thinkertools-missions-create/drafts/[draftId]/publish` → publishes to live table as `'pending'`

### 5. New "Go Live" Endpoint ✅
- **File:** `/app/api/thinkertools-missions-create/drafts/[draftId]/release/route.ts`
- `POST /api/thinkertools-missions-create/drafts/[draftId]/release`
- Flips published content from `'pending'` → `'live'`
- Validates ownership and status
- Idempotent (safe to call multiple times)
- Rejects archived content

### 6. UI Updates ✅

#### Draft List Component (`components/thinkertools-missions-create/draft-list.tsx`)
- **Status filter tabs:** All / Published / Ready / In Progress
- **Status badges:** Visual indicators for draft/valid/published/archived
- **Go Live button:** Shows on published drafts in the list
- **Publication status awareness:** Filters work correctly

#### Training Picker (`app/thinkertools-missions-create/page.tsx`)
- **Separated sections:**
  - "Published tracks" - shows `publication_status = 'live'` trainings
  - "Your drafts" - shows `publication_status = 'pending'` trainings with amber styling
- Visual distinction so educators know what's live vs draft

---

## Current Workflow

### For Educators

**Creating New Content:**
1. Educator creates a draft (or training/group) → stored with `status='draft'` in content_drafts
2. Educator refines it → status becomes `'valid'` when validation passes
3. Educator clicks **"Publish"** → content inserted into live table with `publication_status='pending'`
4. Draft status becomes `'published'` and gets a `published_ref_id`
5. **NEW:** Educator clicks **"Go Live"** → content flips to `publication_status='live'`
6. Content now visible to players ✅

**Managing Trainings:**
- New trainings start as `publication_status='pending'`
- Show in "Your drafts" section with amber badge
- Once live, appear in "Published tracks" section
- Can create content under pending trainings (it also stays pending)

### For Players

- Only see content where `publication_status='live'`
- Pending and archived content is completely hidden
- No changes to player experience - everything "just works"

---

## Files Modified

**Database:**
- `supabase/migrations/20260612000000_add_publication_status.sql` (new)
- `supabase/schema.sql` (updated 4 table definitions)

**Types:**
- `lib/quests/domain-types.ts`
- `lib/quests/activity-groups-query.ts`
- `lib/quests/missions-query.ts`
- `lib/quests/trainings-query.ts`

**API Routes (Player):**
- `app/api/thinkertools-missions/trainings/route.ts`
- `app/api/thinkertools-missions/missions/route.ts`
- `app/api/thinkertools-missions/missions/[missionSlug]/route.ts`
- `app/api/thinkertools-missions/trainings/[trainingSlug]/groups/route.ts`
- `app/api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/route.ts`
- `app/api/thinkertools-missions/trainings/[trainingSlug]/groups/[groupSlug]/activities/submit/route.ts`
- `lib/quests/server-progress.ts`
- `lib/missions/server.ts`

**API Routes (Creator):**
- `app/api/thinkertools-missions-create/trainings/route.ts`
- `app/api/thinkertools-missions-create/activity-groups/route.ts`
- `app/api/thinkertools-missions-create/drafts/[draftId]/publish/route.ts`
- `app/api/thinkertools-missions-create/drafts/[draftId]/release/route.ts` (new)
- `app/api/thinkertools-missions-create/drafts/[draftId]/refine/route.ts`
- `app/api/thinkertools-missions-create/drafts/[draftId]/route.ts`
- `app/api/thinkertools-missions-create/drafts/route.ts`

**UI Components:**
- `components/thinkertools-missions-create/draft-list.tsx` (filters, Go Live button)
- `app/thinkertools-missions-create/page.tsx` (training picker sections)

**Bug Fixes:**
- Fixed Zod validation errors (`z.record()` calls)
- Fixed TypeScript type assertion for tuple types
- Fixed type mismatches in status comparisons

---

## Next Steps (Future Work)

### Admin Approval Flow
When you're ready to add admin approval:

1. **Add `'pending_approval'` status**
   ```sql
   ALTER TABLE trainings DROP CONSTRAINT trainings_publication_status_check;
   ALTER TABLE trainings ADD CONSTRAINT trainings_publication_status_check 
     CHECK (publication_status IN ('pending', 'pending_approval', 'live', 'archived'));
   -- Repeat for other 3 tables
   ```

2. **Update release endpoint**
   - Check if user has admin role
   - If not admin: flip `pending` → `pending_approval` (submit for review)
   - If admin: flip `pending_approval` → `live` (approve)

3. **Add admin dashboard**
   - List all `pending_approval` content
   - Show preview + approve/reject buttons
   - On reject: move back to `pending` with feedback

### Parent Auto-Promotion
Currently not implemented. Decision needed:
- **Option A:** When activity/mission goes `pending` → `live`, auto-promote parent training/group
- **Option B:** Require explicit "Go Live" on trainings/groups separately
- **Current behavior:** Parents stay pending even when children go live (orphaned navigation)

### Activity Editor "Go Live" Button
The activity/mission editors need the same "Go Live" button treatment as the draft list. Currently, you can only release from the draft list view.

**To add:**
1. Check if `draft.status === 'published'` and `draft.publishedRefId` exists
2. Show "Go Live" button next to "Publish" button
3. Call the release endpoint
4. Update UI to show "Content is live" status

---

## Testing Checklist

- [ ] Create new training → verify it starts as `pending`
- [ ] Create activity under pending training → verify it publishes as `pending`
- [ ] Click "Go Live" on published draft → verify content becomes `live`
- [ ] Check player view → confirm only live content shows
- [ ] Check creator view → confirm both pending and live trainings show (separated)
- [ ] Filter drafts by status → verify filters work correctly
- [ ] Delete pending content → verify it removes cleanly
- [ ] Archive live content manually in DB → verify it disappears from player view
