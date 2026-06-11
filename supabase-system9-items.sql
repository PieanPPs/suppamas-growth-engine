-- ============================================================
-- System 9: คลังข้อสอบรายข้อ (Prompt Kit + นำเข้าจากเว็บ AI)
-- Run AFTER supabase-system8-tests.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS test_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  item_no INT NOT NULL,
  question TEXT NOT NULL,
  choice_a TEXT,
  choice_b TEXT,
  choice_c TEXT,
  choice_d TEXT,
  answer TEXT,              -- 'ก' | 'ข' | 'ค' | 'ง'
  indicator_code TEXT,      -- เช่น 'ป.5/3' (จับคู่ตามรหัส ไม่บังคับ FK)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (test_id, item_no)
);
ALTER TABLE test_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read test_items" ON test_items FOR SELECT USING (true);
CREATE POLICY "Public insert test_items" ON test_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update test_items" ON test_items FOR UPDATE USING (true);
CREATE POLICY "Public delete test_items" ON test_items FOR DELETE USING (true);
