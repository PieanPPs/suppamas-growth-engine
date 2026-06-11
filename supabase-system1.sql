-- ============================================================
-- System 1: Curriculum Pacing & Plan Submission
-- Run AFTER supabase-schema.sql
--
-- PILOT MODE: decoupled from Supabase Auth so the school can test
-- immediately. Teachers identify themselves by picking their name
-- (realistic for shared iPads). For production, re-introduce
-- auth.users FKs + authenticated-only RLS.
-- ============================================================

-- ---- 1. Extend curriculum_modules with calendar planning ----
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS planned_week INT;
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS sequence_order INT;

UPDATE curriculum_modules SET planned_week = 1, sequence_order = 1 WHERE module_code = 'TH-P3-W01';
UPDATE curriculum_modules SET planned_week = 2, sequence_order = 2 WHERE module_code = 'TH-P3-W02';
UPDATE curriculum_modules SET planned_week = 3, sequence_order = 3 WHERE module_code = 'TH-P3-W03';
UPDATE curriculum_modules SET planned_week = 5, sequence_order = 4 WHERE module_code = 'TH-P3-W04';
UPDATE curriculum_modules SET planned_week = 1, sequence_order = 1 WHERE module_code = 'MA-P3-W01';
UPDATE curriculum_modules SET planned_week = 2, sequence_order = 2 WHERE module_code = 'MA-P3-W02';
UPDATE curriculum_modules SET planned_week = 3, sequence_order = 3 WHERE module_code = 'MA-P3-W03';

-- Make TH-P3-W03 a 2-week lesson to demo auto-continue (weeks 3-4)
UPDATE curriculum_modules SET expected_duration_weeks = 2 WHERE module_code = 'TH-P3-W03';

-- ---- 2. Teachers (pilot identity — no auth) ----
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read teachers" ON teachers FOR SELECT USING (true);

INSERT INTO teachers (name, subjects) VALUES
  ('ครูสมศรี (ภาษาไทย ป.3)', ARRAY['Thai_P3']),
  ('ครูมานะ (คณิตศาสตร์ ป.3)', ARRAY['Math_P3'])
ON CONFLICT DO NOTHING;

-- ---- 3. Decouple existing pacing_logs from auth (pilot) ----
ALTER TABLE pacing_logs DROP CONSTRAINT IF EXISTS pacing_logs_teacher_id_fkey;
DROP POLICY IF EXISTS "Auth insert own pacing_logs" ON pacing_logs;
DROP POLICY IF EXISTS "Auth update own pacing_logs" ON pacing_logs;
DROP POLICY IF EXISTS "Auth read pacing_logs" ON pacing_logs;
CREATE POLICY "Public read pacing_logs" ON pacing_logs FOR SELECT USING (true);
CREATE POLICY "Public insert pacing_logs" ON pacing_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pacing_logs" ON pacing_logs FOR UPDATE USING (true);

-- ---- 4. Plan submissions (one per teacher per module) ----
CREATE TABLE IF NOT EXISTS plan_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  material_link TEXT,
  summary_note TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, module_id)
);
ALTER TABLE plan_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read plan_submissions" ON plan_submissions FOR SELECT USING (true);
CREATE POLICY "Public insert plan_submissions" ON plan_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update plan_submissions" ON plan_submissions FOR UPDATE USING (true);

-- ---- 5. Academic settings (single row — term calendar) ----
CREATE TABLE IF NOT EXISTS academic_settings (
  id INT PRIMARY KEY DEFAULT 1,
  term_name TEXT NOT NULL DEFAULT 'ภาคเรียนที่ 1',
  term_start_date DATE NOT NULL,
  total_weeks INT NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO academic_settings (id, term_name, term_start_date, total_weeks)
VALUES (1, 'ภาคเรียนที่ 1/2569', '2026-05-18', 20)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE academic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read academic_settings" ON academic_settings FOR SELECT USING (true);
CREATE POLICY "Public update academic_settings" ON academic_settings FOR UPDATE USING (true);
CREATE POLICY "Public insert academic_settings" ON academic_settings FOR INSERT WITH CHECK (true);

-- ---- 6. Storage bucket for lesson plan files ----
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-plans', 'lesson-plans', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read lesson-plans"
  ON storage.objects FOR SELECT USING (bucket_id = 'lesson-plans');
CREATE POLICY "Public upload lesson-plans"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lesson-plans');
CREATE POLICY "Public update lesson-plans"
  ON storage.objects FOR UPDATE USING (bucket_id = 'lesson-plans');
