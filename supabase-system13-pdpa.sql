-- =============================================================
-- System 13: PDPA — ปิดการอ่านสาธารณะของ teachers.pin และ students.national_id
--
-- ปัญหาเดิม: anon key ฝังใน JS bundle ของเว็บ → ใครก็ตามที่เปิดเว็บสามารถ
-- SELECT pin ครูทุกคน (= ยึด session ใครก็ได้) และเลขบัตรประชาชนนักเรียนทุกคนได้
--
-- แนวทาง: ย้ายข้อมูลอ่อนไหวไปตารางแยกที่ "ไม่มี RLS policy เลย"
-- (RLS เปิด + ไม่มี policy = อ่าน/เขียนตรงไม่ได้ทุกกรณี) แล้วเจาะช่องใช้งาน
-- ที่จำเป็นผ่าน RPC แบบ SECURITY DEFINER ทีละงาน:
--   login_with_pin        เช็ค PIN ตอนเข้าสู่ระบบ (ไม่คืนค่า PIN)
--   set_teacher_pin       ตั้ง/รีเซ็ต PIN (บังคับ 4-8 หลัก + ห้ามซ้ำกันในโรงเรียน)
--   teacher_ids_with_pin  หน้า admin โชว์ว่าใคร "ตั้ง PIN แล้ว" (ไม่โชว์ตัว PIN — ระบบใหม่ดูรหัสย้อนหลังไม่ได้ ลืมต้องรีเซ็ต)
--   match_national_ids    หน้า import เช็คว่าเลขบัตรไหนมีอยู่แล้ว (ส่ง list เข้าไปเช็ค ไม่มีทาง dump ทั้งตาราง)
--   import_students       นำเข้า/อัปเดตนักเรียนจับคู่ด้วยเลขบัตร (ทำงานฝั่ง DB ทั้งหมด)
--
-- หมายเหตุ: การ "เขียน" ผ่าน RPC ยังเปิดให้ทุกคนที่มี anon key เท่ากับสภาพเดิม
-- ของตาราง students/teachers (RLS แบบ permissive) — การล็อกสิทธิ์เขียนจริงต้องรอ
-- Supabase Auth + JWT school claim ใน Phase 3 ก่อนเปิดโรงเรียนที่ 2
--
-- อนาคต (รหัสครอบครัวสำหรับลิงก์ผู้ปกครอง): national_id อยู่ใน student_private แล้ว
-- ค่อยเพิ่ม RPC verify_family_code(student_id, code) ที่ derive จาก national_id ภายหลัง
--
-- รันซ้ำได้ปลอดภัย (idempotent) — รันใน Supabase SQL Editor
-- =============================================================

-- ---- 1. ตารางลับ: RLS เปิด + ไม่มี policy = anon แตะตรงไม่ได้เลย ----
CREATE TABLE IF NOT EXISTS teacher_pins (
  teacher_id UUID PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE teacher_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON teacher_pins FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS student_private (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  national_id TEXT UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE student_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_private FROM anon, authenticated;

-- ---- 2. ย้ายข้อมูลเดิมเข้าตารางลับ แล้วลบคอลัมน์ที่เปิดสาธารณะทิ้ง ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'pin') THEN
    INSERT INTO teacher_pins (teacher_id, pin)
      SELECT id, pin FROM teachers WHERE pin IS NOT NULL AND pin <> ''
      ON CONFLICT (teacher_id) DO NOTHING;
    ALTER TABLE teachers DROP COLUMN pin;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'national_id') THEN
    INSERT INTO student_private (student_id, national_id)
      SELECT id, national_id FROM students WHERE national_id IS NOT NULL AND national_id <> ''
      ON CONFLICT (student_id) DO NOTHING;
    -- unique constraint เดิมบน students.national_id หายไปพร้อมคอลัมน์ —
    -- การจับคู่ตอน import ย้ายไปทำใน RPC import_students แทน
    ALTER TABLE students DROP COLUMN national_id;
  END IF;
END $$;

-- ---- 3. RPC ----

-- เข้าสู่ระบบ: คืนข้อมูลครูเมื่อ PIN ถูก, แถวว่างเมื่อผิด (ไม่มีทางอ่าน PIN ออกไป)
CREATE OR REPLACE FUNCTION login_with_pin(p_school_id UUID, p_pin TEXT)
RETURNS TABLE (id UUID, name TEXT, role TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.name, t.role
  FROM teachers t
  JOIN teacher_pins tp ON tp.teacher_id = t.id
  WHERE t.school_id = p_school_id AND tp.pin = p_pin
  LIMIT 1
$$;

-- ตั้ง/รีเซ็ต PIN — บังคับตัวเลข 4-8 หลัก และห้ามซ้ำกับครูคนอื่นในโรงเรียนเดียวกัน
-- (PIN ซ้ำทำให้ login แยกคนไม่ได้)
CREATE OR REPLACE FUNCTION set_teacher_pin(p_teacher_id UUID, p_pin TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school UUID;
BEGIN
  IF p_pin !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'PIN_INVALID';
  END IF;
  SELECT school_id INTO v_school FROM teachers WHERE teachers.id = p_teacher_id;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'TEACHER_NOT_FOUND';
  END IF;
  IF EXISTS (
    SELECT 1 FROM teacher_pins tp
    JOIN teachers t ON t.id = tp.teacher_id
    WHERE t.school_id = v_school AND tp.pin = p_pin AND tp.teacher_id <> p_teacher_id
  ) THEN
    RAISE EXCEPTION 'PIN_TAKEN';
  END IF;
  INSERT INTO teacher_pins (teacher_id, pin, updated_at)
  VALUES (p_teacher_id, p_pin, now())
  ON CONFLICT (teacher_id) DO UPDATE SET pin = EXCLUDED.pin, updated_at = now();
END $$;

-- หน้า admin: ครูคนไหน "ตั้ง PIN แล้ว" (คืนแค่ id — ไม่คืนตัว PIN)
CREATE OR REPLACE FUNCTION teacher_ids_with_pin(p_school_id UUID)
RETURNS TABLE (teacher_id UUID)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT tp.teacher_id
  FROM teacher_pins tp
  JOIN teachers t ON t.id = tp.teacher_id
  WHERE t.school_id = p_school_id
$$;

-- หน้า import: เลขบัตรชุดที่ส่งมา เลขไหนมีในระบบแล้ว (intersection เท่านั้น —
-- ผู้เรียกต้องมีเลขบัตรในมืออยู่แล้ว จึงไม่เปิดข้อมูลใหม่)
CREATE OR REPLACE FUNCTION match_national_ids(p_school_id UUID, p_ids TEXT[])
RETURNS TABLE (national_id TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT sp.national_id
  FROM student_private sp
  JOIN students s ON s.id = sp.student_id
  WHERE s.school_id = p_school_id AND sp.national_id = ANY(p_ids)
$$;

-- นำเข้ารายชื่อนักเรียน: จับคู่ด้วยเลขบัตร → อัปเดต, ไม่พบ → เพิ่มใหม่
-- แถวที่ไม่มีเลขบัตรจะเพิ่มใหม่เสมอ (พฤติกรรมเดิมของหน้า import)
CREATE OR REPLACE FUNCTION import_students(p_school_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r JSONB;
  v_nid TEXT;
  v_student UUID;
  v_added INT := 0;
  v_updated INT := 0;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_nid := NULLIF(trim(r->>'national_id'), '');
    v_student := NULL;
    IF v_nid IS NOT NULL THEN
      SELECT sp.student_id INTO v_student
      FROM student_private sp
      JOIN students s ON s.id = sp.student_id
      WHERE s.school_id = p_school_id AND sp.national_id = v_nid;
    END IF;

    IF v_student IS NOT NULL THEN
      UPDATE students SET
        student_number = COALESCE(NULLIF(r->>'student_number', ''), student_number),
        name           = COALESCE(NULLIF(r->>'name', ''), name),
        class_name     = COALESCE(NULLIF(r->>'class_name', ''), class_name),
        birth_date     = COALESCE(NULLIF(r->>'birth_date', ''), birth_date),
        status         = COALESCE(NULLIF(r->>'status', ''), status),
        gender         = COALESCE(NULLIF(r->>'gender', ''), gender)
      WHERE id = v_student;
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO students (school_id, student_number, name, class_name, birth_date, status, gender)
      VALUES (
        p_school_id,
        NULLIF(r->>'student_number', ''),
        r->>'name',
        NULLIF(r->>'class_name', ''),
        NULLIF(r->>'birth_date', ''),
        NULLIF(r->>'status', ''),
        NULLIF(r->>'gender', '')
      )
      RETURNING id INTO v_student;
      IF v_nid IS NOT NULL THEN
        INSERT INTO student_private (student_id, national_id)
        VALUES (v_student, v_nid)
        ON CONFLICT (student_id) DO UPDATE SET national_id = EXCLUDED.national_id, updated_at = now();
      END IF;
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('added', v_added, 'updated', v_updated);
END $$;

GRANT EXECUTE ON FUNCTION login_with_pin(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_teacher_pin(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_ids_with_pin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_national_ids(UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION import_students(UUID, JSONB) TO anon, authenticated;
