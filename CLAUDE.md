@AGENTS.md

# Suppamas Growth Engine

EdTech platform for Anusorn Suppamas School. Next.js App Router + TypeScript + Supabase (PostgREST). User communicates in Thai; admin/teacher-facing app.

## Workflow (always follow)

1. Before pushing any change: `npx tsc --noEmit` then `npm run build` — both must be clean.
2. Commit + push after each completed fix/feature (established pattern, don't batch unrelated fixes into one commit).
3. Any schema-affecting change requires giving the exact SQL migration to the user in the same reply — they run it manually in Supabase SQL Editor (RLS blocks anon-key DELETEs; writes/updates work fine via the app, but destructive/DDL changes go through SQL Editor).
4. When context is getting long mid-session: proactively suggest `/compact`, or summarize + keep going, rather than waiting for it to auto-trigger. Keep this file's "Pending / open items" section current so state survives a compact or a new session.

## Critical gotchas

- **PostgREST hard-caps every request at 1000 rows server-side** — no client `.limit()` override works. Any table that can exceed 1000 rows must be read via `fetchAllPaged<T>()` in `src/lib/db.ts` (pages with `.range()` until a short page returns), not `.limit()`/`.select()` alone. Applies to `student_assessments`, `homework_submissions`, `trait_ratings`, `attendance`, `test_scores`, `component_scores`, `test_item_responses`, `pacing_logs`, `plan_submissions`.
- **Upserts, not check-then-insert-or-update.** Use `.upsert(payload, { onConflict: '...' })` for write paths where a row may or may not already exist (e.g. homework submissions keyed on `student_id,module_id,lesson_plan_id`). Manual "check local state then insert-or-update" logic is fragile against stale/incomplete local state.
- **Term-scoping analytics**: only apply `getTermStartISO()` filtering to tables that represent *per-term growing history* (`student_assessments`, `test_scores`). Do NOT term-scope `pacing_logs` / `plan_submissions` (cumulative/latest-wins state) or `lib/impact-data.ts` (all-time stakeholder metrics) — doing so makes prior-term completed work look incomplete.
- **Indicator grouping uses `standard`** (มาตรฐาน, e.g. "ค 1.1") not `strand` (สาระ, often unset) — matches the convention on `src/app/teacher/curriculum/page.tsx`.
- **Pacing status is per-lesson-plan**, not per-module: use `latestPacingByLessonPlan()` (keyed on `lesson_plan_id`) for lesson-plan cards, `latestPacingByModule()` (module-only rows, `lesson_plan_id IS NULL`) for module-level rollups. Don't conflate the two.
- **`student_assessments` is one record per (student, module, lesson_plan_id), not one per day.** Confirmed with user 2026-07-03. Read/write paths must key off `student_id,module_id,lesson_plan_id` (upsert on that triple, look up existing regardless of date) — never filter by `created_at`/today when checking "already assessed," that was the bug in the original `/teacher/assessment` page. Any other page aggregating this table (dashboard, impact-data, heroes, reports, pp5/pp6 print) should dedupe to the latest row per that triple before averaging/counting, the same way `pacing/page.tsx` now does — not yet audited across all of them.
- **`lesson_plans.planned_week`**: a module spans multiple weeks (`planned_week`..`planned_week + expected_duration_weeks - 1`); an individual lesson plan/topic can be taught in any week within that span. Legacy plans with `planned_week = null` fall back to displaying on the module's first week only.
- Typing a Supabase client param as a narrow structural type (e.g. `SupabaseLike`) against the real client causes "type instantiation is excessively deep." Type the param `any` with a comment instead. Same error occurs with ternaries inline in a query-builder chain — use `let q = ...; if (cond) q = q.foo()` instead.

## Pending / open items

- [ ] Confirm these migrations have been run in Supabase SQL Editor:
  - `ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS planned_week INT;`
  - `ALTER TABLE pacing_logs ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);`
  - `lesson_plans.teach_dates` migration (add `teach_dates date[]`, backfill, drop old `teach_date`).
  - `ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS duration TEXT;` (new — `duration` field, "เวลาเรียน" e.g. "1 ชั่วโมง", commit `9df64af`)
  - **School logo** (`7521440`): the `School.logo_path` type + `school-assets` bucket code existed but the DB column/bucket never did, so the logo NEVER printed. Needs: `ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_path TEXT;` + create public `school-assets` storage bucket + RLS policies allowing anon SELECT/INSERT/UPDATE. Then admin uploads logo via `/admin/settings`. Print pages (`lesson-plans/[id]/print`, `lesson-plans`, `tests/[id]/print`) already read `logo_path` and render it.
- [x] Exam print/export page now pulls real school name + logo (both the HTML preview and Word export), matching the lesson plan print page. Font was already TH Sarabun in both. Done in commit `0c7cb35`.
- [x] Lesson plan print page (single + bulk Word export) header now uses a bordered 3-row table matching the school's actual paper template (plan no./topic, subject/grade/term/year, teacher/date/duration). `duration` is editable on the plan detail page. Done in commits `d8cd8bb`, `9df64af`.
- [ ] Open risk, unconfirmed by user: any exams graded under the OLD tap-correct grading model (before the "tap = wrong" flip) will show inflated scores under the new model. Need to check `test_item_responses` for pre-flip data if this matters historically.
- [x] Prompt system upgrade (`5aad2fa`, no migration needed): lesson-plan prompt add-ons (`PROMPT_EXTRAS` in generate page), exam prompt answer-distribution fix + question types beyond MC (`EXAM_QTYPES`/`EXAM_STYLES` in `src/lib/exam-import.ts`, parser accepts free-text answers), worksheet prompt kit (`src/components/worksheets/worksheet-prompt-kit.tsx`, button on plan detail page).
- [ ] **BLOCKING — live saves failing in production right now.** Exit-ticket assessment fixed to one-record-per-(student, lesson plan) model (`fce81b3`) — see gotcha above. Discovered in prod (2026-07-03) that a **pre-existing legacy constraint `student_assessments_one_per_day`** (never documented, predates this session's work) enforces "1 record per student per day," which directly conflicts with the new model and throws `duplicate key value violates unique constraint "student_assessments_one_per_day"` on save. Must run in Supabase SQL Editor:
  ```sql
  -- 1) drop the old "one per day" rule — conflicts with the new one-per-lesson-plan model
  ALTER TABLE student_assessments DROP CONSTRAINT IF EXISTS student_assessments_one_per_day;
  DROP INDEX IF EXISTS student_assessments_one_per_day;

  -- 2) dedupe existing legacy duplicate rows (from the old daily-reassessment behavior), keep latest
  DELETE FROM student_assessments
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY student_id, module_id, lesson_plan_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
      FROM student_assessments
    ) t WHERE t.rn > 1
  );

  -- 3) add the new constraint so upsert(onConflict: 'student_id,module_id,lesson_plan_id') works
  DROP INDEX IF EXISTS student_assessments_student_module_plan_uniq;
  CREATE UNIQUE INDEX student_assessments_student_module_plan_uniq
  ON student_assessments (student_id, module_id, lesson_plan_id) NULLS NOT DISTINCT;
  ```
  Until this runs, `persistGrade()`'s `upsert()` in `assessment/page.tsx` fails for any student being re-saved on a different day than their existing record — this is actively breaking teacher saves, not just a future risk. **Before trusting any future schema-check on this table, actually inspect live constraints (e.g. `\d student_assessments` in SQL Editor) rather than assuming only what's in this file** — this constraint's existence was missed because it was never introduced by any change made in this session.

