-- ============================================================
-- System 7: ผูกครูกับห้องเรียน + กันประเมินซ้ำ (1 รายการ/คน/บท/วัน)
-- Run AFTER supabase-system6-students.sql
-- ============================================================

-- ---- 1. Teacher ↔ Classroom binding ----
CREATE TABLE IF NOT EXISTS teacher_classrooms (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, classroom_id)
);
ALTER TABLE teacher_classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read teacher_classrooms" ON teacher_classrooms FOR SELECT USING (true);
CREATE POLICY "Public insert teacher_classrooms" ON teacher_classrooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete teacher_classrooms" ON teacher_classrooms FOR DELETE USING (true);

-- ---- 2. Teacher management (หน้า "จัดการครู" needs write access) ----
CREATE POLICY "Public insert teachers" ON teachers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update teachers" ON teachers FOR UPDATE USING (true);
CREATE POLICY "Public delete teachers" ON teachers FOR DELETE USING (true);

-- ---- 3. One assessment per student/module/day ----
-- de-dup existing rows: keep the LATEST record of each (student, module, local day)
DELETE FROM student_assessments a USING student_assessments b
WHERE a.student_id = b.student_id
  AND a.module_id = b.module_id
  AND (a.created_at AT TIME ZONE 'Asia/Bangkok')::date = (b.created_at AT TIME ZONE 'Asia/Bangkok')::date
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- safety net against double-insert races (app updates same-day rows in place)
CREATE UNIQUE INDEX IF NOT EXISTS student_assessments_one_per_day
  ON student_assessments (student_id, module_id, ((created_at AT TIME ZONE 'Asia/Bangkok')::date));
