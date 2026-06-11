import { StudentAssessment, HomeworkSubmission } from './types'

// ---- คุณลักษณะอันพึงประสงค์ 8 ข้อ (หลักสูตรแกนกลาง 2551) ----
export const TRAIT_ITEMS = [
  { no: 1, name: 'รักชาติ ศาสน์ กษัตริย์', short: 'รักชาติฯ', auto: false },
  { no: 2, name: 'ซื่อสัตย์สุจริต', short: 'ซื่อสัตย์', auto: false },
  { no: 3, name: 'มีวินัย', short: 'มีวินัย', auto: true },
  { no: 4, name: 'ใฝ่เรียนรู้', short: 'ใฝ่เรียนรู้', auto: true },
  { no: 5, name: 'อยู่อย่างพอเพียง', short: 'พอเพียง', auto: false },
  { no: 6, name: 'มุ่งมั่นในการทำงาน', short: 'มุ่งมั่น', auto: true },
  { no: 7, name: 'รักความเป็นไทย', short: 'รักไทย', auto: false },
  { no: 8, name: 'มีจิตสาธารณะ', short: 'จิตสาธารณะ', auto: true },
] as const

export const LEVEL_LABELS: Record<number, string> = {
  3: 'ดีเยี่ยม', 2: 'ดี', 1: 'ผ่าน', 0: 'ไม่ผ่าน',
}

export const LEVEL_COLORS: Record<number, string> = {
  3: 'bg-green-100 text-green-700',
  2: 'bg-sky-100 text-sky-700',
  1: 'bg-yellow-100 text-yellow-700',
  0: 'bg-red-100 text-red-600',
}

/** หลักฐานพฤติกรรมของนักเรียน 1 คน (กรองเฉพาะวิชาของ ปพ.5 เล่มนั้น) */
export interface TraitEvidence {
  onTimePct: number | null   // % ส่งงานตรงเวลา
  greenPct: number | null    // % สมาธิเขียว
  softAvg: number | null     // ทักษะสังคมเฉลี่ย 0-2
  soft2Pct: number | null    // % ครั้งที่ "ร่วม+ช่วยเพื่อน" (ระดับ 2)
  academicAvg: number | null // ดาวเฉลี่ย 0-2
  attendancePct: number | null // % มาเรียน (โดยประมาณจากวันที่มีการประเมิน)
}

export function buildEvidence(
  studentId: string,
  subject: string,
  assessments: StudentAssessment[],
  homework: HomeworkSubmission[],
  moduleSubject: Map<string, string>,
  attendancePct: number | null = null
): TraitEvidence {
  const asm = assessments.filter(a => a.student_id === studentId && moduleSubject.get(a.module_id) === subject)
  const hw = homework.filter(h => h.student_id === studentId && moduleSubject.get(h.module_id) === subject)
  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : null
  return {
    onTimePct: pct(hw.filter(h => h.status === 'On_Time').length, hw.length),
    greenPct: pct(asm.filter(a => a.focus_color === 'Green').length, asm.length),
    softAvg: asm.length ? +(asm.reduce((s, a) => s + a.soft_skill_score, 0) / asm.length).toFixed(2) : null,
    soft2Pct: pct(asm.filter(a => a.soft_skill_score === 2).length, asm.length),
    academicAvg: asm.length ? +(asm.reduce((s, a) => s + a.academic_score, 0) / asm.length).toFixed(2) : null,
    attendancePct,
  }
}

/**
 * ระดับที่ระบบ "เสนอ" จากข้อมูลจริง — ครูยืนยัน/ปรับเองได้เสมอ
 * เสนอต่ำสุดแค่ "ผ่าน" (1) — "ไม่ผ่าน" เป็นดุลยพินิจครูเท่านั้น
 */
export function suggestTrait(itemNo: number, ev: TraitEvidence): number {
  switch (itemNo) {
    case 3: { // มีวินัย ← วินัยการส่งงาน + การมาเรียน (ใช้ค่าต่ำสุดของสองด้าน)
      const cands: number[] = []
      if (ev.onTimePct != null) cands.push(ev.onTimePct >= 90 ? 3 : ev.onTimePct >= 70 ? 2 : 1)
      if (ev.attendancePct != null) cands.push(ev.attendancePct >= 95 ? 3 : ev.attendancePct >= 85 ? 2 : 1)
      return cands.length ? Math.min(...cands) : 2
    }
    case 4: // ใฝ่เรียนรู้ ← สมาธิจดจ่อในคาบ
      if (ev.greenPct == null) return 2
      return ev.greenPct >= 70 ? 3 : ev.greenPct >= 40 ? 2 : 1
    case 6: // มุ่งมั่นในการทำงาน ← การมีส่วนร่วมกิจกรรม
      if (ev.softAvg == null) return 2
      return ev.softAvg >= 1.5 ? 3 : ev.softAvg >= 1.0 ? 2 : 1
    case 8: // มีจิตสาธารณะ ← ช่วยเหลือแบ่งปันเพื่อน
      if (ev.soft2Pct == null) return 2
      return ev.soft2Pct >= 50 ? 3 : ev.soft2Pct >= 20 ? 2 : 1
    default: // ไม่มีสัญญาณจากข้อมูล → เสนอ "ดี" ให้ครูปรับ
      return 2
  }
}

/** อ่าน คิดวิเคราะห์ และเขียน ← ผลการเรียนรู้เฉลี่ย */
export function suggestRwa(ev: TraitEvidence): number {
  if (ev.academicAvg == null) return 2
  return ev.academicAvg >= 1.5 ? 3 : ev.academicAvg >= 1.0 ? 2 : 1
}

/** คำอธิบายหลักฐานที่ระบบใช้เสนอ (โชว์ให้ครู/กรรมการเห็นความโปร่งใส) */
export function evidenceNote(itemNo: number, ev: TraitEvidence): string | null {
  switch (itemNo) {
    case 3: {
      const parts = []
      if (ev.onTimePct != null) parts.push(`ส่งงานตรงเวลา ${ev.onTimePct}%`)
      if (ev.attendancePct != null) parts.push(`มาเรียน ~${ev.attendancePct}%`)
      return parts.length ? parts.join(' · ') : null
    }
    case 4: return ev.greenPct != null ? `สมาธิ 🟢 ${ev.greenPct}%` : null
    case 6: return ev.softAvg != null ? `ทักษะสังคมเฉลี่ย ${ev.softAvg}/2` : null
    case 8: return ev.soft2Pct != null ? `ช่วยเพื่อน ${ev.soft2Pct}% ของคาบ` : null
    default: return null
  }
}
