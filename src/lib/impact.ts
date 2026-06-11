import { StudentAssessment, HomeworkSubmission } from './types'

// ---------- weekly trends ----------

export interface WeeklyMetric {
  week: number
  label: string
  avgScore: number | null   // 0-2
  greenPct: number | null   // 0-100
  onTimePct: number | null  // 0-100
  assessmentCount: number
  homeworkCount: number
}

export function weekOf(dateISO: string, termStartISO: string): number {
  const start = new Date(termStartISO + 'T00:00:00')
  const diff = new Date(dateISO).getTime() - start.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / 604_800_000) + 1
}

export function buildWeeklyTrends(
  assessments: StudentAssessment[],
  homework: HomeworkSubmission[],
  termStartISO: string
): WeeklyMetric[] {
  type Bucket = { scores: number[]; green: number; focusTotal: number; onTime: number; hwTotal: number }
  const weeks = new Map<number, Bucket>()
  const get = (w: number): Bucket => {
    if (!weeks.has(w)) weeks.set(w, { scores: [], green: 0, focusTotal: 0, onTime: 0, hwTotal: 0 })
    return weeks.get(w)!
  }

  for (const a of assessments) {
    const w = weekOf(a.created_at, termStartISO)
    if (w <= 0) continue
    const b = get(w)
    b.scores.push(a.academic_score)
    b.focusTotal++
    if (a.focus_color === 'Green') b.green++
  }
  for (const h of homework) {
    const w = weekOf(h.created_at, termStartISO)
    if (w <= 0) continue
    const b = get(w)
    b.hwTotal++
    if (h.status === 'On_Time') b.onTime++
  }

  return Array.from(weeks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, b]) => ({
      week,
      label: `สัปดาห์ ${week}`,
      avgScore: b.scores.length ? +(b.scores.reduce((s, v) => s + v, 0) / b.scores.length).toFixed(2) : null,
      greenPct: b.focusTotal ? Math.round((b.green / b.focusTotal) * 100) : null,
      onTimePct: b.hwTotal ? Math.round((b.onTime / b.hwTotal) * 100) : null,
      assessmentCount: b.scores.length,
      homeworkCount: b.hwTotal,
    }))
}

// ---------- before / after ----------

export interface BeforeAfterRow {
  metric: string
  unit: string
  before: number | null
  after: number | null
  goodWhenUp: boolean
}

export interface BeforeAfter {
  beforeLabel: string
  afterLabel: string
  rows: BeforeAfterRow[]
}

/**
 * Splits the weeks that actually have data into an early half and a late half,
 * then compares weighted averages — the "ก่อน-หลัง" evidence for the proposal.
 */
export function computeBeforeAfter(
  assessments: StudentAssessment[],
  homework: HomeworkSubmission[],
  termStartISO: string
): BeforeAfter | null {
  const dataWeeks = Array.from(new Set([
    ...assessments.map(a => weekOf(a.created_at, termStartISO)),
    ...homework.map(h => weekOf(h.created_at, termStartISO)),
  ].filter(w => w > 0))).sort((a, b) => a - b)

  if (dataWeeks.length < 2) return null
  const midWeek = dataWeeks[Math.ceil(dataWeeks.length / 2)]

  const stat = (aList: StudentAssessment[], hList: HomeworkSubmission[]) => {
    const avgScore = aList.length ? +(aList.reduce((s, a) => s + a.academic_score, 0) / aList.length).toFixed(2) : null
    const greenPct = aList.length ? Math.round((aList.filter(a => a.focus_color === 'Green').length / aList.length) * 100) : null
    const onTimePct = hList.length ? Math.round((hList.filter(h => h.status === 'On_Time').length / hList.length) * 100) : null
    return { avgScore, greenPct, onTimePct }
  }

  const inRange = (iso: string, fromW: number, toW: number) => {
    const w = weekOf(iso, termStartISO)
    return w >= fromW && w < toW
  }

  const before = stat(
    assessments.filter(a => inRange(a.created_at, 1, midWeek)),
    homework.filter(h => inRange(h.created_at, 1, midWeek)),
  )
  const after = stat(
    assessments.filter(a => weekOf(a.created_at, termStartISO) >= midWeek),
    homework.filter(h => weekOf(h.created_at, termStartISO) >= midWeek),
  )

  return {
    beforeLabel: `สัปดาห์ ${dataWeeks[0]}–${midWeek - 1}`,
    afterLabel: `สัปดาห์ ${midWeek}–${dataWeeks[dataWeeks.length - 1]}`,
    rows: [
      { metric: 'คะแนน Exit Ticket เฉลี่ย', unit: '/2', before: before.avgScore, after: after.avgScore, goodWhenUp: true },
      { metric: 'สมาธิ 🟢 (Fully Engaged)', unit: '%', before: before.greenPct, after: after.greenPct, goodWhenUp: true },
      { metric: 'ส่งการบ้านตรงเวลา', unit: '%', before: before.onTimePct, after: after.onTimePct, goodWhenUp: true },
    ],
  }
}

// ---------- teacher time saved (real timestamps) ----------

export interface EntrySpeed {
  medianSec: number | null  // measured from consecutive save gaps in the same session
  sampleSize: number
  totalRecords: number
  hoursSaved: number        // vs paper baseline
}

/** Paper baseline: registering one score in the old paper workbook + summarising ≈ 2 min/record */
export const PAPER_BASELINE_SEC = 120

export function computeEntrySpeed(assessments: StudentAssessment[]): EntrySpeed {
  const times = assessments.map(a => new Date(a.created_at).getTime()).sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) {
    const g = (times[i] - times[i - 1]) / 1000
    // gaps within one grading session (taps a few seconds apart)
    if (g >= 0.3 && g <= 60) gaps.push(g)
  }
  gaps.sort((a, b) => a - b)
  const medianSec = gaps.length >= 3 ? +gaps[Math.floor(gaps.length / 2)].toFixed(1) : null
  const perRecord = medianSec ?? 10 // conservative assumption until enough samples
  const hoursSaved = Math.max(0, ((PAPER_BASELINE_SEC - perRecord) * assessments.length) / 3600)
  return { medianSec, sampleSize: gaps.length, totalRecords: assessments.length, hoursSaved: +hoursSaved.toFixed(1) }
}
