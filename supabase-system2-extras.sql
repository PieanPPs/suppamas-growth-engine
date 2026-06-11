-- ============================================================
-- System 2 extras: Smart Homework (Module C) + pilot RLS
-- Run AFTER supabase-schema.sql and supabase-system1.sql
-- ============================================================

-- ---- 1. Homework tasks (weekly "Quest" per module) ----
CREATE TABLE IF NOT EXISTS homework_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE homework_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read homework_tasks" ON homework_tasks FOR SELECT USING (true);
CREATE POLICY "Public insert homework_tasks" ON homework_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update homework_tasks" ON homework_tasks FOR UPDATE USING (true);

-- Seed one quest per existing module
INSERT INTO homework_tasks (module_id, title, description)
SELECT id,
  CASE
    WHEN module_code = 'TH-P3-W01' THEN 'อ่านออกเสียงบทที่ 1 ให้ผู้ปกครองฟัง 1 รอบ'
    WHEN module_code = 'TH-P3-W02' THEN 'คัดพยัญชนะชุดที่ 1 ลงสมุด 1 หน้า'
    WHEN module_code = 'TH-P3-W03' THEN 'คัดคำควบกล้ำแท้ 10 คำลงสมุดภารกิจ'
    WHEN module_code = 'TH-P3-W04' THEN 'แต่งประโยคจากคำพ้องเสียง 5 ประโยค'
    WHEN module_code = 'MA-P3-W01' THEN 'ทำแบบฝึกหัดบวกลบ 10 ข้อ'
    WHEN module_code = 'MA-P3-W02' THEN 'ท่องสูตรคูณแม่ 2-5 ให้ผู้ปกครองฟัง'
    WHEN module_code = 'MA-P3-W03' THEN 'ทำโจทย์ปัญหาการหาร 5 ข้อ'
    ELSE 'ทำแบบฝึกหัดลงสมุดภารกิจ'
  END,
  'ภารกิจประจำสัปดาห์ — ส่งสมุดที่หน้าห้องเรียน'
FROM curriculum_modules
ON CONFLICT DO NOTHING;

-- ---- 2. Homework submissions: pilot RLS + upsert key ----
ALTER TABLE homework_submissions
  DROP CONSTRAINT IF EXISTS homework_submissions_student_module_key;
-- de-dup any existing rows before adding the unique key
DELETE FROM homework_submissions a USING homework_submissions b
  WHERE a.id < b.id AND a.student_id = b.student_id AND a.module_id = b.module_id;
ALTER TABLE homework_submissions
  ADD CONSTRAINT homework_submissions_student_module_key UNIQUE (student_id, module_id);

DROP POLICY IF EXISTS "Auth read homework" ON homework_submissions;
DROP POLICY IF EXISTS "Auth insert homework" ON homework_submissions;
DROP POLICY IF EXISTS "Public read homework for report" ON homework_submissions;
CREATE POLICY "Public read homework" ON homework_submissions FOR SELECT USING (true);
CREATE POLICY "Public insert homework" ON homework_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update homework" ON homework_submissions FOR UPDATE USING (true);

-- ---- 3. Student assessments: pilot RLS (so heroes/predictive read freely) ----
DROP POLICY IF EXISTS "Auth insert assessments" ON student_assessments;
DROP POLICY IF EXISTS "Auth update assessments" ON student_assessments;
CREATE POLICY "Public insert assessments" ON student_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update assessments" ON student_assessments FOR UPDATE USING (true);
-- (public SELECT already added in supabase-public-report.sql)
