import { Student, StudentAssessment, HomeworkSubmission } from './types'

export interface HeroScore {
  student: Student
  academicPoints: number
  softSkillPoints: number
  focusPoints: number
  homeworkPoints: number
  total: number
  assessmentCount: number
}

/**
 * "Suppamas Hero" points — accumulates across all data so far.
 * academic ★ (0-2) + soft skill ★ (0-2) + focus (Green=2/Yellow=1/Red=0)
 * + homework (On_Time=3 / Late=1 / Missing=0).
 */
export function computeHeroScores(
  students: Student[],
  assessments: StudentAssessment[],
  homework: HomeworkSubmission[]
): HeroScore[] {
  const focusPts = { Green: 2, Yellow: 1, Red: 0 }
  const hwPts = { On_Time: 3, Late: 1, Missing: 0 }

  const byStudent = new Map<string, StudentAssessment[]>()
  assessments.forEach(a => {
    if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, [])
    byStudent.get(a.student_id)!.push(a)
  })
  const hwByStudent = new Map<string, HomeworkSubmission[]>()
  homework.forEach(h => {
    if (!hwByStudent.has(h.student_id)) hwByStudent.set(h.student_id, [])
    hwByStudent.get(h.student_id)!.push(h)
  })

  return students
    .map(student => {
      const list = byStudent.get(student.id) ?? []
      const hw = hwByStudent.get(student.id) ?? []
      const academicPoints = list.reduce((s, a) => s + a.academic_score, 0)
      const softSkillPoints = list.reduce((s, a) => s + a.soft_skill_score, 0)
      const focusPoints = list.reduce((s, a) => s + focusPts[a.focus_color], 0)
      const homeworkPoints = hw.reduce((s, h) => s + hwPts[h.status], 0)
      return {
        student,
        academicPoints,
        softSkillPoints,
        focusPoints,
        homeworkPoints,
        total: academicPoints + softSkillPoints + focusPoints + homeworkPoints,
        assessmentCount: list.length,
      }
    })
    .sort((a, b) => b.total - a.total)
}
