import { CurriculumModule, PacingLog } from './types'

/** Current academic week number (1-based) given the term start date. */
export function currentAcademicWeek(termStartISO: string): number {
  const start = new Date(termStartISO + 'T00:00:00')
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  if (diffMs < 0) return 0 // term hasn't started yet
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

export type PacingStatusLevel = 'OnTrack' | 'Ahead' | 'Behind' | 'NoData'

export interface SubjectPacing {
  subject: string
  level: PacingStatusLevel
  currentWeek: number
  latestCompletedWeek: number | null
  gap: number // currentWeek - latestCompletedWeek (positive = behind)
}

/**
 * Compute the On-Track / Ahead / Behind signal for one subject.
 * - Ahead  (🟡): teacher completed modules planned beyond the current week
 * - OnTrack(🟢): completed up to current or previous week (within 2 weeks)
 * - Behind (🔴): more than 2 weeks behind the planned calendar
 */
export function computeSubjectPacing(
  subject: string,
  modules: CurriculumModule[],
  completedModuleIds: Set<string>,
  currentWeek: number
): SubjectPacing {
  const completedWeeks = modules
    .filter(m => completedModuleIds.has(m.id) && m.planned_week != null)
    .map(m => m.planned_week as number)

  if (completedWeeks.length === 0) {
    return { subject, level: 'NoData', currentWeek, latestCompletedWeek: null, gap: currentWeek }
  }

  const latestCompletedWeek = Math.max(...completedWeeks)
  const gap = currentWeek - latestCompletedWeek

  let level: PacingStatusLevel
  if (gap < 0) level = 'Ahead'
  else if (gap > 2) level = 'Behind'
  else level = 'OnTrack'

  return { subject, level, currentWeek, latestCompletedWeek, gap }
}

export const PACING_LEVEL_META: Record<PacingStatusLevel, { label: string; color: string; ring: string; dot: string; advice: string }> = {
  OnTrack: {
    label: 'สอนตรงแผน',
    color: 'text-green-700',
    ring: 'bg-green-50 border-green-200',
    dot: 'bg-green-500',
    advice: 'สอนได้ตรงตามเป้าหมายปฏิทินการศึกษา',
  },
  Ahead: {
    label: 'สอนเร็วกว่าแผน',
    color: 'text-yellow-700',
    ring: 'bg-yellow-50 border-yellow-200',
    dot: 'bg-yellow-400',
    advice: 'แนะนำเพิ่มกิจกรรมเสริมทักษะขั้นสูง เพื่อไม่ให้เด็กเบื่อ',
  },
  Behind: {
    label: 'สอนช้ากว่าแผน',
    color: 'text-red-700',
    ring: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
    advice: 'ช้าสะสมเกิน 2 สัปดาห์ — ฝ่ายวิชาการจะเข้าช่วยเหลือ',
  },
  NoData: {
    label: 'ยังไม่เริ่มเช็คอิน',
    color: 'text-gray-500',
    ring: 'bg-gray-50 border-gray-200',
    dot: 'bg-gray-300',
    advice: 'ยังไม่มีการกดสถานะการสอนในวิชานี้',
  },
}

/**
 * Is this module the "current week" lesson for its subject?
 * A module spanning expected_duration_weeks covers
 * [planned_week, planned_week + duration - 1].
 */
export function isCurrentWeekModule(m: CurriculumModule, currentWeek: number): boolean {
  if (m.planned_week == null) return false
  const span = Math.max(1, m.expected_duration_weeks)
  return currentWeek >= m.planned_week && currentWeek <= m.planned_week + span - 1
}

/** For a 2-week module, which week-of-lesson are we in (1-based)? null if not active. */
export function weekOfLesson(m: CurriculumModule, currentWeek: number): number | null {
  if (m.planned_week == null) return null
  const span = Math.max(1, m.expected_duration_weeks)
  if (currentWeek < m.planned_week || currentWeek > m.planned_week + span - 1) return null
  return currentWeek - m.planned_week + 1
}

/** Latest status per module, considering only module-level logs (no lesson_plan_id) --
 * once a module has lesson plans, each one tracks its own status via
 * latestPacingByLessonPlan instead, so a log scoped to one lesson plan must not bleed
 * into "the whole module's" status here. */
export function latestPacingByModule(logs: PacingLog[]): Map<string, PacingLog> {
  const map = new Map<string, PacingLog>()
  for (const log of logs) {
    if (log.lesson_plan_id) continue
    const existing = map.get(log.module_id)
    if (!existing || log.created_at > existing.created_at) map.set(log.module_id, log)
  }
  return map
}

/** Latest status per lesson plan -- lets each hour/topic within a module be marked
 * "สอนจบ" independently instead of all sharing one module-wide status. */
export function latestPacingByLessonPlan(logs: PacingLog[]): Map<string, PacingLog> {
  const map = new Map<string, PacingLog>()
  for (const log of logs) {
    if (!log.lesson_plan_id) continue
    const existing = map.get(log.lesson_plan_id)
    if (!existing || log.created_at > existing.created_at) map.set(log.lesson_plan_id, log)
  }
  return map
}
