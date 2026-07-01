import { createClient } from './supabase/client'
import { getSchoolId } from './school'
import { fetchAllPaged } from './db'
import {
  StudentAssessment, HomeworkSubmission, PacingLog, PlanSubmission,
  CurriculumModule, AcademicSettings, Indicator, ModuleIndicator,
} from './types'
import { buildWeeklyTrends, computeBeforeAfter, computeEntrySpeed, WeeklyMetric, BeforeAfter, EntrySpeed } from './impact'
import { buildCrossTracking } from './cross-tracking'
import { currentAcademicWeek } from './pacing'

export interface ImpactData {
  termStart: string
  termName: string
  currentWeek: number
  counts: {
    students: number
    teachers: number
    classrooms: number
    modules: number
    indicators: number
    assessments: number
    homework: number
    plans: number
    pacingLogs: number
    totalRecords: number
  }
  trends: WeeklyMetric[]
  beforeAfter: BeforeAfter | null
  speed: EntrySpeed
  hazardCount: number
  perfectCount: number
  coverage: { covered: number; total: number; finalCovered: number; finalTotal: number } | null
}

export async function loadImpact(): Promise<ImpactData> {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [
    assessments, homework, pacings, plans,
    { data: modules }, { data: settings }, { data: students }, { data: teachers },
    { data: classrooms }, { data: indicators }, { data: moduleIndicators },
  ] = await Promise.all([
    // page through — these tables exceed Supabase's 1000-row-per-request cap
    fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').order('id')),
    fetchAllPaged<HomeworkSubmission>(() => supabase.from('homework_submissions').select('*').order('id')),
    fetchAllPaged<PacingLog>(() => supabase.from('pacing_logs').select('*').order('id')),
    fetchAllPaged<PlanSubmission>(() => supabase.from('plan_submissions').select('*').order('id')),
    supabase.from('curriculum_modules').select('*'),
    supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
    supabase.from('students').select('id'),
    supabase.from('teachers').select('id'),
    supabase.from('classrooms').select('id'),
    supabase.from('indicators').select('*'),
    supabase.from('module_indicators').select('*'),
  ])

  const s = (settings as AcademicSettings) ?? { id: 1, term_name: 'ภาคเรียนที่ 1', term_start_date: '2026-05-18', total_weeks: 20 }
  const aList = (assessments ?? []) as StudentAssessment[]
  const hList = (homework ?? []) as HomeworkSubmission[]
  const pList = (pacings ?? []) as PacingLog[]
  const planList = (plans ?? []) as PlanSubmission[]
  const modList = (modules ?? []) as CurriculumModule[]
  const week = currentAcademicWeek(s.term_start_date)

  const cross = buildCrossTracking(modList, pList, aList, new Set(planList.map(p => p.module_id)), week)

  const inds = (indicators ?? []) as Indicator[]
  let coverage: ImpactData['coverage'] = null
  if (inds.length > 0) {
    const completedModuleIds = new Set(pList.filter(p => p.status === 'Completed').map(p => p.module_id))
    const coveredIds = new Set(
      ((moduleIndicators ?? []) as ModuleIndicator[])
        .filter(mi => completedModuleIds.has(mi.module_id))
        .map(mi => mi.indicator_id)
    )
    const finals = inds.filter(i => i.type === 'final')
    coverage = {
      covered: inds.filter(i => coveredIds.has(i.id)).length,
      total: inds.length,
      finalCovered: finals.filter(i => coveredIds.has(i.id)).length,
      finalTotal: finals.length,
    }
  }

  return {
    termStart: s.term_start_date,
    termName: s.term_name,
    currentWeek: week,
    counts: {
      students: students?.length ?? 0,
      teachers: teachers?.length ?? 0,
      classrooms: classrooms?.length ?? 0,
      modules: modList.length,
      indicators: inds.length,
      assessments: aList.length,
      homework: hList.length,
      plans: planList.length,
      pacingLogs: pList.length,
      totalRecords: aList.length + hList.length + pList.length + planList.length,
    },
    trends: buildWeeklyTrends(aList, hList, s.term_start_date),
    beforeAfter: computeBeforeAfter(aList, hList, s.term_start_date),
    speed: computeEntrySpeed(aList),
    hazardCount: cross.filter(r => r.quadrant === 'SpeedingHazard').length,
    perfectCount: cross.filter(r => r.quadrant === 'PerfectPacing').length,
    coverage,
  }
}
