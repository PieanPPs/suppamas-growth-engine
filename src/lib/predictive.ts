import { Student, StudentAssessment, CurriculumModule } from './types'

export interface RiskWarning {
  student: Student
  recentScores: number[]   // oldest → newest (last 3)
  trend: 'declining' | 'persistently-low'
  weakTags: string[]       // tags trending down
}

/**
 * Predictive AI Blockage Warning.
 * Flags a student if their last 3 academic scores are non-increasing AND
 * the latest is below the pass bar — i.e. sliding toward failure before
 * the mid-term exam. Also surfaces the academic tags pulling them down.
 */
export function computeAtRiskStudents(
  students: Student[],
  assessments: StudentAssessment[],
  modules: CurriculumModule[],
  minPoints = 3
): RiskWarning[] {
  const moduleMap = new Map(modules.map(m => [m.id, m]))
  const byStudent = new Map<string, StudentAssessment[]>()
  assessments.forEach(a => {
    if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, [])
    byStudent.get(a.student_id)!.push(a)
  })

  const warnings: RiskWarning[] = []

  for (const student of students) {
    const list = (byStudent.get(student.id) ?? []).sort(
      (a, b) => a.created_at.localeCompare(b.created_at)
    )
    if (list.length < minPoints) continue

    const last3 = list.slice(-3)
    const scores = last3.map(a => a.academic_score)
    const nonIncreasing = scores[0] >= scores[1] && scores[1] >= scores[2]
    const declining = nonIncreasing && scores[0] > scores[2]
    const persistentlyLow = scores.every(s => s < 1) // all 0
    if (!declining && !persistentlyLow) continue

    // tags appearing in the weak (latest) assessments
    const weakTags = new Set<string>()
    last3
      .filter(a => a.academic_score < 1)
      .forEach(a => moduleMap.get(a.module_id)?.academic_tags.forEach(t => weakTags.add(t)))

    warnings.push({
      student,
      recentScores: scores,
      trend: declining ? 'declining' : 'persistently-low',
      weakTags: Array.from(weakTags),
    })
  }

  return warnings
}
