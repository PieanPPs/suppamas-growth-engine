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
- **`student_assessments` is one record per (student, module, lesson_plan_id), not one per day.** Confirmed with user 2026-07-03. Read/write paths must key off `student_id,module_id,lesson_plan_id` (upsert on that triple, look up existing regardless of date) — never filter by `created_at`/today when checking "already assessed," that was the bug in the original `/teacher/assessment` page. Every page aggregating this table must pass rows through `latestAssessmentPerPlan()` from `src/lib/db.ts` before averaging/counting — audited + applied everywhere 2026-07-06.
- **`lesson_plans.planned_week`**: a module spans multiple weeks (`planned_week`..`planned_week + expected_duration_weeks - 1`); an individual lesson plan/topic can be taught in any week within that span. Legacy plans with `planned_week = null` fall back to displaying on the module's first week only.
- Typing a Supabase client param as a narrow structural type (e.g. `SupabaseLike`) against the real client causes "type instantiation is excessively deep." Type the param `any` with a comment instead. Same error occurs with ternaries inline in a query-builder chain — use `let q = ...; if (cond) q = q.foo()` instead.
- **Per-student analytics live under `/teacher/students/*`, not `/admin/students/*`** (moved 2026-07-07 so teachers can reach them too — `/admin/*` is admin/principal-only via `AuthGuard`, `/teacher/*` allows all three roles). Only `/admin/students/import` (roster upload) stays under admin. There are TWO independent scoring sources, both feeding the same `TagScore`/`StudentAbility`/`TagWeakness` shapes in `src/lib/analytics.ts` so they drop into the same UI: (1) daily exit-ticket tags (`buildStudentTagScores`/`groupStudentsByAbility`/`weakStudentsByTag`, keyed by `module.academic_tags`) and (2) real exam per-item results (`buildStudentIndicatorScores`/`groupStudentsByIndicatorAbility`/`weakStudentsByIndicator`, keyed by `test_items.indicator_code` + `test_item_responses`, same tap-equals-wrong convention as the tests/NT-cycle pages). Don't blend them into one number — show both, the user explicitly wants them distinguishable. When `role === 'teacher'`, the students list/groups pages auto-scope to the teacher's own `teacher_classrooms` rooms and `teachers.subjects` (admin/principal see everything, unscoped).

## User decisions (2026-07-03, do not re-ask)

- **student_assessments**: one record per (student, module, lesson_plan). The blocking `one_per_day` constraint fix HAS BEEN RUN in production — saves work now.
- **Multi-school expansion is intended within ~1 year** → security work (Supabase Auth + real RLS keyed to JWT school claim, kill client-side PIN query + public read of sensitive columns) must land before school #2.
- **Parent report links**: add a per-family access code derived from the student's `national_id` (national IDs to be imported later). Public-UUID-only links are NOT acceptable long-term.
- **Old tap-correct exam data**: not historically important; current data (recorded after the tap-wrong flip) is valid. No back-cleaning needed.

## Roadmap (agreed via Fable audit 2026-07-03 — work top-down)

Phase 1: COMPLETE ✓ (2026-07-06) — blocking migration ✓, multitenant.sql fix ✓, schema repair file ✓, dedupe audit ✓ (`latestAssessmentPerPlan()` in `src/lib/db.ts`, applied at all 11 aggregation sites), PDPA ✓ (`supabase-system13-pdpa.sql`), parent QR sheet ✓ (`/admin/classrooms/qr-print`, qrcode.react), attendance summary in ปพ.5 print ✓ (ปพ.6 already had one).
Phase 2 (in progress): ~~individual remediation plans~~ ✓ (`/teacher/remediation`, `src/lib/remediation.ts`, `supabase-system14-remediation.sql`); ~~NT/O-NET gap cycle~~ ✓ (`/teacher/nt-cycle` — mock_nt rounds, indicator×round matrix, targeted-practice prompt reusing `buildExamPrompt`, re-import closes the loop); NEXT: full ปพ.5 book export; student care system (SDQ/home visits); **add academic_year/term columns to per-term tables BEFORE next term starts**; teaching supervision records.
Phase 3: auto-compile ว.PA evidence portfolio per teacher (killer feature, data ~80% ready); multi-school enablement + Supabase Auth + real RLS (must land before school #2 — writes are still open to anyone with the anon key); shared plan/exam library; multi-year student portfolio; student self-assessment via QR.

## Pending / open items

- [x] All earlier session migrations confirmed live in production (planned_week, pacing_logs.lesson_plan_id, teach_dates, duration, logo_path + bucket — verified by features working in prod screenshots + user confirmation 2026-07-03).
- [x] `supabase-multitenant.sql` no longer recreates the dead `one_per_day` index (fixed to the per-plan unique index).
- [x] `supabase-system12-missing-schema.sql` created — reconstructs the 3 tables that had no CREATE TABLE anywhere (`lesson_plans`, `test_item_responses`, `student_grade_history`) plus all session-added columns/indexes/bucket. Idempotent. Reconstructed from code, not dumped from live DB — verify against live schema when convenient.
- [x] Exam print/export page now pulls real school name + logo (both the HTML preview and Word export), matching the lesson plan print page. Font was already TH Sarabun in both. Done in commit `0c7cb35`.
- [x] Lesson plan print page (single + bulk Word export) header now uses a bordered 3-row table matching the school's actual paper template (plan no./topic, subject/grade/term/year, teacher/date/duration). `duration` is editable on the plan detail page. Done in commits `d8cd8bb`, `9df64af`.
- [ ] Open risk, unconfirmed by user: any exams graded under the OLD tap-correct grading model (before the "tap = wrong" flip) will show inflated scores under the new model. Need to check `test_item_responses` for pre-flip data if this matters historically.
- [x] Prompt system upgrade (`5aad2fa`, no migration needed): lesson-plan prompt add-ons (`PROMPT_EXTRAS` in generate page), exam prompt answer-distribution fix + question types beyond MC (`EXAM_QTYPES`/`EXAM_STYLES` in `src/lib/exam-import.ts`, parser accepts free-text answers), worksheet prompt kit (`src/components/worksheets/worksheet-prompt-kit.tsx`, button on plan detail page).
- [x] ~~BLOCKING~~ RESOLVED (user ran the SQL 2026-07-03, saves confirmed working): dropped legacy `student_assessments_one_per_day` constraint, deduped, added per-plan unique index. Lesson kept: **before trusting any schema assumption, inspect live constraints in SQL Editor** — that legacy constraint predated this session and was invisible from the repo.
- [ ] **MIGRATIONS PENDING USER RUN (2026-07-06)**: `supabase-system13-pdpa.sql` (URGENT — deployed login code calls `login_with_pin` RPC; login is broken until this runs) and `supabase-system14-remediation.sql` (remediation page errors until the table exists). Both idempotent.
- [ ] PDPA follow-through: teacher PINs can no longer be revealed in the admin UI (reset-only). Writes to students/teachers (and the pin/import RPCs) are still open to anyone with the anon key — real lockdown needs Supabase Auth (Phase 3, before school #2).
- [ ] Family access codes for parent report links (from decision #3): `national_id` now lives in `student_private`, ready for a future `verify_family_code` RPC once national IDs are imported. QR sheet currently uses plain `/report/[id]` links (same exposure as before, per current design).

