-- ============================================================
-- System 10: เครื่องคะแนน ปพ.5 (Phase 1)
-- โครงสร้างคะแนนรายวิชา + ช่องคะแนนที่ดึงจากระบบเดิมอัตโนมัติ
-- Run AFTER supabase-system9-items.sql
-- ============================================================

-- ---- 1. ช่องคะแนน (เช่น Workbook 10, กลางภาค 20, ปลายภาค 30) ----
CREATE TABLE IF NOT EXISTS score_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,                  -- courses.subject_key
  name TEXT NOT NULL,
  max_score NUMERIC NOT NULL CHECK (max_score > 0),
  phase TEXT NOT NULL CHECK (phase IN ('before_mid', 'after_mid', 'midterm', 'final')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'test', 'stars')),
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,   -- เมื่อ source='test'
  sequence_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE score_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read score_components" ON score_components FOR SELECT USING (true);
CREATE POLICY "Public insert score_components" ON score_components FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update score_components" ON score_components FOR UPDATE USING (true);
CREATE POLICY "Public delete score_components" ON score_components FOR DELETE USING (true);

-- ---- 2. คะแนนรายช่อง (เฉพาะช่อง manual — ช่อง auto คำนวณสด) ----
CREATE TABLE IF NOT EXISTS component_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES score_components(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (component_id, student_id)
);
ALTER TABLE component_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read component_scores" ON component_scores FOR SELECT USING (true);
CREATE POLICY "Public insert component_scores" ON component_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update component_scores" ON component_scores FOR UPDATE USING (true);
CREATE POLICY "Public delete component_scores" ON component_scores FOR DELETE USING (true);
