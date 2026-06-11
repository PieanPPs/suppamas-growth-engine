-- ============================================================
-- Suppamas Growth Engine — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Students (basic reference table)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Curriculum modules (master lesson data)
CREATE TABLE IF NOT EXISTS curriculum_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  module_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  academic_tags TEXT[] NOT NULL DEFAULT '{}',
  expected_duration_weeks INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pacing logs (teacher weekly check-in)
CREATE TABLE IF NOT EXISTS pacing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Completed', 'In_Progress', 'Delayed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student assessments (exit ticket + behavior)
CREATE TABLE IF NOT EXISTS student_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  academic_score INT NOT NULL CHECK (academic_score IN (0, 1, 2)),
  focus_color TEXT NOT NULL CHECK (focus_color IN ('Green', 'Yellow', 'Red')),
  soft_skill_score INT NOT NULL CHECK (soft_skill_score IN (0, 1, 2)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Homework submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('On_Time', 'Late', 'Missing')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- Public read for curriculum_modules and students
CREATE POLICY "Public read curriculum_modules" ON curriculum_modules FOR SELECT USING (true);
CREATE POLICY "Public read students" ON students FOR SELECT USING (true);

-- Authenticated users can read all pacing logs (for dashboard)
CREATE POLICY "Auth read pacing_logs" ON pacing_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert own pacing_logs" ON pacing_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Auth update own pacing_logs" ON pacing_logs FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);

-- Authenticated users can read/write assessments
CREATE POLICY "Auth read assessments" ON student_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert assessments" ON student_assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update assessments" ON student_assessments FOR UPDATE TO authenticated USING (true);

-- Authenticated users can read/write homework
CREATE POLICY "Auth read homework" ON homework_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert homework" ON homework_submissions FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Seed Data (Sample curriculum modules — Thai P3)
-- ============================================================

INSERT INTO curriculum_modules (subject, module_code, title, academic_tags, expected_duration_weeks) VALUES
  ('Thai_P3', 'TH-P3-W01', 'การอ่านออกเสียง — บทที่ 1', ARRAY['TH-01', 'TH-02'], 1),
  ('Thai_P3', 'TH-P3-W02', 'การเขียนพยัญชนะ — ชุดที่ 1', ARRAY['TH-03'], 1),
  ('Thai_P3', 'TH-P3-W03', 'การอ่านจับใจความ — บทที่ 1', ARRAY['TH-01', 'TH-04'], 1),
  ('Thai_P3', 'TH-P3-W04', 'คำพ้องเสียง และคำพ้องความหมาย', ARRAY['TH-02', 'TH-05'], 1),
  ('Math_P3', 'MA-P3-W01', 'การบวก ลบ จำนวนไม่เกิน 1,000', ARRAY['MA-01', 'MA-02'], 1),
  ('Math_P3', 'MA-P3-W02', 'การคูณ — ตารางสูตรคูณ', ARRAY['MA-03'], 1),
  ('Math_P3', 'MA-P3-W03', 'การหาร และโจทย์ปัญหา', ARRAY['MA-03', 'MA-04'], 1);

-- Sample students
INSERT INTO students (name, class_name) VALUES
  ('สมชาย ใจดี', 'ป.3/1'),
  ('สมหญิง รักเรียน', 'ป.3/1'),
  ('ประเสริฐ มุ่งมั่น', 'ป.3/1'),
  ('วิภา สุขสันต์', 'ป.3/1'),
  ('ธนกร แก้วใส', 'ป.3/1'),
  ('พิมพ์ชนก นิลดำ', 'ป.3/1'),
  ('อนุชา สว่างใจ', 'ป.3/1'),
  ('กมลา ดีงาม', 'ป.3/1');
