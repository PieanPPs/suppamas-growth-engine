-- =============================================================
-- System 16: แผนการประเมินผู้เรียนต่อแผนการสอน (persistent assessment plan)
-- ครูออกแบบว่าจะวัดตัวชี้วัดของแผนนี้ด้วยวิธีใด + เกณฑ์ผ่าน แล้วระบบติดตาม
-- ย้อนหลังอัตโนมัติว่ามีข้อมูลจริงเกิดขึ้นตามแผนหรือยัง (เทียบกับ student_assessments /
-- homework_tasks / tests ที่ผูกกับ lesson_plan_id เดียวกัน)
--
-- รันซ้ำได้ปลอดภัย — รันใน Supabase SQL Editor
-- =============================================================

-- ผูกแบบทดสอบเข้ากับแผนการสอนที่ตั้งใจใช้วัด (nullable — ข้อสอบที่ไม่ผูกแผนยังใช้ได้ตามเดิม)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id);
CREATE INDEX IF NOT EXISTS tests_lesson_plan_idx ON tests (lesson_plan_id);

CREATE TABLE IF NOT EXISTS assessment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT '00000000-0000-4000-a000-000000000001' REFERENCES schools(id),
  lesson_plan_id UUID NOT NULL UNIQUE REFERENCES lesson_plans(id) ON DELETE CASCADE,
  methods TEXT[] NOT NULL DEFAULT '{}',        -- ชุดค่าใน 'exit_ticket' | 'quiz' | 'observation' | 'homework'
  target_indicators TEXT,                       -- ตัวชี้วัดที่ตั้งใจวัด (default มาจากแผนการสอน แก้ไขได้)
  criteria TEXT,                                 -- เกณฑ์ผ่าน / วิธีให้คะแนน
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE assessment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessment_plans all" ON assessment_plans;
CREATE POLICY "assessment_plans all" ON assessment_plans FOR ALL USING (true) WITH CHECK (true);
