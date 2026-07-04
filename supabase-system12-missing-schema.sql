-- =============================================================
-- System 12: ซ่อม schema drift — ตาราง/คอลัมน์ที่ใช้จริงใน production
-- แต่ไม่เคยมี CREATE ในไฟล์ SQL ใด ๆ ใน repo (สร้างผ่าน SQL ในแชทระหว่างพัฒนา)
--
-- ที่มา: สร้างย้อนจากโค้ด (src/lib/types.ts + insert payload จริงในแต่ละหน้า)
-- ณ 2026-07-03 — ถ้าฐานข้อมูลจริงมีอยู่แล้ว ไฟล์นี้รันซ้ำได้ปลอดภัย (IF NOT EXISTS ทุกคำสั่ง)
-- หมายเหตุ: รันบนฐานที่ผ่าน supabase-schema.sql .. system11 + multitenant มาแล้ว
-- =============================================================

-- ---- lesson_plans (ตารางหลักของระบบแผนการสอน) ----
CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT '00000000-0000-4000-a000-000000000001' REFERENCES schools(id),
  teacher_id UUID REFERENCES teachers(id),
  module_id UUID REFERENCES curriculum_modules(id),
  plan_number INT NOT NULL,
  topic TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  planned_week INT,          -- สัปดาห์ที่สอนจริงภายในช่วงสัปดาห์ของหน่วย
  teach_dates DATE[],        -- สอนหลายห้องคนละวันได้
  duration TEXT,             -- "เวลาเรียน" เช่น '1 ชั่วโมง'
  indicators_interim TEXT,
  indicators_final TEXT,
  objectives_k TEXT,
  objectives_p TEXT,
  objectives_a TEXT,
  key_content TEXT,
  competencies TEXT,
  desired_traits TEXT,
  activities TEXT,
  assessment TEXT,
  materials TEXT,
  post_lesson_note TEXT,
  suggestion TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'revision')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_plans all" ON lesson_plans;
CREATE POLICY "lesson_plans all" ON lesson_plans FOR ALL USING (true) WITH CHECK (true);

-- ---- test_item_responses (ผลตรวจรายข้อ: แตะ = ผิด, ไม่มีแถว = ถูก) ----
CREATE TABLE IF NOT EXISTS test_item_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT '00000000-0000-4000-a000-000000000001' REFERENCES schools(id),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  test_item_id UUID NOT NULL REFERENCES test_items(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- จำเป็นต่อ upsert(onConflict: 'test_item_id,student_id') ใน teacher/tests/page.tsx
CREATE UNIQUE INDEX IF NOT EXISTS test_item_responses_item_student_uniq
  ON test_item_responses (test_item_id, student_id);
ALTER TABLE test_item_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "test_item_responses all" ON test_item_responses;
CREATE POLICY "test_item_responses all" ON test_item_responses FOR ALL USING (true) WITH CHECK (true);

-- ---- student_grade_history (snapshot ห้องเรียนรายปี ใช้ตอนเลื่อนชั้น) ----
CREATE TABLE IF NOT EXISTS student_grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT '00000000-0000-4000-a000-000000000001' REFERENCES schools(id),
  academic_year INT NOT NULL,          -- พ.ศ. เช่น 2569
  student_id UUID REFERENCES students(id),
  student_name TEXT NOT NULL,
  student_number TEXT,
  classroom_name TEXT NOT NULL,
  grade_level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE student_grade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_grade_history all" ON student_grade_history;
CREATE POLICY "student_grade_history all" ON student_grade_history FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- คอลัมน์ที่เพิ่มภายหลังในตารางเดิม (เคยให้เป็น SQL ในแชท ไม่เคยลงไฟล์)
-- =============================================================

-- exit-ticket / การบ้าน / pacing แยกรายแผนการสอน
ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);
ALTER TABLE homework_tasks ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);
ALTER TABLE pacing_logs ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);
ALTER TABLE plan_submissions ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);

-- โลโก้โรงเรียน (ใช้คู่กับ storage bucket 'school-assets' — ดู SQL bucket ด้านล่าง)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_path TEXT;

-- unique index ปัจจุบัน (1 บันทึกต่อ นักเรียน+หน่วย+แผน — NULLS NOT DISTINCT ต้องใช้ Postgres 15+)
DROP INDEX IF EXISTS homework_submissions_student_module_plan_uniq;
CREATE UNIQUE INDEX homework_submissions_student_module_plan_uniq
  ON homework_submissions (student_id, module_id, lesson_plan_id) NULLS NOT DISTINCT;
DROP INDEX IF EXISTS student_assessments_one_per_day; -- กฎเก่า "วันละครั้ง" — เลิกใช้แล้ว ห้ามสร้างกลับ
DROP INDEX IF EXISTS student_assessments_student_module_plan_uniq;
CREATE UNIQUE INDEX student_assessments_student_module_plan_uniq
  ON student_assessments (student_id, module_id, lesson_plan_id) NULLS NOT DISTINCT;

-- ---- storage bucket สำหรับโลโก้ (แสดงบนแผน/ข้อสอบที่พิมพ์) ----
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "school-assets read"   ON storage.objects;
DROP POLICY IF EXISTS "school-assets insert" ON storage.objects;
DROP POLICY IF EXISTS "school-assets update" ON storage.objects;
CREATE POLICY "school-assets read"
  ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');
CREATE POLICY "school-assets insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'school-assets');
CREATE POLICY "school-assets update"
  ON storage.objects FOR UPDATE USING (bucket_id = 'school-assets');
