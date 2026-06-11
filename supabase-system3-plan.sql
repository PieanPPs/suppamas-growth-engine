-- ============================================================
-- System 1 refactor: consolidated weekly plan card
-- Run AFTER supabase-system1.sql and supabase-system2-extras.sql
-- ============================================================

-- ---- 1. Richer plan fields ----
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS plan_name TEXT;
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS routine_hook TEXT;    -- 10 min
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS routine_core TEXT;    -- 15 min
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS routine_active TEXT;  -- 20 min
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS routine_exit TEXT;    -- 5 min

-- ---- 2. One quest per module so the plan card can upsert homework ----
DELETE FROM homework_tasks a USING homework_tasks b
  WHERE a.id < b.id AND a.module_id = b.module_id;
ALTER TABLE homework_tasks
  DROP CONSTRAINT IF EXISTS homework_tasks_module_key;
ALTER TABLE homework_tasks
  ADD CONSTRAINT homework_tasks_module_key UNIQUE (module_id);
