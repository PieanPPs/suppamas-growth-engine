import { CurriculumModule, StudentAssessment, FocusColor } from './types'

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
