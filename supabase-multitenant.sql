-- ============================================================
-- Multi-Tenant Migration — เพิ่ม school_id ทุกตาราง
-- Run AFTER supabase-system11-traits.sql
--
-- โรงเรียนอนุสรณ์ศุภมาศ = school seed UUID:
-- 00000000-0000-4000-a000-000000000001
-- ============================================================

-- ---- 1. Schools table ----
CREATE TABLE IF NOT EXISTS schools (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  short_name  TEXT,
  province    TEXT    DEFAULT 'สมุทรสาคร',
  school_code TEXT,
  director_name TEXT,
  address     TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read schools"   ON schools FOR SELECT USING (true);
CREATE POLICY "Public insert schools" ON schools FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update schools" ON schools FOR UPDATE USING (true);

-- ---- 2. Seed: โรงเรียนอนุสรณ์ศุภมาศ (fixed UUID สำหรับข้อมูล pilot) ----
INSERT INTO schools (id, name, short_name, province)
VALUES ('00000000-0000-4000-a000-000000000001',
        'โรงเรียนอนุสรณ์ศุภมาศ', 'อนุสรณ์ศุภมาศ', 'สมุทรสาคร')
ON CONFLICT (id) DO NOTHING;

-- ===========================================================
-- 3. เพิ่ม school_id ในทุกตาราง
--    DEFAULT = โรงเรียนแรก (ข้อมูล pilot เดิมจะถูกผูกอัตโนมัติ)
-- ===========================================================

-- ---- students ----
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE students SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE students ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE students ALTER COLUMN school_id SET NOT NULL;

-- ---- curriculum_modules ----
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE curriculum_modules SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE curriculum_modules ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE curriculum_modules ALTER COLUMN school_id SET NOT NULL;
-- แก้ unique constraint: module_code ต้อง unique ต่อโรงเรียน ไม่ใช่ global
ALTER TABLE curriculum_modules DROP CONSTRAINT IF EXISTS curriculum_modules_module_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_modules_school_code
  ON curriculum_modules (school_id, module_code);

-- ---- teachers ----
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE teachers SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE teachers ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE teachers ALTER COLUMN school_id SET NOT NULL;

-- ---- classrooms ----
ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE classrooms SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE classrooms ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE classrooms ALTER COLUMN school_id SET NOT NULL;
-- ห้องชื่อ "ป.3/1" ต้อง unique ต่อโรงเรียน
ALTER TABLE classrooms DROP CONSTRAINT IF EXISTS classrooms_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS classrooms_school_name
  ON classrooms (school_id, name);

-- ---- pacing_logs ----
ALTER TABLE pacing_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE pacing_logs SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE pacing_logs ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE pacing_logs ALTER COLUMN school_id SET NOT NULL;

-- ---- student_assessments ----
ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE student_assessments SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE student_assessments ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE student_assessments ALTER COLUMN school_id SET NOT NULL;
-- อัพเดท unique index: กัน double-entry ต่อโรงเรียน/นักเรียน/บท/วัน
DROP INDEX IF EXISTS student_assessments_one_per_day;
CREATE UNIQUE INDEX student_assessments_one_per_day
  ON student_assessments (school_id, student_id, module_id, ((created_at AT TIME ZONE 'Asia/Bangkok')::date));

-- ---- homework_submissions ----
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE homework_submissions SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE homework_submissions ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE homework_submissions ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE homework_submissions DROP CONSTRAINT IF EXISTS homework_submissions_student_module_key;
CREATE UNIQUE INDEX IF NOT EXISTS homework_submissions_school_student_module
  ON homework_submissions (school_id, student_id, module_id);

-- ---- plan_submissions ----
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE plan_submissions SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE plan_submissions ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE plan_submissions ALTER COLUMN school_id SET NOT NULL;

-- ---- academic_settings: เปลี่ยนจาก single-row เป็น 1 row ต่อโรงเรียน ----
ALTER TABLE academic_settings DROP CONSTRAINT IF EXISTS single_row;
ALTER TABLE academic_settings ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE academic_settings SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
-- เปลี่ยน id DEFAULT จาก 1 เป็น sequence เพื่อรองรับหลายโรงเรียน
CREATE SEQUENCE IF NOT EXISTS academic_settings_id_seq START WITH 2 INCREMENT BY 1;
ALTER TABLE academic_settings ALTER COLUMN id SET DEFAULT nextval('academic_settings_id_seq');
CREATE UNIQUE INDEX IF NOT EXISTS academic_settings_school
  ON academic_settings (school_id);

-- ---- homework_tasks ----
ALTER TABLE homework_tasks ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE homework_tasks SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE homework_tasks ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE homework_tasks ALTER COLUMN school_id SET NOT NULL;

-- ---- courses ----
ALTER TABLE courses ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE courses SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE courses ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE courses ALTER COLUMN school_id SET NOT NULL;

-- ---- indicators ----
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE indicators SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE indicators ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE indicators ALTER COLUMN school_id SET NOT NULL;
-- subject+code unique ต่อโรงเรียน
ALTER TABLE indicators DROP CONSTRAINT IF EXISTS indicators_subject_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS indicators_school_subject_code
  ON indicators (school_id, subject, code);

-- ---- tests ----
ALTER TABLE tests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE tests SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE tests ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE tests ALTER COLUMN school_id SET NOT NULL;

-- ---- test_scores ----
ALTER TABLE test_scores ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE test_scores SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE test_scores ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE test_scores ALTER COLUMN school_id SET NOT NULL;

-- ---- score_components ----
ALTER TABLE score_components ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE score_components SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE score_components ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE score_components ALTER COLUMN school_id SET NOT NULL;

-- ---- attendance ----
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE attendance SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE attendance ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE attendance ALTER COLUMN school_id SET NOT NULL;
-- อัพเดท unique: นักเรียน 1 คน 1 วัน ต่อโรงเรียน
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_school_student_date
  ON attendance (school_id, student_id, date);

-- ---- trait_ratings ----
ALTER TABLE trait_ratings ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
UPDATE trait_ratings SET school_id = '00000000-0000-4000-a000-000000000001' WHERE school_id IS NULL;
ALTER TABLE trait_ratings ALTER COLUMN school_id SET DEFAULT '00000000-0000-4000-a000-000000000001';
ALTER TABLE trait_ratings ALTER COLUMN school_id SET NOT NULL;
-- อัพเดท unique ต่อโรงเรียน
ALTER TABLE trait_ratings DROP CONSTRAINT IF EXISTS trait_ratings_student_id_subject_kind_item_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS trait_ratings_school_unique
  ON trait_ratings (school_id, student_id, subject, kind, item_no);

-- ===========================================================
-- 4. อัพเดท RLS policies ให้กรองตาม school_id (เตรียมพร้อม prod)
-- ตอนนี้ยัง pilot mode = public read/write แต่เพิ่ม school_id filter
-- ===========================================================

-- (ตัวอย่าง — เปิดใช้ได้เมื่อมี auth จริง)
-- DROP POLICY "Public read students" ON students;
-- CREATE POLICY "School read students" ON students
--   FOR SELECT USING (school_id = (SELECT school_id FROM teachers WHERE id = auth.uid()));
