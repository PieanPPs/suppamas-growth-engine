'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  CurriculumModule, PacingLog, PlanSubmission, AcademicSettings, Teacher,
  HomeworkTask, StudentAssessment, LessonPlan, Student,
} from '@/lib/types'
import {
  currentAcademicWeek, computeSubjectPacing, weekOfLesson, latestPacingByModule, latestPacingByLessonPlan,
} from '@/lib/pacing'
import { TermBanner } from '@/components/pacing/term-banner'
import { SubjectStatus } from '@/components/pacing/subject-status'
import { WeekSelector } from '@/components/pacing/week-selector'
import { WeeklyPlanCard } from '@/components/pacing/weekly-plan-card'
import { LessonPlanPacingCard } from '@/components/pacing/lesson-plan-pacing-card'
import { TodayChecklist } from '@/components/pacing/today-checklist'
import Link from 'next/link'
import { Loader2, UserCircle2, ChevronDown, CalendarX2, BookPlus } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { fetchAllPaged, latestAssessmentPerPlan } from '@/lib/db'

const TEACHER_KEY = 'sge_teacher_id'

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
  const [pacingsByLessonPlan, setPacingsByLessonPlan] = useState<Map<string, PacingLog>>(new Map())
  const [homeworkTasks, setHomeworkTasks] = useState<Map<string, HomeworkTask>>(new Map())
  const [exitByModule, setExitByModule] = useState<Map<string, { count: number; avg: number }>>(new Map())
  const [exitByLessonPlan, setExitByLessonPlan] = useState<Map<string, { count: number; avg: number }>>(new Map())
  const [allStudents, setAllStudents] = useState<Pick<Student, 'id' | 'class_name'>[]>([])
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [lessonPlansByModule, setLessonPlansByModule] = useState<Map<string, Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number' | 'planned_week'>[]>>(new Map())
  // "วันนี้ยังไม่ได้ทำอะไรบ้าง" checklist — โมดูลที่มีคะแนนบันทึกวันนี้แล้ว / ห้องที่มีการเช็คชื่อวันนี้แล้ว
  const [assessedTodayModuleIds, setAssessedTodayModuleIds] = useState<Set<string>>(new Set())
  const [attendanceRoomsToday, setAttendanceRoomsToday] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: mods }, { data: ts }, { data: tasks }, assessments, { data: students }, { data: attendanceToday }] = await Promise.all([
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('subject').order('sequence_order', { nullsFirst: false }),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('homework_tasks').select('*').eq('school_id', schoolId),
        // must page through — this table exceeds Supabase's 1000-row-per-request cap
        // order by created_at ascending so a later dedupe-by-student keeps the latest record
        fetchAllPaged<StudentAssessment>(() =>
          supabase.from('student_assessments').select('*').eq('school_id', schoolId).order('created_at')),
        supabase.from('students').select('id, class_name').eq('school_id', schoolId),
        supabase.from('attendance').select('student_id').eq('school_id', schoolId).eq('date', todayDateStr()),
      ])

      const settingsRow = s ?? { id: 1, term_name: 'ภาคเรียนที่ 1', term_start_date: '2026-05-18', total_weeks: 20 }
      setSettings(settingsRow)
      setModules(mods ?? [])
      setTeachers(ts ?? [])
      setHomeworkTasks(new Map((tasks ?? []).map((t: HomeworkTask) => [t.module_id, t])))
      setAllStudents((students ?? []) as Pick<Student, 'id' | 'class_name'>[])

      // checklist: which modules already got an exit-ticket score today
      const today = todayDateStr()
      setAssessedTodayModuleIds(new Set(
        (assessments ?? [])
          .filter((a: StudentAssessment) => String(a.created_at).slice(0, 10) === today)
          .map((a: StudentAssessment) => a.module_id)
      ))
      // checklist: which classrooms have at least one attendance row today (touch-only-exceptions
      // model means "no rows" can also mean "checked, everyone present" — worded softly in the UI)
      const classNameByStudent = new Map((students ?? []).map((st: Pick<Student, 'id' | 'class_name'>) => [st.id, st.class_name]))
      setAttendanceRoomsToday(new Set(
        (attendanceToday ?? [])
          .map((a: { student_id: string }) => classNameByStudent.get(a.student_id))
          .filter(Boolean) as string[]
      ))

      const dedupedAssessments = latestAssessmentPerPlan(assessments ?? [])

      // exit-ticket summary per module (distinct students + avg)
      const byModule = new Map<string, StudentAssessment[]>()
      dedupedAssessments.forEach((a: StudentAssessment) => {
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
      dedupedAssessments.forEach((a: StudentAssessment) => {
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
      type LpRow = Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number' | 'planned_week'> & { module_id: string | null }
      const [pl, pc, lps] = await Promise.all([
        fetchAllPaged<PlanSubmission>(() => {
          const q = supabase.from('plan_submissions').select('*').eq('school_id', schoolId)
          return (teacherId ? q.eq('teacher_id', teacherId) : q).order('id')
        }),
        fetchAllPaged<PacingLog>(() => {
          const q = supabase.from('pacing_logs').select('*').eq('school_id', schoolId)
          return (teacherId ? q.eq('teacher_id', teacherId) : q).order('id')
        }),
        fetchAllPaged<LpRow>(() => {
          const q = supabase.from('lesson_plans').select('id, topic, status, plan_number, planned_week, module_id').eq('school_id', schoolId)
          return (teacherId ? q.eq('teacher_id', teacherId) : q).order('plan_number', { ascending: true }).order('id')
        }),
      ])
      setPlans(new Map(pl.map((p: PlanSubmission) => [p.module_id, p])))
      setPacings(latestPacingByModule(pc))
      setPacingsByLessonPlan(latestPacingByLessonPlan(pc))

      // rooms bound to this teacher — exit-ticket totals should count only these students
      if (teacherId) {
        const { data: links } = await supabase
          .from('teacher_classrooms').select('classrooms(name)').eq('teacher_id', teacherId)
        const names = (links ?? [])
          .map((r: { classrooms: { name: string } | { name: string }[] | null }) =>
            Array.isArray(r.classrooms) ? r.classrooms[0]?.name : r.classrooms?.name)
          .filter(Boolean) as string[]
        setBoundRooms(names)
      } else {
        setBoundRooms([])
      }

      // group lesson plans by module_id
      const byMod = new Map<string, Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number' | 'planned_week'>[]>()
      lps.forEach(lp => {
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

  // exit-ticket totals should count only the teacher's assigned classroom(s), not the whole school
  const totalStudents = boundRooms.length > 0
    ? allStudents.filter(s => boundRooms.includes(s.class_name)).length
    : allStudents.length

  const currentWeek = currentAcademicWeek(settings.term_start_date)
  const completedIds = new Set(
    Array.from(pacings.values()).filter(p => p.status === 'Completed').map(p => p.module_id)
  )
  // ครูมักกด "สอนจบ" ที่การ์ดแผนรายชั่วโมง (per lesson-plan) ไม่ใช่ปุ่มสถานะระดับหน่วยที่หัวการ์ด
  // สัปดาห์ — ถ้าไม่ roll up ตรงนี้ สัญญาณ "สอนช้ากว่าแผน" จะค้างแม้สอนจบครบทุกชั่วโมงแล้ว
  // เพราะสองอย่างนี้เป็นคนละแถวใน pacing_logs (ดู latestPacingByModule vs latestPacingByLessonPlan)
  lessonPlansByModule.forEach((lps, moduleId) => {
    if (lps.length === 0) return
    const allDone = lps.every(lp => pacingsByLessonPlan.get(lp.id)?.status === 'Completed')
    if (allDone) completedIds.add(moduleId)
  })

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

  // "วันนี้ยังไม่ได้ทำอะไรบ้าง" — เฉพาะโมดูล/ห้องที่ active สัปดาห์นี้จริง ไม่ใช่ทุกโมดูลในระบบ
  const currentWeekModules = visibleModules.filter(m => weekOfLesson(m, currentWeek) != null)
  const checklistModules = currentWeekModules.map(m => ({
    moduleId: m.id, subject: m.subject, title: m.title, doneToday: assessedTodayModuleIds.has(m.id),
  }))
  const checklistRooms = boundRooms.map(room => ({ room, doneToday: attendanceRoomsToday.has(room) }))

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

      {/* วันนี้ยังไม่ได้ทำอะไรบ้าง */}
      {teacherId && <TodayChecklist modules={checklistModules} rooms={checklistRooms} />}

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
              const allLps = lessonPlansByModule.get(m.id) ?? []
              // a plan only shows on the week it's actually scheduled for -- a module can
              // span several weeks with a different topic each week, so every plan showing
              // on every week of the module made it impossible to tell which topic is this
              // week's from the pacing view. Plans with no week set yet (legacy data) fall
              // back to the module's first week so they don't vanish or duplicate everywhere.
              const lps = allLps.filter(lp =>
                lp.planned_week != null ? lp.planned_week === selectedWeek : selectedWeek === m.planned_week
              )
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
                      pacing={pacingsByLessonPlan.get(lp.id)}
                      teacherId={teacherId}
                      exitSummary={lpExitSummary}
                      onOpenExitTicket={() => router.push(`/teacher/assessment?module=${m.id}&lesson_plan_id=${lp.id}`)}
                      onPacingChange={log => setPacingsByLessonPlan(prev => new Map(prev).set(lp.id, log))}
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
