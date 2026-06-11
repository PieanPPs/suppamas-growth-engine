import { CurriculumModule, PacingLog, PacingStatus, StudentAssessment } from './types'

// Class average below this = "ตกเกณฑ์" (fail), per the spec (avg academic_score < 1.0)
export const PASS_THRESHOLD = 1.0
// Share of red+yellow focus above this = attention-disengagement concern
export const FOCUS_CONCERN_RATIO = 0.4

export type Quadrant =
  | 'PerfectPacing'   // fast + pass
  | 'SpeedingHazard'  // fast + fail  ← red alert
  | 'DeepLearning'    // slow + pass
  | 'CriticalRescue'  // slow + fail
  | 'InProgress'      // lesson still running, no verdict yet
  | 'NoData'

export interface CrossRow {
  module: CurriculumModule
  status?: PacingStatus
  planSubmitted: boolean
  avgScore: number
  studentCount: number
  green: number
  yellow: number
  red: number
  redYellowRatio: number
  quadrant: Quadrant
  isHazard: boolean
}

export const QUADRANT_META: Record<Exclude<Quadrant, 'NoData' | 'InProgress'>, {
  title: string
  subtitle: string
  bg: string
  text: string
  border: string
}> = {
  PerfectPacing: {
    title: 'Perfect Pacing',
    subtitle: 'สอนเร็ว · เด็กผ่าน',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  SpeedingHazard: {
    title: 'Speeding Hazard',
    subtitle: 'สอนเร็ว · เด็กตก',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  DeepLearning: {
    title: 'Deep Learning',
    subtitle: 'สอนช้า · เด็กผ่าน',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  CriticalRescue: {
    title: 'Critical Rescue',
    subtitle: 'สอนช้า · เด็กตก',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
  },
}

function classify(
  status: PacingStatus | undefined,
  avgScore: number,
  studentCount: number,
  module: CurriculumModule,
  currentWeek: number
): Quadrant {
  if (studentCount === 0 || !status) return 'NoData'

  const pass = avgScore >= PASS_THRESHOLD
  const span = Math.max(1, module.expected_duration_weeks)
  const overdue =
    module.planned_week != null && currentWeek > module.planned_week + span - 1

  if (status === 'Completed') return pass ? 'PerfectPacing' : 'SpeedingHazard'
  if (status === 'Delayed') return pass ? 'DeepLearning' : 'CriticalRescue'
  // In_Progress: only judged if the planned window has already passed
  if (overdue) return pass ? 'DeepLearning' : 'CriticalRescue'
  return 'InProgress'
}

/**
 * Join System 1 (pacing/plans) with System 2 (assessments) by module_id
 * and classify each module into the 2×2 strategy matrix.
 */
export function buildCrossTracking(
  modules: CurriculumModule[],
  pacings: PacingLog[],
  assessments: StudentAssessment[],
  plansByModule: Set<string>,
  currentWeek: number
): CrossRow[] {
  // latest pacing per module (across all teachers)
  const pacingByModule = new Map<string, PacingLog>()
  for (const p of pacings) {
    const cur = pacingByModule.get(p.module_id)
    if (!cur || p.created_at > cur.created_at) pacingByModule.set(p.module_id, p)
  }

  const assessByModule = new Map<string, StudentAssessment[]>()
  for (const a of assessments) {
    if (!assessByModule.has(a.module_id)) assessByModule.set(a.module_id, [])
    assessByModule.get(a.module_id)!.push(a)
  }

  return modules.map(module => {
    const list = assessByModule.get(module.id) ?? []
    const status = pacingByModule.get(module.id)?.status
    const avgScore = list.length
      ? list.reduce((s, a) => s + a.academic_score, 0) / list.length
      : 0
    const green = list.filter(a => a.focus_color === 'Green').length
    const yellow = list.filter(a => a.focus_color === 'Yellow').length
    const red = list.filter(a => a.focus_color === 'Red').length
    const redYellowRatio = list.length ? (yellow + red) / list.length : 0
    const quadrant = classify(status, avgScore, list.length, module, currentWeek)

    return {
      module,
      status,
      planSubmitted: plansByModule.has(module.id),
      avgScore,
      studentCount: list.length,
      green,
      yellow,
      red,
      redYellowRatio,
      quadrant,
      isHazard: quadrant === 'SpeedingHazard',
    }
  })
}
