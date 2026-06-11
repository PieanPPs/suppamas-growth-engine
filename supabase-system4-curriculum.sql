-- ============================================================
-- System 4: Curriculum Builder (teacher-built course structure)
-- รายวิชา → ตัวชี้วัด (ระหว่างทาง/ปลายทาง) → หน่วยการเรียนรู้
-- Run AFTER supabase-system3-plan.sql
-- ============================================================

-- ---- 1. Courses (รายวิชา — shared per subject) ----
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_key TEXT NOT NULL UNIQUE,        -- e.g. 'Math_P5' (used by modules/indicators)
  name TEXT NOT NULL,                       -- e.g. 'คณิตศาสตร์ ป.5'
  grade TEXT,                               -- 'ป.5'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Public insert courses" ON courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update courses" ON courses FOR UPDATE USING (true);

INSERT INTO courses (subject_key, name, grade) VALUES
  ('Thai_P3', 'ภาษาไทย ป.3', 'ป.3'),
  ('Math_P3', 'คณิตศาสตร์ ป.3', 'ป.3'),
  ('Math_P5', 'คณิตศาสตร์ ป.5', 'ป.5')
ON CONFLICT (subject_key) DO NOTHING;

-- ---- 2. Indicators (ตัวชี้วัด — the curriculum analysis) ----
CREATE TABLE IF NOT EXISTS indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,                    -- = courses.subject_key
  strand TEXT,                              -- สาระ (e.g. 'จำนวนและพีชคณิต')
  standard TEXT NOT NULL,                   -- มาตรฐาน (e.g. 'ค 1.1')
  code TEXT NOT NULL,                        -- รหัสตัวชี้วัด (e.g. 'ป.5/1')
  description TEXT NOT NULL,                 -- คำอธิบายตัวชี้วัด
  type TEXT NOT NULL CHECK (type IN ('interim', 'final')),  -- ระหว่างทาง / ปลายทาง
  key_concept TEXT,                          -- สาระสำคัญ (K)
  process TEXT,                              -- กระบวนการ/คำกริยา (P)
  sequence_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read indicators" ON indicators FOR SELECT USING (true);
CREATE POLICY "Public insert indicators" ON indicators FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update indicators" ON indicators FOR UPDATE USING (true);
CREATE POLICY "Public delete indicators" ON indicators FOR DELETE USING (true);

-- ---- 3. Module ↔ Indicator link (หน่วย ครอบคลุม ตัวชี้วัด) ----
CREATE TABLE IF NOT EXISTS module_indicators (
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  PRIMARY KEY (module_id, indicator_id)
);
ALTER TABLE module_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read module_indicators" ON module_indicators FOR SELECT USING (true);
CREATE POLICY "Public insert module_indicators" ON module_indicators FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete module_indicators" ON module_indicators FOR DELETE USING (true);

-- ---- 4. Let teachers build units themselves ----
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS unit_no INT;
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS created_by UUID;
CREATE POLICY "Public insert modules" ON curriculum_modules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update modules" ON curriculum_modules FOR UPDATE USING (true);
CREATE POLICY "Public delete modules" ON curriculum_modules FOR DELETE USING (true);

-- ---- 5. Seed sample indicators for Math_P5 (from the analysis table) ----
INSERT INTO indicators (subject, strand, standard, code, description, type, key_concept, process, sequence_order) VALUES
  ('Math_P5', 'จำนวนและพีชคณิต', 'ค 1.1', 'ป.5/1', 'เขียนเศษส่วนที่มีตัวส่วนเป็นตัวประกอบของ 10, 100, 1,000 ในรูปทศนิยม', 'interim', 'ความสัมพันธ์ระหว่างเศษส่วนกับทศนิยม การแปลงเศษส่วนสู่ทศนิยม', 'เขียน, แปลง, เชื่อมโยง', 1),
  ('Math_P5', 'จำนวนและพีชคณิต', 'ค 1.1', 'ป.5/3', 'หาผลบวก ผลลบของเศษส่วนและจำนวนคละ', 'final', 'การบวก การลบเศษส่วนและจำนวนคละ', 'หา, คำนวณ, ตรวจสอบ', 3),
  ('Math_P5', 'จำนวนและพีชคณิต', 'ค 1.1', 'ป.5/4', 'หาผลคูณ ผลหารของเศษส่วนและจำนวนคละ', 'final', 'การคูณ การหารเศษส่วนและจำนวนคละ', 'หา, คำนวณ, อธิบาย', 4),
  ('Math_P5', 'การวัดและเรขาคณิต', 'ค 2.1', 'ป.5/1', 'แสดงวิธีหาคำตอบของโจทย์ปัญหาเกี่ยวกับความยาว', 'interim', 'ความสัมพันธ์ของหน่วยความยาว การเปรียบเทียบความยาว', 'แสดงวิธี, เปรียบเทียบ, แก้ปัญหา', 5),
  ('Math_P5', 'การวัดและเรขาคณิต', 'ค 2.2', 'ป.5/4', 'บอกลักษณะของปริซึม', 'final', 'ลักษณะและชนิดของปริซึม ส่วนประกอบ (ฐาน หน้า ขอบ มุม)', 'บอก, ระบุ, จำแนก', 6),
  ('Math_P5', 'สถิติและความน่าจะเป็น', 'ค 3.1', 'ป.5/2', 'เขียนแผนภูมิแท่งจากข้อมูลที่เป็นจำนวนนับ', 'final', 'การเขียนแผนภูมิแท่งเปรียบเทียบ การกำหนดมาตราส่วน', 'เขียน, นำเสนอ, สื่อสาร', 8)
ON CONFLICT DO NOTHING;

-- A Grade-5 maths teacher to drive the new course
INSERT INTO teachers (name, subjects) VALUES
  ('ครูพีรพงษ์ (คณิต ป.5)', ARRAY['Math_P5'])
ON CONFLICT DO NOTHING;
