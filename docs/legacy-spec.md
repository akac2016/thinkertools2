# Legacy Spec (from `legacy/thinkertools_code_copy`)

## 1) What the app does (plain language)

Legacy Thinkertools includes two team-collaboration products that share the same account/team system:

- **Quipx**: a structured team session workflow for communication and retrospective improvement.
  - Team creates a session.
  - Team discusses the topic in a live-ish chat.
  - Team rates reflection prompts.
  - App recommends improvement strategies.
  - Team reviews strengths/weaknesses and comments.

- **Web of Inquiry (WOI)**: a turn-based inquiry game system for answering complex questions.
  - User creates a game from a template or designs a new template.
  - Team takes turns applying moves/rules to produce evolving results.
  - Game can be reviewed and optionally made public.
  - Library/search helps discover public games and related patterns.

Both tools are collaboration-first, team-gated, and built around reusable game/session structures.

## 2) Core user flows (3-5)

### Flow A: Quipx session lifecycle (end-to-end)
1. User opens `quipx/home.php` and chooses **Create session**.
2. In `quipx/create.php?action=new`, user enters subject/objectives, team, date/time/duration.
3. Submitting `create.php?action=insert` creates a `session` record and links to `discuss.php?sessionID=...`.
4. Team discusses in `discuss.php`; entries are added by `discuss_entry.php`, displayed via `entries.php` polling.
5. Team moves to `reflect.php` (rates each reflect item + comments).
6. Team views aggregated strategies in `improve.php`.
7. Team finishes in `review.php` with strengths/weaknesses + final comments.

### Flow B: Quipx session maintenance
1. User opens `quipx/modify.php`.
2. User selects a session to edit.
3. If user is the session creator, `modify.php?action=edit` shows edit form.
4. `modify.php?action=update` updates the `session` record.

### Flow C: WOI game creation
1. User opens `webofinquiry/design.php?action=new`.
2. User sets question/description/team/private-public.
3. User either:
   - selects an existing template (`template_id > 0`), or
   - creates a new template with objective, rules, moves, optional levels.
4. `design.php?action=insert` creates template records (if new) and then a `game`.
5. User gets link to play (`board.php?game_id=...`).

### Flow D: WOI gameplay loop
1. User opens `webofinquiry/board.php?game_id=...`.
2. Team sees game plan and/or current level board.
3. Current player submits turn text + move (+ optional rule).
4. Turn is saved (`turn`, `turn_text`), next player is assigned.
5. Team can review level turns and post comments.
6. User finishes play and moves to `reflect.php`.

### Flow E: Discover/public knowledge flow
1. User searches in `webofinquiry/home.php?action=search` (token overlap ranking).
2. App highlights a “best match” game and related games via `gridview-wide.php`.
3. Public games and template metadata are browsable in `library.php`.
4. In `reflect.php?action=public`, game creator is prompted to publish via design edit page.

## 3) Key data entities and fields

### Shared account/team entities (external DB usage)
- `ttuser`: `userID`, `username`, `firstname`, `lastname`, `fontcolor`
- `ttteam`: `teamID`, `teamName`
- `ttteam_mem`: `teammemID`, `teamID`, `userID`
- `message`: `messageID`, `subject`, `message`, `sentTime`, `senderID`, `senderName`, `recInd`, `recTeam`, `recOrg`, `recAll`, `game_id`, `sessionID`

### Quipx entities
- `session`: `sessionID`, `userID` (creator), `teamID`, `subject`, `created`, `month`, `day`, `year`, `hour`, `minute`, `ampm`, `zone`, `duration_hours`, `duration_minutes`, `objectives`
- `session_discuss`: `discussID`, `sessionID`, `userID`, `entry`, `entryTime`
- `reflect_item`: `reflectItemID`, `reflectItem`, `reflectItemShort`, `reflectItemDesc`, `reflectItemOrder`
- `reflect_response`: `reflectResponseID`, `reflectItemID`, `reflectResponseOrder`, `reflectResponse`
- `reflect_select`: `sessionID`, `reflectItemID`, `userID`, `reflectSelect`, `reflectJustify`
- `improve_strategy`: `reflectResponseID`, `strategy`

### Web of Inquiry entities
- `game`: `game_id`, `template_id`, `game_creator`, `teamID`, `game_start`, `game_name`, `game_description`, `game_public`, `turn_id` (current player)
- `template`: `template_id`, `template_name`, `template_creator`, `template_modified`, `template_public`, `template_object`, `template_category`
- `template_rule`: `rule_id`, `template_id`, `rule`, `rule_order`
- `template_move`: `move_id`, `template_id`, `move`, `move_order`
- `template_level`: `level_id`, `template_id`, `level_name`, `level_object`, `level_order`
- `template_tool`: `template_id`, `tool_id`
- `turn`: `turn_id`, `game_id`, `user_id`, `turn_time`, `tool_id`, `move_id`, `rule_id`, `level_id`
- `turn_text`: `turn_id`, `turn_text`
- `subject`: `subjectID`, `domain`, `subject`
- `template_subject`: `template_id`, `subjectID`
- `chart`: `rowID`, `col1`, `col2`, `col3`, `col4`

## 4) Routes/pages and what each does

### Quipx pages
- `legacy/thinkertools_code_copy/quipx/home.php`: landing, session list by team, create/modify entry points.
- `legacy/thinkertools_code_copy/quipx/create.php`: new session form and insert.
- `legacy/thinkertools_code_copy/quipx/modify.php`: list/edit/update existing sessions.
- `legacy/thinkertools_code_copy/quipx/discuss.php`: live discussion board with polling.
- `legacy/thinkertools_code_copy/quipx/discuss_entry.php`: AJAX endpoint to insert one discussion entry.
- `legacy/thinkertools_code_copy/quipx/entries.php`: returns rendered discussion entries for polling.
- `legacy/thinkertools_code_copy/quipx/reflect.php`: user ratings/comments per reflect item.
- `legacy/thinkertools_code_copy/quipx/improve.php`: aggregate ratings, show strategy text.
- `legacy/thinkertools_code_copy/quipx/review.php`: final summary, strengths/weaknesses, comments.
- `legacy/thinkertools_code_copy/quipx/mainhead.php`: global navigation bar include.
- `legacy/thinkertools_code_copy/quipx/qxdb.php`: MySQL connection for Quipx DB.

Referenced but not present in this folder:
- `join.php` (linked from permission warnings)

### Web of Inquiry pages
- `legacy/thinkertools_code_copy/webofinquiry/home.php`: WOI home, search, highlighted game, launch play/design.
- `legacy/thinkertools_code_copy/webofinquiry/play.php`: list playable games by team membership.
- `legacy/thinkertools_code_copy/webofinquiry/design.php`: create game, select/edit template, modify game.
- `legacy/thinkertools_code_copy/webofinquiry/board.php`: main gameplay board, turns, levels, comments.
- `legacy/thinkertools_code_copy/webofinquiry/board-turn.php`: AJAX snippet for current turn/player list.
- `legacy/thinkertools_code_copy/webofinquiry/reflect.php`: post-play review, level turn history, publish prompt, comments.
- `legacy/thinkertools_code_copy/webofinquiry/library.php`: public library/resources (subjects, categories, chart, elements).
- `legacy/thinkertools_code_copy/webofinquiry/gridview.php`: 3x3 related-game view logic (used in reflect context).
- `legacy/thinkertools_code_copy/webofinquiry/gridview-wide.php`: wider variant used on home.
- `legacy/thinkertools_code_copy/webofinquiry/grid.php`: standalone search+grid page.
- `legacy/thinkertools_code_copy/webofinquiry/index.php`: older dashboard shell.
- `legacy/thinkertools_code_copy/webofinquiry/mainhead.php`: global navigation include.
- `legacy/thinkertools_code_copy/webofinquiry/woidb.php`: MySQL connection for WOI DB.

Referenced but not present in this folder:
- `gridviewtest.php` (required by `grid.php`)

## 5) Business rules and edge cases observed

### Business rules
- User must be logged in for create/modify/play actions.
- User must be a member of the selected team to participate in a session/game.
- Only session creator can modify a Quipx session.
- Only game creator can modify a WOI game.
- Only current player can submit a WOI turn; creator can manually set turn (`action=select`).
- Quipx reflect submissions are one rating per user per reflect item (delete old then insert new).
- WOI results visibility is tied to `game_public`; question metadata is still broadly visible.
- New WOI template requires objective + at least 3 rules + at least 3 moves.

### Edge cases / implementation risks
- `$_GET['action']` is used in many places without `isset` checks (notice-level fragility).
- Quipx participant scoring can divide by zero when there are zero entries/words.
- `webofinquiry/home.php` defaults to `game_id = 8`; assumes seed data exists.
- Search ranking is token overlap with stopword filtering and random game order; ties are nondeterministic.
- `webofinquiry/board.php` has a malformed query string when loading latest turn text (quote mismatch around `turn_id`).
- `grid.php` requires missing `gridviewtest.php`.
- `join.php` is linked from Quipx warnings but not present in this folder.
- Security hardening is minimal: no CSRF protection, inconsistent output escaping, some dynamic SQL usage.
- Time display is hard-coded with `ET` label in comments regardless of user timezone.
- Year choices in Quipx create/modify are hard-coded (2025-2027).
- Editing an in-progress game is allowed (warning only), which can invalidate turn history interpretation.

