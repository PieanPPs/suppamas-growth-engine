-- ============================================================
-- System 8: ระบบแบบทดสอบ (Summative Tests)
-- สอบเก็บคะแนน / กลางภาค / ปลายภาค / Pre-NT — แยกจาก Exit Ticket
-- Run AFTER supabase-system7-teacher-rooms.sql
-- ============================================================

-- ---- 1. Tests (ชุดข้อสอบ) ----
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,                 -- courses.subject_key
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quiz', 'midterm', 'final', 'mock_nt')),
  max_score NUMERIC NOT NULL CHECK (max_score > 0),
  test_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tests" ON tests FOR SELECT USING (true);
CREATE POLICY "Public insert tests" ON tests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tests" ON tests FOR UPDATE USING (true);
CREATE POLICY "Public delete tests" ON tests FOR DELETE USING (true);

-- ---- 2. Test ↔ Indicator (ข้อสอบ 1 ฉบับครอบหลายตัวชี้วัด) ----
CREATE TABLE IF NOT EXISTS test_indicators (
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  PRIMARY KEY (test_id, indicator_id)
);
ALTER TABLE test_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read test_indicators" ON test_indicators FOR SELECT USING (true);
CREATE POLICY "Public insert test_indicators" ON test_indicators FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete test_indicators" ON test_indicators FOR DELETE USING (true);

-- ---- 3. Scores (1 รายการ/นักเรียน/ข้อสอบ — กรอกซ้ำ = แก้ทับ) ----
CREATE TABLE IF NOT EXISTS test_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (test_id, student_id)
);
ALTER TABLE test_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read test_scores" ON test_scores FOR SELECT USING (true);
CREATE POLICY "Public insert test_scores" ON test_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update test_scores" ON test_scores FOR UPDATE USING (true);
CREATE POLICY "Public delete test_scores" ON test_scores FOR DELETE USING (true);
