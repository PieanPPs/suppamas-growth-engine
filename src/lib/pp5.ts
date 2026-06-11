import {
  ScoreComponent, ComponentScore, Test, TestScore, StudentAssessment, CurriculumModule, ScorePhase,
} from './types'

// ---- เกณฑ์ตัดเกรด 8 ระดับ (มาตรฐาน สพฐ.) ----
export function gradeFromTotal(total: number): number {
  if (total >= 80) return 4
  if (total >= 75) return 3.5
  if (total >= 70) return 3
  if (total >= 65) return 2.5
  if (total >= 60) return 2
  if (total >= 55) return 1.5
  if (total >= 50) return 1
  return 0
}

export const GRADE_COLORS: Record<string, string> = {
  '4': 'bg-green-100 text-green-700',
  '3.5': 'bg-teal-100 text-teal-700',
  '3': 'bg-sky-100 text-sky-700',
  '2.5': 'bg-blue-100 text-blue-700',
  '2': 'bg-yellow-100 text-yellow-700',
  '1.5': 'bg-amber-100 text-amber-700',
  '1': 'bg-orange-100 text-orange-700',
  '0': 'bg-red-100 text-red-700',
}

export const PHASE_LABEL: Record<ScorePhase, string> = {
  before_mid: 'ก่อนกลางภาค',
  after_mid: 'หลังกลางภาค',
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
}

export const PHASE_ORDER: ScorePhase[] = ['before_mid', 'midterm', 'after_mid', 'final']

/** มาตรฐานโรงเรียน 70:30 — เก็บ 50 + กลางภาค 20 + ปลายภาค 30 */
export function defaultStructure(subject: string): Omit<ScoreComponent, 'id'>[] {
  return [
    { subject, name: 'คะแนนเก็บช่วงที่ 1', max_score: 25, phase: 'before_mid', source: 'manual', test_id: null, sequence_order: 1 },
    { subject, name: 'กลางภาค', max_score: 20, phase: 'midterm', source: 'test', test_id: null, sequence_order: 2 },
    { subject, name: 'คะแนนเก็บช่วงที่ 2', max_score: 25, phase: 'after_mid', source: 'manual', test_id: null, sequence_order: 3 },
    { subject, name: 'ปลายภาค', max_score: 30, phase: 'final', source: 'test', test_id: null, sequence_order: 4 },
  ]
}

export interface Pp5Cell {
  componentId: string
  value: number | null
  auto: boolean // true = คำนวณจากระบบ (test/ดาว) แก้ในตารางไม่ได้
}

export interface Pp5Row {
  studentId: string
  cells: Pp5Cell[]
  collectTotal: number   // เก็บ (before+after)
  midterm: number
  final: number
  total: number
  grade: number
  complete: boolean      // ทุกช่องมีค่า
}

/**
 * คำนวณค่าของช่อง auto:
 * - source 'test'  → คะแนนสอบจริง × (เต็มช่อง / เต็มข้อสอบ)
 * - source 'stars' → ค่าเฉลี่ยดาว Exit Ticket ของวิชา (0-2) × เต็มช่อง / 2
 */
export function computeAutoValue(
  component: ScoreComponent,
  studentId: string,
  tests: Test[],
  testScores: TestScore[],
  assessments: StudentAssessment[],
  moduleSubject: Map<string, string>
): number | null {
  if (component.source === 'test') {
    if (!component.test_id) return null
    const test = tests.find(t => t.id === component.test_id)
    if (!test || test.max_score <= 0) return null
    const sc = testScores.find(s => s.test_id === component.test_id && s.student_id === studentId)
    if (!sc) return null
    return +(Math.min(1, sc.score / test.max_score) * component.max_score).toFixed(1)
  }
  if (component.source === 'stars') {
    const list = assessments.filter(
      a => a.student_id === studentId && moduleSubject.get(a.module_id) === component.subject
    )
    if (list.length === 0) return null
    const avg = list.reduce((s, a) => s + a.academic_score, 0) / list.length // 0-2
    return +((avg / 2) * component.max_score).toFixed(1)
  }
  return null
}

export function buildPp5Row(
  studentId: string,
  components: ScoreComponent[],
  manualScores: Map<string, number>, // key `${componentId}_${studentId}`
  tests: Test[],
  testScores: TestScore[],
  assessments: StudentAssessment[],
  moduleSubject: Map<string, string>
): Pp5Row {
  const cells: Pp5Cell[] = components.map(c => {
    const auto = c.source !== 'manual'
    const value = auto
      ? computeAutoValue(c, studentId, tests, testScores, assessments, moduleSubject)
      : manualScores.get(`${c.id}_${studentId}`) ?? null
    return { componentId: c.id, value, auto }
  })

  const sumPhase = (phases: ScorePhase[]) =>
    components.reduce((sum, c, i) => {
      if (!phases.includes(c.phase)) return sum
      return sum + (cells[i].value ?? 0)
    }, 0)

  const collectTotal = +sumPhase(['before_mid', 'after_mid']).toFixed(1)
  const midterm = +sumPhase(['midterm']).toFixed(1)
  const final = +sumPhase(['final']).toFixed(1)
  const total = +(collectTotal + midterm + final).toFixed(1)

  return {
    studentId,
    cells,
    collectTotal,
    midterm,
    final,
    total,
    grade: gradeFromTotal(total),
    complete: cells.every(c => c.value != null),
  }
}
