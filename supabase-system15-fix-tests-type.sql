-- ============================================================
-- System 15: แก้ tests.type constraint ให้รองรับ 'formative'
--
-- ตอนเพิ่ม "แบบทดสอบระหว่างเรียน" (formative) เข้าไปในหน้าเว็บ (src/lib/types.ts,
-- src/app/teacher/tests/page.tsx) ไม่เคยอัปเดต CHECK constraint ในฐานข้อมูลให้ตรงกัน
-- (supabase-system8-tests.sql เดิมอนุญาตแค่ quiz/midterm/final/mock_nt) — ทุกครั้งที่มีคน
-- เลือก formative ตอนสร้างหรือแก้ไขแบบทดสอบ ฐานข้อมูลจึงปฏิเสธด้วย error
-- "violates check constraint tests_type_check" รันไฟล์นี้ครั้งเดียวเพื่อแก้
-- ============================================================

ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_type_check;
ALTER TABLE tests ADD CONSTRAINT tests_type_check
  CHECK (type IN ('quiz', 'formative', 'midterm', 'final', 'mock_nt'));
