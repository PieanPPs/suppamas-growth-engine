-- ============================================================
-- System 11: ปพ.5 Phase 2 — เช็คชื่อ + คุณลักษณะอันพึงประสงค์
-- Run AFTER supabase-system10-pp5.sql
-- ============================================================

-- ---- 1. เช็คชื่อ (exception-based: บันทึกเฉพาะคนที่ "ไม่มา") ----
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('absent', 'sick', 'leave', 'late')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, date)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Public insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update attendance" ON attendance FOR UPDATE USING (true);
CREATE POLICY "Public delete attendance" ON attendance FOR DELETE USING (true);

-- ---- 2. คุณลักษณะอันพึงประสงค์ 8 ข้อ + อ่านคิดวิเคราะห์เขียน (รายวิชา) ----
-- kind 'trait' → item_no 1-8 · kind 'rwa' → item_no 0 (สรุปรวม)
-- level: 3 ดีเยี่ยม / 2 ดี / 1 ผ่าน / 0 ไม่ผ่าน
CREATE TABLE IF NOT EXISTS trait_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('trait', 'rwa')),
  item_no INT NOT NULL DEFAULT 0,
  level NUMERIC NOT NULL CHECK (level >= 0 AND level <= 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, subject, kind, item_no)
);
ALTER TABLE trait_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trait_ratings" ON trait_ratings FOR SELECT USING (true);
CREATE POLICY "Public insert trait_ratings" ON trait_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update trait_ratings" ON trait_ratings FOR UPDATE USING (true);
CREATE POLICY "Public delete trait_ratings" ON trait_ratings FOR DELETE USING (true);
