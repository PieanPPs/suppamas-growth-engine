-- ============================================================
-- System 6: Back-office — student data & classroom management
-- Run AFTER supabase-system5-library.sql
-- ============================================================

-- ---- 1. Extend students with real registry fields ----
ALTER TABLE students ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'กำลังศึกษาอยู่';
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT;          -- 'male' | 'female'
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- national_id = the matching key for re-uploads (NULLs allowed for manual adds)
DELETE FROM students a USING students b
  WHERE a.id < b.id AND a.national_id IS NOT NULL AND a.national_id = b.national_id;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_national_id_key;
ALTER TABLE students ADD CONSTRAINT students_national_id_key UNIQUE (national_id);

-- pilot RLS (no auth)
DROP POLICY IF EXISTS "Auth read students" ON students;
DROP POLICY IF EXISTS "Public read students" ON students;
CREATE POLICY "Public read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public insert students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update students" ON students FOR UPDATE USING (true);
CREATE POLICY "Public delete students" ON students FOR DELETE USING (true);

-- ---- 2. Classrooms (ห้องเรียน) ----
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 'ป.3/1'
  grade TEXT,                          -- 'ป.3'
  homeroom_teacher TEXT,               -- ครูประจำชั้น
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read classrooms" ON classrooms FOR SELECT USING (true);
CREATE POLICY "Public insert classrooms" ON classrooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update classrooms" ON classrooms FOR UPDATE USING (true);
CREATE POLICY "Public delete classrooms" ON classrooms FOR DELETE USING (true);

-- seed classrooms from any existing student class_name values
INSERT INTO classrooms (name, grade)
SELECT DISTINCT class_name,
  split_part(class_name, '/', 1)
FROM students
WHERE class_name IS NOT NULL AND class_name <> ''
ON CONFLICT (name) DO NOTHING;
