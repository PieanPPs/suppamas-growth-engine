-- =============================================================
-- System 14: แผนซ่อมเสริมรายบุคคล (individual remediation plans)
-- เปลี่ยนระบบจาก "รายงานว่าใครตก" เป็น "ช่วยครูแก้" —
-- เด็กเสี่ยง/ตัวชี้วัดอ่อน → Prompt Kit ร่างแผนช่วยรายคน → ติดตามผลอัตโนมัติ
-- (เทียบคะแนน exit ticket ในหน่วยที่อ่อน ก่อน/หลังเริ่มแผน)
--
-- รันซ้ำได้ปลอดภัย — รันใน Supabase SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS remediation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL DEFAULT '00000000-0000-4000-a000-000000000001' REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id),
  -- snapshot ตอนสร้างแผน (หน่วยที่อ่อน + คะแนนเฉลี่ยขณะนั้น) ใช้เทียบพัฒนาการ
  weak_modules JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id, title, subject, avg}]
  weak_tags TEXT[] NOT NULL DEFAULT '{}',
  baseline_avg NUMERIC,                              -- คะแนนเฉลี่ย 0-2 ในหน่วยที่อ่อน ณ วันสร้างแผน
  plan_text TEXT,                                    -- แผนที่ได้จาก AI (ครู paste กลับ) หรือครูเขียนเอง
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'improved', 'closed')),
  follow_up_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS remediation_plans_student_idx ON remediation_plans (student_id);
ALTER TABLE remediation_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "remediation_plans all" ON remediation_plans;
CREATE POLICY "remediation_plans all" ON remediation_plans FOR ALL USING (true) WITH CHECK (true);
