// แผนซ่อมเสริมรายบุคคล: หาหน่วยที่เด็กอ่อน + สร้างพรอมต์ร่างแผนช่วยรายคน
// (Prompt Kit — ครู copy ไปวางในเว็บ AI ฟรี แล้วนำแผนที่ได้กลับมาบันทึกติดตามผล)
//
// PDPA: พรอมต์จงใจไม่ใส่ชื่อนักเรียน — ส่งไปเว็บ AI ภายนอกเฉพาะระดับชั้น
// หน่วยที่อ่อน และรูปแบบคะแนน ซึ่งระบุตัวเด็กไม่ได้

import { StudentAssessment, CurriculumModule } from './types'

export interface WeakModule {
  id: string
  title: string
  subject: string
  avg: number   // 0-2
  count: number // จำนวนครั้งที่ประเมิน
}

export interface RemediationPlan {
  id: string
  school_id: string
  student_id: string
  teacher_id: string | null
  weak_modules: WeakModule[]
  weak_tags: string[]
  baseline_avg: number | null
  plan_text: string | null
  status: 'active' | 'improved' | 'closed'
  follow_up_note: string | null
  created_at: string
  closed_at: string | null
}

/** หน่วยที่เด็กคนนี้คะแนนเฉลี่ยยังไม่ถึงเกณฑ์ผ่าน (< 1 จาก 2) เรียงจากอ่อนสุด
 *  ต้องส่ง assessments ที่ dedupe แล้ว (latestAssessmentPerPlan) เข้ามา */
export function computeWeakModules(
  studentId: string,
  assessments: StudentAssessment[],
  modules: CurriculumModule[],
): WeakModule[] {
  const moduleMap = new Map(modules.map(m => [m.id, m]))
  const buckets = new Map<string, number[]>()
  for (const a of assessments) {
    if (a.student_id !== studentId) continue
    if (!buckets.has(a.module_id)) buckets.set(a.module_id, [])
    buckets.get(a.module_id)!.push(a.academic_score)
  }
  const weak: WeakModule[] = []
  buckets.forEach((scores, moduleId) => {
    const mod = moduleMap.get(moduleId)
    if (!mod) return
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    if (avg < 1) weak.push({ id: mod.id, title: mod.title, subject: mod.subject, avg, count: scores.length })
  })
  return weak.sort((a, b) => a.avg - b.avg)
}

/** คะแนนเฉลี่ย (0-2) ของเด็กในชุดหน่วยที่กำหนด — ใช้ทั้งตอนตั้ง baseline
 *  และตอนติดตามผล (กรอง assessments ด้วย created_at ก่อนเรียกถ้าต้องการ "หลังเริ่มแผน") */
export function avgInModules(
  studentId: string,
  moduleIds: Set<string>,
  assessments: StudentAssessment[],
): { avg: number; count: number } | null {
  const scores = assessments
    .filter(a => a.student_id === studentId && moduleIds.has(a.module_id))
    .map(a => a.academic_score as number)
  if (scores.length === 0) return null
  return { avg: scores.reduce((s, v) => s + v, 0) / scores.length, count: scores.length }
}

export const REMEDIATION_APPROACHES: { key: string; label: string; desc: string; text: string }[] = [
  {
    key: 'oneonone',
    label: 'สอนเสริมตัวต่อตัว',
    desc: 'ครูติวช่วงพักเที่ยง/หลังเลิกเรียน',
    text: 'ครูสอนเสริมตัวต่อตัวช่วงสั้น ๆ (10-15 นาที) วันเว้นวัน เริ่มจากทบทวนพื้นฐานที่ขาด แล้วค่อยไต่ระดับ',
  },
  {
    key: 'peer',
    label: 'เพื่อนช่วยเพื่อน',
    desc: 'จับคู่บัดดี้กับเพื่อนที่แม่นเรื่องนี้',
    text: 'ระบบบัดดี้เพื่อนช่วยเพื่อน จับคู่กับเพื่อนที่ทำเรื่องนี้ได้ดี ให้ฝึกด้วยกันในชั่วโมงหรือช่วงกิจกรรม พร้อมวิธี brief เพื่อนผู้ช่วยว่าต้องช่วยแบบไหน (ให้ลองทำเอง ไม่ทำให้)',
  },
  {
    key: 'worksheet',
    label: 'ใบงานฝึกซ้ำแบบไต่ระดับ',
    desc: 'ฝึกทีละขั้นจากง่ายไปยาก',
    text: 'ชุดใบงานซ่อมเสริมแบบไต่ระดับ (scaffolding) เริ่มจากข้อที่มีตัวอย่างวิธีทำให้ดู แล้วลดตัวช่วยลงทีละขั้น ให้ระบุว่าแต่ละวันฝึกกี่ข้อ เรื่องอะไร',
  },
  {
    key: 'game',
    label: 'เกม/สื่อลงมือทำ',
    desc: 'เปลี่ยนเรื่องที่ติดเป็นกิจกรรมสนุก',
    text: 'กิจกรรมเกมหรือสื่อรูปธรรมที่ให้เด็กลงมือทำ (ใช้ของจริง บัตรภาพ บัตรคำ ฯลฯ ที่หาได้ในโรงเรียนไทย งบน้อย) เพื่อสร้างความเข้าใจผ่านการเล่นก่อนกลับไปทำแบบฝึก',
  },
  {
    key: 'parent',
    label: 'ผู้ปกครองช่วยที่บ้าน',
    desc: 'ภารกิจสั้น ๆ ฝึกกับผู้ปกครอง',
    text: 'ภารกิจฝึกที่บ้านกับผู้ปกครอง วันละไม่เกิน 10 นาที พร้อมคำแนะนำสำหรับผู้ปกครองที่เข้าใจง่าย (สมมติว่าผู้ปกครองไม่มีพื้นฐานวิชานี้)',
  },
]

export function buildRemediationPrompt(input: {
  grade: string            // เช่น 'ป.3/1' → ส่งเฉพาะระดับชั้น
  weakModules: WeakModule[]
  weakTags: string[]
  recentScores: number[]   // 3 ครั้งล่าสุด 0-2
  trend: 'declining' | 'persistently-low' | null
  durationWeeks: number
  approachTexts: string[]
  note: string
}): string {
  const gradeOnly = input.grade.split('/')[0] || input.grade
  const weakLines = input.weakModules
    .map(w => `- ${w.subject.replace('_', ' ')} เรื่อง "${w.title}" (คะแนนเฉลี่ย ${w.avg.toFixed(1)} จากเต็ม 2 — ยังไม่ผ่านเกณฑ์)`)
    .join('\n')
  const trendText = input.trend === 'declining'
    ? 'คะแนนประเมินรายคาบ 3 ครั้งล่าสุดลดลงต่อเนื่อง'
    : input.trend === 'persistently-low'
      ? 'คะแนนประเมินรายคาบต่ำต่อเนื่อง (ไม่ผ่านเกณฑ์ทุกครั้งใน 3 ครั้งล่าสุด)'
      : ''
  const approachBlock = input.approachTexts.length
    ? `\nแนวทางที่ครูเลือกใช้ (ออกแบบกิจกรรมให้อยู่ในกรอบนี้):\n${input.approachTexts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : ''

  return `คุณเป็นครูการศึกษาพิเศษ/ครูประจำชั้นผู้เชี่ยวชาญการสอนซ่อมเสริมนักเรียนประถมไทย
ช่วยร่าง "แผนซ่อมเสริมรายบุคคล" สำหรับนักเรียน 1 คน ให้ครูนำไปใช้ได้จริงทันที

ข้อมูลนักเรียน (ไม่ระบุตัวตน):
- ระดับชั้น: ${gradeOnly}
${trendText ? `- สัญญาณเตือน: ${trendText} (คะแนนล่าสุด: ${input.recentScores.join(' → ')} จากเต็ม 2)` : ''}
- เรื่องที่ยังไม่ผ่านเกณฑ์:
${weakLines || '- (ครูจะระบุเอง)'}
${input.weakTags.length ? `- มาตรฐาน/ทักษะที่อ่อน: ${input.weakTags.join(', ')}` : ''}
${approachBlock}
${input.note.trim() ? `\nข้อมูลเพิ่มเติมจากครู (สำคัญ ให้นำไปประกอบการออกแบบ): ${input.note.trim()}` : ''}

ระยะเวลาแผน: ${input.durationWeeks} สัปดาห์

ให้ตอบเป็นแผนซ่อมเสริมในรูปแบบหัวข้อดังนี้เท่านั้น (ขึ้นต้นแต่ละหัวข้อด้วย === ตามนี้เป๊ะ ๆ):
===เป้าหมายของแผน===
(เป้าหมายที่วัดได้จริงภายใน ${input.durationWeeks} สัปดาห์ 1-2 ข้อ)
===วิเคราะห์สาเหตุที่เป็นไปได้===
(สาเหตุที่เด็กมักติดในเรื่องเหล่านี้ 2-3 ข้อ พร้อมวิธีสังเกตว่าใช่สาเหตุไหน)
===กิจกรรมรายสัปดาห์===
(แจกแจงทีละสัปดาห์ สัปดาห์ละ 2-3 กิจกรรมสั้น ๆ ระบุเวลาโดยประมาณ ใช้สื่อที่หาได้ในโรงเรียนไทย)
===การวัดความก้าวหน้า===
(วิธีเช็คแบบเร็ว ๆ ท้ายสัปดาห์ว่าดีขึ้นหรือยัง ให้สอดคล้องกับการประเมินรายคาบที่ครูบันทึกอยู่แล้ว)
===สัญญาณที่ต้องส่งต่อ===
(ถ้าครบ ${input.durationWeeks} สัปดาห์แล้วยังไม่ดีขึ้น ควรทำอะไรต่อ เช่น คัดกรองเพิ่มเติม)

กฎสำคัญ: ภาษากระชับใช้ได้จริงในห้องเรียนไทย ห้ามแต่งข้อมูลนักเรียนเพิ่ม ตอบเป็นแผนล้วน ๆ ไม่ต้องมีคำนำ/คำลงท้าย`
}
