import { AssessmentMethod } from './types'

export const ASSESSMENT_METHODS: { key: AssessmentMethod; label: string; desc: string }[] = [
  { key: 'exit_ticket', label: 'Exit ticket', desc: 'ให้ตอบคำถามสั้นท้ายคาบ (บันทึกใน student_assessments)' },
  { key: 'observation', label: 'สังเกตพฤติกรรม', desc: 'ครูสังเกตระหว่างทำกิจกรรม (บันทึกใน student_assessments)' },
  { key: 'quiz', label: 'แบบทดสอบ/ข้อสอบ', desc: 'ทำแบบทดสอบให้คะแนน (ผูกกับหน้าแบบทดสอบ)' },
  { key: 'homework', label: 'ชิ้นงาน/การบ้าน', desc: 'ให้ทำชิ้นงานส่ง (บันทึกใน homework_tasks)' },
]

export function buildAssessmentPlanPrompt(input: {
  topic: string
  subject: string | null
  grade: string | null
  indicators: string
  methodLabels: string[]
}): string {
  return `คุณเป็นครูผู้เชี่ยวชาญด้านการวัดและประเมินผลการเรียนรู้
ช่วยออกแบบแผนการประเมินผู้เรียนสำหรับแผนการสอนนี้ ให้ใช้งานได้จริงในห้องเรียน

ข้อมูลบทเรียน:
- รายวิชา: ${input.subject ?? ''} ชั้น ${input.grade ?? ''}
- เรื่อง: ${input.topic}
- ตัวชี้วัดที่ต้องการวัด: ${input.indicators || '(ไม่ระบุ ให้ประเมินจากชื่อเรื่อง)'}
- วิธีประเมินที่เลือกใช้: ${input.methodLabels.join(', ') || '(ยังไม่เลือก แนะนำวิธีที่เหมาะสมด้วย)'}

ช่วยตอบกลับเป็น:
1) คำถาม/ประเด็นที่ควรใช้ประเมินตามวิธีที่เลือก (2-4 ข้อ)
2) เกณฑ์การให้คะแนนหรือเกณฑ์ผ่าน แบบสั้น กระชับ ใช้ได้จริง (ระบุ 3 ระดับ: ผ่านดี/ผ่าน/ควรปรับปรุง)
ตอบเป็นภาษาไทย กระชับ ไม่ต้องมีคำนำหรือคำลงท้าย`
}
