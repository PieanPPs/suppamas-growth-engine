import { CurriculumModule, StudentAssessment, FocusColor, Student, Test, TestItem, TestScore, TestItemResponse } from './types'

// `tag` here is almost always a real curriculum indicator short-code (e.g. "ป.3/1"), NOT a
// free-text skill label — it comes straight from module.academic_tags, which teachers fill in
// with the official indicator code. That short code is bare and ambiguous on its own (it looks
// exactly like a classroom name, "ป.3/1" = ห้อง 1 — same "grade/number" format, easy to confuse),
// so any UI showing `tag` should resolve it against the indicators table and show the description
// alongside it, not the bare code alone. `subject` is included so callers can disambiguate
// identical short codes reused across different subjects (Math ป.3/1 and Thai ป.3/1 are different
// indicators) instead of averaging them together.
export type TagScore = { tag: string; avgScore: number; count: number; subject?: string }

/**
 * Build per-tag average academic scores for a single student's assessments.
 * Each assessment contributes its academic_score to every tag on its module.
 * Bucketed by (subject, tag) internally — the same short indicator code can be reused across
 * different subjects, and averaging those together would blend two unrelated indicators.
 */
export function buildStudentTagScores(
  assessments: StudentAssessment[],
  moduleMap: Map<string, CurriculumModule>
): TagScore[] {
  const tagBuckets = new Map<string, { subject: string; tag: string; scores: number[] }>()

  for (const a of assessments) {
    const mod = moduleMap.get(a.module_id)
    if (!mod) continue
    for (const tag of mod.academic_tags) {
      const key = `${mod.subject}::${tag}`
      if (!tagBuckets.has(key)) tagBuckets.set(key, { subject: mod.subject, tag, scores: [] })
      tagBuckets.get(key)!.scores.push(a.academic_score)
    }
  }

  return Array.from(tagBuckets.values())
    .map(({ subject, tag, scores }) => ({
      tag,
      subject,
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
export interface TagWeakness { tag: string; weakest: TagWeakStudent[]; subject?: string }

/** For each academic_tag found on the given modules (e.g. all modules of one subject),
 *  find the students not yet "strong" (avg &lt; 1.5) on that tag, weakest first — capped
 *  so the UI stays a short, actionable list rather than the whole class. Bucketed by
 *  (subject, tag) — same short indicator code can be reused across different subjects. */
export function weakStudentsByTag(
  students: Student[],
  assessments: StudentAssessment[],
  modules: CurriculumModule[],
  maxPerTag = 5,
): TagWeakness[] {
  const moduleIdsByKey = new Map<string, { subject: string; tag: string; moduleIds: Set<string> }>()
  modules.forEach(m => {
    m.academic_tags.forEach(tag => {
      const key = `${m.subject}::${tag}`
      if (!moduleIdsByKey.has(key)) moduleIdsByKey.set(key, { subject: m.subject, tag, moduleIds: new Set() })
      moduleIdsByKey.get(key)!.moduleIds.add(m.id)
    })
  })

  const result: TagWeakness[] = []
  moduleIdsByKey.forEach(({ subject, tag, moduleIds }) => {
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
    if (weakest.length > 0) result.push({ tag, subject, weakest })
  })
  return result.sort((a, b) => a.tag.localeCompare(b.tag))
}

/**
 * Per-indicator correctness buckets (0/1 per graded item) for one student, built from real
 * exam data — test_items.indicator_code + test_item_responses — instead of the informal daily
 * exit-ticket tags. Follows the same "tap = wrong" convention used throughout the tests/NT-cycle
 * pages: a test the student was graded on but has no response row for an item counts as correct.
 */
function studentIndicatorBuckets(
  studentId: string,
  tests: Test[],
  testItems: TestItem[],
  testScores: TestScore[],
  testItemResponses: TestItemResponse[],
): Map<string, { subject: string; code: string; scores: number[] }> {
  // keyed by (test.subject, indicator_code) — the same short indicator code can be reused
  // across different subjects (see buildStudentTagScores), same collision risk here.
  const buckets = new Map<string, { subject: string; code: string; scores: number[] }>()
  for (const test of tests) {
    const graded = testScores.some(sc => sc.test_id === test.id && sc.student_id === studentId)
      || testItemResponses.some(r => r.test_id === test.id && r.student_id === studentId)
    if (!graded) continue
    for (const item of testItems) {
      if (item.test_id !== test.id || !item.indicator_code) continue
      const wrong = testItemResponses.some(r => r.test_item_id === item.id && r.student_id === studentId && !r.correct)
      const key = `${test.subject}::${item.indicator_code}`
      if (!buckets.has(key)) buckets.set(key, { subject: test.subject, code: item.indicator_code, scores: [] })
      buckets.get(key)!.scores.push(wrong ? 0 : 1)
    }
  }
  return buckets
}

/** Per-indicator average score (0-2 scale, same as academic_score) for one student, from real
 *  exam results rather than daily exit tickets. `tag` holds the indicator code (e.g. "ค 1.1") —
 *  reuses TagScore so it drops straight into StudentRadar / splitStrengthsWeaknesses. */
export function buildStudentIndicatorScores(
  studentId: string,
  tests: Test[],
  testItems: TestItem[],
  testScores: TestScore[],
  testItemResponses: TestItemResponse[],
): TagScore[] {
  const buckets = studentIndicatorBuckets(studentId, tests, testItems, testScores, testItemResponses)
  return Array.from(buckets.values())
    .map(({ subject, code, scores }) => ({
      tag: code,
      subject,
      avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length) * 2,
      count: scores.length,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

/** Room-wide ability tiers based on real exam performance per indicator (see
 *  studentIndicatorBuckets) rather than daily exit-ticket academic_tags. */
export function groupStudentsByIndicatorAbility(
  students: Student[],
  tests: Test[],
  testItems: TestItem[],
  testScores: TestScore[],
  testItemResponses: TestItemResponse[],
): StudentAbility[] {
  return students
    .map(s => {
      const buckets = studentIndicatorBuckets(s.id, tests, testItems, testScores, testItemResponses)
      const allVals = Array.from(buckets.values()).flatMap(b => b.scores)
      if (allVals.length === 0) return null
      const avgScore = (allVals.reduce((a, b) => a + b, 0) / allVals.length) * 2
      return { student: s, avgScore, count: allVals.length, tier: tierOf(avgScore) }
    })
    .filter((x): x is StudentAbility => x !== null)
    .sort((a, b) => b.avgScore - a.avgScore)
}

/** For each indicator tested across the given tests, which students haven't yet passed it
 *  (avg &lt; 1.5) based on real exam item results — weakest first, capped per indicator. */
export function weakStudentsByIndicator(
  students: Student[],
  tests: Test[],
  testItems: TestItem[],
  testScores: TestScore[],
  testItemResponses: TestItemResponse[],
  maxPerIndicator = 5,
): TagWeakness[] {
  const perStudent = new Map<string, Map<string, { subject: string; code: string; scores: number[] }>>()
  students.forEach(s => perStudent.set(s.id, studentIndicatorBuckets(s.id, tests, testItems, testScores, testItemResponses)))

  const keys = new Map<string, { subject: string; code: string }>()
  perStudent.forEach(m => m.forEach((b, key) => keys.set(key, { subject: b.subject, code: b.code })))

  const result: TagWeakness[] = []
  keys.forEach(({ subject, code }, key) => {
    const weakest = students
      .map((s): TagWeakStudent | null => {
        const bucket = perStudent.get(s.id)?.get(key)
        if (!bucket || bucket.scores.length === 0) return null
        const avgScore = (bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length) * 2
        return avgScore < 1.5 ? { student: s, avgScore, count: bucket.scores.length } : null
      })
      .filter((x): x is TagWeakStudent => x !== null)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, maxPerIndicator)
    if (weakest.length > 0) result.push({ tag: code, subject, weakest })
  })
  return result.sort((a, b) => a.tag.localeCompare(b.tag))
}

export interface MonthlyTrendPoint { month: string; avgScore: number; count: number }

/** Bucket a student's academic_score by month (from created_at) so a UI can plot progress
 *  over time — a single overall average hides whether a student is improving or sliding,
 *  which matters once several months of exit tickets have accumulated. */
export function buildMonthlyAcademicTrend(assessments: StudentAssessment[]): MonthlyTrendPoint[] {
  const buckets = new Map<string, number[]>()
  for (const a of assessments) {
    const month = a.created_at.slice(0, 7) // YYYY-MM
    if (!buckets.has(month)) buckets.set(month, [])
    buckets.get(month)!.push(a.academic_score)
  }
  return Array.from(buckets.entries())
    .map(([month, scores]) => ({
      month,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
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
