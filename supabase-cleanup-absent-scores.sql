-- =============================================================
-- Cleanup: ลบคะแนน exit ticket ที่ถูกบันทึกผิดพลาดให้นักเรียนที่ขาด/ป่วย/ลา
-- ในวันเดียวกับที่บันทึกคะแนน (เกิดจากบั๊กที่ "ใช้กับทั้งห้อง"/"บันทึกทั้งหมด"
-- ไม่เคยเช็คสถานะการมาเรียนก่อนหน้านี้ — แก้โค้ดแล้วในคอมมิต 2ce9361)
--
-- รันเป็น 2 ขั้นตอน ห้ามข้ามขั้นตอนที่ 1
-- =============================================================

-- ── ขั้นตอนที่ 1: ตรวจสอบก่อน — ดูว่าจะกระทบกี่แถว เป็นของใครบ้าง ──
SELECT
  sa.id, s.name, s.class_name, a.status AS attendance_status,
  sa.academic_score, sa.focus_color, sa.soft_skill_score,
  sa.created_at::date AS assessed_date
FROM student_assessments sa
JOIN students s ON s.id = sa.student_id
JOIN attendance a
  ON a.student_id = sa.student_id
  AND a.date = sa.created_at::date
WHERE a.status IN ('absent', 'sick', 'leave')
ORDER BY sa.created_at DESC;

-- ── ขั้นตอนที่ 2: ลบทั้งหมดที่ตรวจสอบแล้วว่าผิด ──
-- รันเฉพาะเมื่อดูผลลัพธ์ขั้นตอนที่ 1 แล้วมั่นใจว่าถูกต้องทุกแถว (ลบไม่ได้ ย้อนคืนไม่ได้)
-- ลบ comment (--) ออกจาก 5 บรรทัดด้านล่างแล้วรัน:

-- DELETE FROM student_assessments sa
-- USING attendance a
-- WHERE a.student_id = sa.student_id
--   AND a.date = sa.created_at::date
--   AND a.status IN ('absent', 'sick', 'leave');

-- ถ้าอยากลบเฉพาะบางแถว (ไม่ใช่ทั้งหมด) ให้ใช้แบบนี้แทน โดยใส่ id จากขั้นตอนที่ 1:
-- DELETE FROM student_assessments WHERE id IN ('uuid-1', 'uuid-2');
