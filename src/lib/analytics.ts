import { CurriculumModule, StudentAssessment, FocusColor, Student } from './types'

export type TagScore = { tag: string; avgScore: number; count: number }

/**
 * Build per-tag average academic scores for a single student's assessments.
 * Each assessment contributes its academic_score to every tag on its module.
 */
export function buildStudentTagScores(
  assessments: StudentAssessment[],
  moduleMap: Map<string, CurriculumModule>
): TagScore[] {
  const tagBuckets = new Map<string, number[]>()

  for (const a of assessments) {
    const mod = moduleMap.get(a.module_id)
    if (!mod) continue
    for (const tag of mod.academic_tags) {
      if (!tagBuckets.has(tag)) tagBuckets.set(tag, [])
      tagBuckets.get(tag)!.push(a.academic_score)
    }
  }

  return Array.from(tagBuckets.entries())
    .map(([tag, scores]) => ({
      tag,
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

/**
 * Per-subject focus consistency (behavioral radar).
 * Focus mapped to points: Green=2, Yellow=1, Red=0, averaged per subject.
 */
export function buildBehaviorSubjectScores(
  assessments: StudentAssessment[],
  moduleMap: Map<string, CurriculumModule>
): TagScore[] {
  const focusPts: Record<FocusColor, number> = { Green: 2, Yellow: 1, Red: 0 }
  const buckets = new Map<string, number[]>()

  for (const a of assessments) {
    const mod = moduleMap.get(a.module_id)
    if (!mod) continue
    const subject = mod.subject.replace('_', ' ')
    if (!buckets.has(subject)) buckets.set(subject, [])
    buckets.get(subject)!.push(focusPts[a.focus_color])
  }

  return Array.from(buckets.entries())
    .map(([tag, scores]) => ({
      tag,
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

/** Split a student's per-tag scores into top/bottom N (no overlap) so a UI can show
 *  explicit "strong at X / weak at Y" text instead of making the reader interpret a
 *  radar chart — especially useful once many tags have accumulated over months. */
export function splitStrengthsWeaknesses(tagScores: TagScore[], topN = 3): { strengths: TagScore[]; weaknesses: TagScore[] } {
  const sorted = [...tagScores].sort((a, b) => b.avgScore - a.avgScore)
  const strengths = sorted.slice(0, topN)
  const weakStart = Math.max(topN, sorted.length - topN) // never overlaps with strengths
  const weaknesses = sorted.slice(weakStart).reverse() // weakest first
  return { strengths, weaknesses }
}

export type AbilityTier = 'strong' | 'medium' | 'weak'

export function tierOf(avgScore: number): AbilityTier {
  if (avgScore >= 1.5) return 'strong'
  if (avgScore >= 1.0) return 'medium'
  return 'weak'
}

export interface StudentAbility {
  student: Student
  avgScore: number
  count: number
  tier: AbilityTier
}

/** Group a room/class into ability tiers (strong/medium/weak) based on average
 *  academic_score across a given set of modules (e.g. all modules of one subject).
 *  Students with no assessments in these modules are omitted, not scored as weak. */
export function groupStudentsByAbility(
  students: Student[],
  assessments: StudentAssessment[],
  moduleIds: Set<string>,
): StudentAbility[] {
  const byStudent = new Map<string, number[]>()
  assessments.forEach(a => {
    if (!moduleIds.has(a.module_id)) return
    if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, [])
    byStudent.get(a.student_id)!.push(a.academic_score)
  })
  return students
    .map(s => {
      const scores = byStudent.get(s.id)
      if (!scores || scores.length === 0) return null
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
      return { student: s, avgScore, count: scores.length, tier: tierOf(avgScore) }
    })
    .filter((x): x is StudentAbility => x !== null)
    .sort((a, b) => b.avgScore - a.avgScore)
}

export interface TagWeakStudent { student: Student; avgScore: number; count: number }
export interface TagWeakness { tag: string; weakest: TagWeakStudent[] }

/** For each academic_tag found on the given modules (e.g. all modules of one subject),
 *  find the students not yet "strong" (avg &lt; 1.5) on that tag, weakest first — capped
 *  so the UI stays a short, actionable list rather than the whole class. */
export function weakStudentsByTag(
  students: Student[],
  assessments: StudentAssessment[],
  modules: CurriculumModule[],
  maxPerTag = 5,
): TagWeakness[] {
  const moduleIdsByTag = new Map<string, Set<string>>()
  modules.forEach(m => {
    m.academic_tags.forEach(tag => {
      if (!moduleIdsByTag.has(tag)) moduleIdsByTag.set(tag, new Set())
      moduleIdsByTag.get(tag)!.add(m.id)
    })
  })

  const result: TagWeakness[] = []
  moduleIdsByTag.forEach((moduleIds, tag) => {
    const byStudent = new Map<string, number[]>()
    assessments.forEach(a => {
      if (!moduleIds.has(a.module_id)) return
      if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, [])
      byStudent.get(a.student_id)!.push(a.academic_score)
    })
    const weakest = students
      .map((s): TagWeakStudent | null => {
        const scores = byStudent.get(s.id)
        if (!scores || scores.length === 0) return null
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
        return avgScore < 1.5 ? { student: s, avgScore, count: scores.length } : null
      })
      .filter((x): x is TagWeakStudent => x !== null)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, maxPerTag)
    if (weakest.length > 0) result.push({ tag, weakest })
  })
  return result.sort((a, b) => a.tag.localeCompare(b.tag))
}

export type FocusBreakdown = { green: number; yellow: number; red: number; total: number }

export function buildFocusBreakdown(assessments: StudentAssessment[]): FocusBreakdown {
  const counts: Record<FocusColor, number> = { Green: 0, Yellow: 0, Red: 0 }
  for (const a of assessments) counts[a.focus_color]++
  return {
    green: counts.Green,
    yellow: counts.Yellow,
    red: counts.Red,
    total: assessments.length,
  }
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, v) => s + v, 0) / nums.length
}

/** Friendly Thai encouragement line based on overall academic average (0-2 scale). */
export function happinessMessage(avgAcademic: number, total: number): string {
  if (total === 0) return 'ยังไม่มีข้อมูลการประเมินในสัปดาห์นี้'
  if (avgAcademic >= 1.5) return 'ลูกของคุณเรียนรู้ได้ดีเยี่ยม เก่งมากครับ/ค่ะ! 🌟'
  if (avgAcademic >= 1.0) return 'ลูกของคุณกำลังพัฒนาได้ดี ขอให้กำลังใจต่อไปนะครับ/ค่ะ 💪'
  return 'ลูกของคุณกำลังพยายามเรียนรู้ คุณครูจะดูแลเป็นพิเศษค่ะ ❤️'
}
