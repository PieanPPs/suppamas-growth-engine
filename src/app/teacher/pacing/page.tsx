'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  CurriculumModule, PacingLog, PlanSubmission, AcademicSettings, Teacher,
  HomeworkTask, StudentAssessment, LessonPlan,
} from '@/lib/types'
import {
  currentAcademicWeek, computeSubjectPacing, weekOfLesson, latestPacingByModule,
} from '@/lib/pacing'
import { TermBanner } from '@/components/pacing/term-banner'
import { SubjectStatus } from '@/components/pacing/subject-status'
import { WeekSelector } from '@/components/pacing/week-selector'
import { WeeklyPlanCard } from '@/components/pacing/weekly-plan-card'
import { LessonPlanPacingCard } from '@/components/pacing/lesson-plan-pacing-card'
import Link from 'next/link'
import { Loader2, UserCircle2, ChevronDown, CalendarX2, BookPlus } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'

const TEACHER_KEY = 'sge_teacher_id'

export default function PacingPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isTeacherRole, setIsTeacherRole] = useState(false)
  const [settings, setSettings] = useState<AcademicSettings | null>(null)
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [plans, setPlans] = useState<Map<string, PlanSubmission>>(new Map())
  const [pacings, setPacings] = useState<Map<string, PacingLog>>(new Map())
  const [homeworkTasks, setHomeworkTasks] = useState<Map<string, HomeworkTask>>(new Map())
  const [exitByModule, setExitByModule] = useState<Map<string, { count: number; avg: number }>>(new Map())
  const [exitByLessonPlan, setExitByLessonPlan] = useState<Map<string, { count: number; avg: number }>>(new Map())
  const [totalStudents, setTotalStudents] = useState(0)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [lessonPlansByModule, setLessonPlansByModule] = useState<Map<string, Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number'>[]>>(new Map())

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: mods }, { data: ts }, { data: tasks }, { data: assessments }, { data: students }] = await Promise.all([
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('subject').order('sequence_order', { nullsFirst: false }),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('homework_tasks').select('*').eq('school_id', schoolId),
        supabase.from('student_assessments').select('*').eq('school_id', schoolId),
        supabase.from('students').select('id').eq('school_id', schoolId),
      ])

      const settingsRow = s ?? { id: 1, term_name: 'ภาคเรียนที่ 1', term_start_date: '2026-05-18', total_weeks: 20 }
      setSettings(settingsRow)
      setModules(mods ?? [])
      setTeachers(ts ?? [])
      setHomeworkTasks(new Map((tasks ?? []).map((t: HomeworkTask) => [t.module_id, t])))
      setTotalStudents(students?.length ?? 0)

      // exit-ticket summary per module (distinct students + avg)
      const byModule = new Map<string, StudentAssessment[]>()
      ;(assessments ?? []).forEach((a: StudentAssessment) => {
        if (!byModule.has(a.module_id)) byModule.set(a.module_id, [])
        byModule.get(a.module_id)!.push(a)
      })
      const exitMap = new Map<string, { count: number; avg: number }>()
      byModule.forEach((list, moduleId) => {
        const distinct = new Set(list.map(a => a.student_id)).size
        const avg = list.reduce((sum, a) => sum + a.academic_score, 0) / list.length
        exitMap.set(moduleId, { count: distinct, avg })
      })
      setExitByModule(exitMap)

      // exit-ticket summary per lesson plan
      const byLp = new Map<string, StudentAssessment[]>()
      ;(assessments ?? []).forEach((a: StudentAssessment) => {
        if (!a.lesson_plan_id) return
        if (!byLp.has(a.lesson_plan_id)) byLp.set(a.lesson_plan_id, [])
        byLp.get(a.lesson_plan_id)!.push(a)
      })
      const exitLpMap = new Map<string, { count: number; avg: number }>()
      byLp.forEach((list, lpId) => {
        const distinct = new Set(list.map(a => a.student_id)).size
        const avg = list.reduce((sum, a) => sum + a.academic_score, 0) / list.length
        exitLpMap.set(lpId, { count: distinct, avg })
      })
      setExitByLessonPlan(exitLpMap)

      const week = currentAcademicWeek(settingsRow.term_start_date)
      setSelectedWeek(Math.min(settingsRow.total_weeks, Math.max(1, week || 1)))

      const session = getSession()
      const isTeacher = session?.role === 'teacher'
      setIsTeacherRole(isTeacher)
      if (isTeacher && session?.userId) {
        // lock to own ID — cannot switch to other teachers
        setTeacherId(session.userId)
      } else {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(TEACHER_KEY) : null
        if (stored) setTeacherId(stored)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadTeacherData() {
      let plQ = supabase.from('plan_submissions').select('*').eq('school_id', schoolId)
      let pcQ = supabase.from('pacing_logs').select('*').eq('school_id', schoolId)
      let lpQ = supabase.from('lesson_plans')
        .select('id, topic, status, plan_number, module_id')
        .eq('school_id', schoolId)
        .order('plan_number', { ascending: true })
      if (teacherId) {
        plQ = plQ.eq('teacher_id', teacherId)
        pcQ = pcQ.eq('teacher_id', teacherId)
        lpQ = lpQ.eq('teacher_id', teacherId)
      }
      const [{ data: pl }, { data: pc }, { data: lps }] = await Promise.all([plQ, pcQ, lpQ])
      setPlans(new Map((pl ?? []).map((p: PlanSubmission) => [p.module_id, p])))
      setPacings(latestPacingByModule((pc ?? []) as PacingLog[]))

      // group lesson plans by module_id
      type LpSlim = Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number'> & { module_id: string | null }
      const byMod = new Map<string, Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number'>[]>()
      ;((lps ?? []) as LpSlim[]).forEach(lp => {
        if (!lp.module_id) return
        const existing = byMod.get(lp.module_id) ?? []
        byMod.set(lp.module_id, [...existing, lp])
      })
      setLessonPlansByModule(byMod)
    }
    loadTeacherData()
  }, [teacherId])

  function selectTeacher(id: string) {
    if (id === '') {
      setTeacherId(null)
      localStorage.removeItem(TEACHER_KEY)
    } else {
      setTeacherId(id)
      localStorage.setItem(TEACHER_KEY, id)
    }
  }

  if (loading || !settings) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  const currentWeek = currentAcademicWeek(settings.term_start_date)
  const completedIds = new Set(
    Array.from(pacings.values()).filter(p => p.status === 'Completed').map(p => p.module_id)
  )

  // filter by selected teacher's subjects (if teacher chosen)
  const selectedTeacher = teacherId ? teachers.find(t => t.id === teacherId) : null
  const teacherSubjects = selectedTeacher?.subjects?.length ? new Set(selectedTeacher.subjects) : null

  const visibleModules = teacherSubjects
    ? modules.filter(m => teacherSubjects.has(m.subject))
    : modules

  // subjects + overall pacing
  const subjects = Array.from(new Set(visibleModules.map(m => m.subject)))
  const subjectPacings = subjects.map(subject =>
    computeSubjectPacing(subject, visibleModules.filter(m => m.subject === subject), completedIds, currentWeek)
  )

  // modules active in the selected week, grouped by subject
  const weekModules = visibleModules.filter(m => weekOfLesson(m, selectedWeek) != null)
  const grouped = subjects
    .map(subject => ({ subject, mods: weekModules.filter(m => m.subject === subject) }))
    .filter(g => g.mods.length > 0)

  return (
    <div className="space-y-5 pb-8">
      <TermBanner settings={settings} onUpdate={setSettings} />

      {/* Teacher picker — admin/principal only */}
      {!isTeacherRole && (
        <div className="relative">
          <UserCircle2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          <select
            value={teacherId ?? ''}
            onChange={e => selectTeacher(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">แสดงทุกวิชา (ทั้งหมด)</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* AI lesson plan shortcut */}
      <Link href="/teacher/lesson-plans"
        className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 hover:bg-violet-100 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
          <BookPlus size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-violet-900">สร้างแผนการสอนด้วย AI</p>
          <p className="text-xs text-violet-600">เลือกเรื่อง → copy prompt → วาง AI → บันทึกแผน</p>
        </div>
        <ChevronDown size={16} className="text-violet-400 -rotate-90 flex-shrink-0" />
      </Link>

      {/* Overall pacing traffic lights */}
      <AnimatePresence>
        {teacherId && currentWeek > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">สัญญาณความเร็วการสอน (ภาพรวม)</h3>
            {subjectPacings.map((p, i) => <SubjectStatus key={p.subject} pacing={p} index={i} />)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week selector */}
      <div className="bg-white border border-gray-200 rounded-2xl px-3 py-3 shadow-sm sticky top-2 z-10">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-gray-500">เลือกสัปดาห์</span>
          {selectedWeek === currentWeek
            ? <span className="text-xs text-blue-600 font-semibold">● สัปดาห์ปัจจุบัน</span>
            : currentWeek > 0 && (
              <button onClick={() => setSelectedWeek(currentWeek)} className="text-xs text-blue-600 hover:underline">
                กลับสัปดาห์ปัจจุบัน
              </button>
            )}
        </div>
        <WeekSelector
          totalWeeks={settings.total_weeks}
          currentWeek={currentWeek}
          selectedWeek={selectedWeek}
          onSelect={setSelectedWeek}
        />
      </div>

      {/* Weekly plan cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">
            แผนการสอน — สัปดาห์ที่ {selectedWeek}
          </h3>
          <Link href="/teacher/curriculum" className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:text-blue-800">
            <BookPlus size={13} /> จัดโครงสร้างรายวิชา
          </Link>
        </div>
        {grouped.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
            <CalendarX2 size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">ยังไม่มีหน่วยการเรียนรู้สำหรับสัปดาห์นี้</p>
            <Link href="/teacher/curriculum" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
              <BookPlus size={13} /> เพิ่มหน่วยการเรียนรู้
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {grouped.flatMap(g => g.mods).flatMap(m => {
              const lps = lessonPlansByModule.get(m.id) ?? []
              const exit = exitByModule.get(m.id)
              const exitSummary = { count: exit?.count ?? 0, total: totalStudents, avg: exit?.avg ?? 0 }

              if (lps.length > 0) {
                return lps.map(lp => {
                  const lpExit = exitByLessonPlan.get(lp.id)
                  const lpExitSummary = { count: lpExit?.count ?? 0, total: totalStudents, avg: lpExit?.avg ?? 0 }
                  return (
                    <LessonPlanPacingCard
                      key={lp.id}
                      module={m}
                      lessonPlan={lp}
                      pacing={pacings.get(m.id)}
                      teacherId={teacherId}
                      exitSummary={lpExitSummary}
                      onOpenExitTicket={() => router.push(`/teacher/assessment?module=${m.id}&lesson_plan_id=${lp.id}`)}
                      onPacingChange={log => setPacings(prev => new Map(prev).set(m.id, log))}
                      isCurrent={selectedWeek === currentWeek}
                    />
                  )
                })
              }

              return [(
                <WeeklyPlanCard
                  key={m.id}
                  module={m}
                  selectedWeek={selectedWeek}
                  currentWeek={currentWeek}
                  teacherId={teacherId}
                  plan={plans.get(m.id)}
                  pacing={pacings.get(m.id)}
                  homeworkTask={homeworkTasks.get(m.id)}
                  exitSummary={exitSummary}
                  onOpenExitTicket={id => router.push(`/teacher/assessment?module=${id}`)}
                />
              )]
            })}
          </div>
        )}
      </div>

      {modules.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>ยังไม่มีข้อมูลบทเรียน</p>
        </div>
      )}
    </div>
  )
}
