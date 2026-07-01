'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Student, CurriculumModule, HomeworkStatus, HomeworkSubmission, HomeworkTask, LessonPlan,
} from '@/lib/types'
import {
  Loader2, ChevronDown, QrCode, CheckCircle2, Clock, XCircle,
  Pencil, Check, ClipboardList, BarChart3, CheckCheck,
} from 'lucide-react'
import { QrScanner } from '@/components/qr-scanner'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'

const STATUS: Record<HomeworkStatus, { label: string; on: string; icon: React.ReactNode }> = {
  On_Time: { label: 'ตรงเวลา', on: 'bg-green-500 text-white', icon: <CheckCircle2 size={16} /> },
  Late:    { label: 'ส่งช้า',   on: 'bg-yellow-400 text-white', icon: <Clock size={16} /> },
  Missing: { label: 'ไม่ส่ง',   on: 'bg-red-500 text-white',    icon: <XCircle size={16} /> },
}

const TEACHER_KEY = 'sge_teacher_id'

function taskKey(moduleId: string, lessonPlanId: string | null): string {
  return `${moduleId}::${lessonPlanId ?? ''}`
}

export default function HomeworkPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()

  const [students, setStudents] = useState<Student[]>([])
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | null>(null)
  const [lessonPlans, setLessonPlans] = useState<Pick<LessonPlan, 'id' | 'module_id' | 'topic' | 'plan_number'>[]>([])
  const [tasks, setTasks] = useState<Map<string, HomeworkTask>>(new Map())
  const [allSubs, setAllSubs] = useState<HomeworkSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [view, setView] = useState<'summary' | 'entry'>('summary')
  const [markingAll, setMarkingAll] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState('')
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    async function load() {
      const [{ data: st }, { data: mods }, { data: tk }, { data: subsData }, { data: lps }] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
        supabase.from('homework_tasks').select('*').eq('school_id', schoolId),
        // PostgREST caps unlimited selects at 1000 rows by default -- this table accumulates
        // one row per student per module per lesson plan and had already silently exceeded
        // that, causing "existing row" lookups to miss real rows and insert duplicates instead
        // of updating them. Explicit high limit until this is properly paginated/scoped.
        supabase.from('homework_submissions').select('*').eq('school_id', schoolId).limit(20000),
        supabase.from('lesson_plans').select('id, module_id, topic, plan_number').eq('school_id', schoolId).order('plan_number'),
      ])

      // For teacher role use session.userId (set on login) — not TEACHER_KEY which can hold
      // a stale ID from when dropdown was still available on other pages.
      const session = getSession()
      const teacherId = session?.role === 'teacher' && session.userId
        ? session.userId
        : (typeof window !== 'undefined' ? localStorage.getItem(TEACHER_KEY) : null)

      let visibleMods = (mods ?? []) as CurriculumModule[]
      if (teacherId) {
        const { data: teacher } = await supabase
          .from('teachers').select('subjects').eq('id', teacherId).maybeSingle()
        const assignedSubjects = new Set<string>(teacher?.subjects ?? [])
        if (assignedSubjects.size > 0) {
          visibleMods = visibleMods.filter(m => assignedSubjects.has(m.subject))
        }
      }

      const lessonPlanList = (lps ?? []) as Pick<LessonPlan, 'id' | 'module_id' | 'topic' | 'plan_number'>[]

      setStudents(st ?? [])
      setModules(visibleMods)
      setLessonPlans(lessonPlanList)
      setTasks(new Map((tk ?? []).map((t: HomeworkTask) => [taskKey(t.module_id, t.lesson_plan_id), t])))
      setAllSubs(subsData ?? [])
      if (visibleMods[0]) {
        setSelectedModule(visibleMods[0].id)
        const firstLp = lessonPlanList
          .filter(lp => lp.module_id === visibleMods[0].id)
          .sort((a, b) => a.plan_number - b.plan_number)[0]
        setSelectedLessonPlanId(firstLp?.id ?? null)
      }

      if (teacherId) {
        const { data: links } = await supabase
          .from('teacher_classrooms').select('classrooms(name)').eq('teacher_id', teacherId)
        const names = (links ?? [])
          .map((r: { classrooms: { name: string } | { name: string }[] | null }) =>
            Array.isArray(r.classrooms) ? r.classrooms[0]?.name : r.classrooms?.name)
          .filter(Boolean) as string[]
        setBoundRooms(names)
      }
      setLoading(false)
    }
    load()
  }, [])

  // O(1) lookup: "studentId:moduleId" → status (module-level aggregate, used by overview/matrix)
  // A student can have more than one row per module now (one per lesson_plan_id, plus
  // possibly a legacy row with lesson_plan_id = null from before this column existed).
  // For module-level overview stats, collapse to the most recently created row per
  // student+module so a stale/legacy row never masks the one just saved.
  const latestByStudentModule = useMemo(() => {
    const map = new Map<string, HomeworkSubmission>()
    allSubs.forEach(s => {
      const key = `${s.student_id}:${s.module_id}`
      const existing = map.get(key)
      if (!existing || s.created_at > existing.created_at) map.set(key, s)
    })
    return map
  }, [allSubs])

  const subsLookup = useMemo(() =>
    new Map(Array.from(latestByStudentModule.entries()).map(([key, s]) => [key, s.status])),
    [latestByStudentModule]
  )

  // subs for current module + lesson plan (entry view)
  const subs = useMemo(() =>
    new Map(
      allSubs
        .filter(s => s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId)
        .map(s => [s.student_id, s.status])
    ),
    [allSubs, selectedModule, selectedLessonPlanId]
  )

  // lesson plans grouped by module, sorted by plan_number
  const lessonPlansByModule = useMemo(() => {
    const map = new Map<string, Pick<LessonPlan, 'id' | 'module_id' | 'topic' | 'plan_number'>[]>()
    lessonPlans.forEach(lp => {
      if (!lp.module_id) return
      const arr = map.get(lp.module_id) ?? []
      arr.push(lp)
      map.set(lp.module_id, arr)
    })
    map.forEach(arr => arr.sort((a, b) => a.plan_number - b.plan_number))
    return map
  }, [lessonPlans])

  function gotoModule(moduleId: string) {
    const lps = lessonPlansByModule.get(moduleId) ?? []
    setSelectedModule(moduleId)
    setSelectedLessonPlanId(lps[0]?.id ?? null)
    setView('entry')
  }

  function selectEntry(value: string) {
    const [moduleId, lpId] = value.split('::')
    setSelectedModule(moduleId)
    setSelectedLessonPlanId(lpId || null)
  }

  // unique subjects
  const subjects = useMemo(() =>
    Array.from(new Set(modules.map(m => m.subject).filter(Boolean))).sort(),
    [modules]
  )

  // modules filtered by subject
  const filteredModules = selectedSubject
    ? modules.filter(m => m.subject === selectedSubject)
    : modules

  useEffect(() => {
    setTaskTitle(tasks.get(taskKey(selectedModule, selectedLessonPlanId))?.title ?? '')
    setEditTask(false)
  }, [selectedModule, selectedLessonPlanId, tasks])

  // Re-reads the DB directly for exactly these students/module/lesson-plan and returns
  // fresh rows. Used after every write instead of trusting "no error" from the write
  // itself -- an update that matches zero rows (e.g. a stale/wrong id) reports success
  // with no error yet changes nothing, which is what's been causing "saved" states that
  // don't actually persist. This closes that gap by always checking the source of truth.
  async function fetchVerified(studentIds: string[]): Promise<HomeworkSubmission[]> {
    let q = supabase.from('homework_submissions').select('*')
      .eq('school_id', schoolId).eq('module_id', selectedModule).in('student_id', studentIds)
    q = selectedLessonPlanId ? q.eq('lesson_plan_id', selectedLessonPlanId) : q.is('lesson_plan_id', null)
    const { data } = await q
    return (data ?? []) as HomeworkSubmission[]
  }

  async function setStatus(studentId: string, status: HomeworkStatus) {
    const existing = allSubs.find(s =>
      s.student_id === studentId && s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId
    )
    setAllSubs(prev => [
      ...prev.filter(s => !(s.module_id === selectedModule && s.student_id === studentId && (s.lesson_plan_id ?? null) === selectedLessonPlanId)),
      { id: existing?.id ?? '', student_id: studentId, module_id: selectedModule, lesson_plan_id: selectedLessonPlanId, status, created_at: existing?.created_at ?? '' },
    ])

    try {
      if (existing?.id) {
        await supabase.from('homework_submissions').update({ status }).eq('id', existing.id)
      } else {
        await supabase.from('homework_submissions')
          .insert({ school_id: schoolId, student_id: studentId, module_id: selectedModule, lesson_plan_id: selectedLessonPlanId, status })
      }

      const [verified] = await fetchVerified([studentId])
      setAllSubs(prev => [
        ...prev.filter(s => !(s.student_id === studentId && s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId)),
        ...(verified ? [verified] : []),
      ])
      if (!verified || verified.status !== status) {
        alert('บันทึกไม่สำเร็จสำหรับนักเรียนคนนี้ กรุณาลองใหม่')
      }
    } catch (e) {
      // a thrown exception (network failure, etc.) instead of a Supabase {error} field
      // must not die silently — without this the optimistic update above would be the
      // only thing the teacher ever sees, with nothing actually persisted
      alert(`บันทึกไม่สำเร็จ (เกิดข้อผิดพลาดที่ไม่คาดคิด): ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function markAllOnTime() {
    if (markingAll) return
    setMarkingAll(true)
    try {
      const existingByStudent = new Map(
        allSubs
          .filter(s => s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId)
          .map(s => [s.student_id, s])
      )
      setAllSubs(prev => [
        ...prev.filter(s => !(s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId && visibleStudents.some(v => v.id === s.student_id))),
        ...visibleStudents.map(s => ({
          id: existingByStudent.get(s.id)?.id ?? '',
          student_id: s.id,
          module_id: selectedModule,
          lesson_plan_id: selectedLessonPlanId,
          status: 'On_Time' as HomeworkStatus,
          created_at: existingByStudent.get(s.id)?.created_at ?? '',
        })),
      ])
      await Promise.all(visibleStudents.map(async s => {
        // treat an existing row with no real id (e.g. a prior bulk-insert that never
        // got its id patched back) as "not existing" -- an update against id: '' would
        // match zero rows and silently no-op instead of ever persisting the change
        const existing = existingByStudent.get(s.id)
        if (existing?.id) {
          await supabase.from('homework_submissions').update({ status: 'On_Time' }).eq('id', existing.id)
        } else {
          await supabase.from('homework_submissions')
            .insert({ school_id: schoolId, student_id: s.id, module_id: selectedModule, lesson_plan_id: selectedLessonPlanId, status: 'On_Time' })
        }
      }))

      const studentIds = visibleStudents.map(s => s.id)
      const verifiedRows = await fetchVerified(studentIds)
      setAllSubs(prev => [
        ...prev.filter(s => !(s.module_id === selectedModule && (s.lesson_plan_id ?? null) === selectedLessonPlanId && studentIds.includes(s.student_id))),
        ...verifiedRows,
      ])

      const confirmed = new Set(verifiedRows.filter(s => s.status === 'On_Time').map(s => s.student_id))
      const notConfirmed = visibleStudents.filter(s => !confirmed.has(s.id))
      if (notConfirmed.length > 0) {
        alert(`บันทึกไม่ครบ ${notConfirmed.length} คน: ${notConfirmed.map(s => s.name).join(', ')}\nกรุณากด "ส่งทั้งหมด" อีกครั้ง`)
      }
    } catch (e) {
      // same rationale as setStatus's catch -- an unhandled rejection here would silently
      // leave the optimistic "everyone is On_Time" update on screen with nothing persisted,
      // and would also leave the button stuck disabled since markingAll never gets reset
      alert(`บันทึกไม่สำเร็จ (เกิดข้อผิดพลาดที่ไม่คาดคิด): ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setMarkingAll(false)
    }
  }

  async function saveTask() {
    const key = taskKey(selectedModule, selectedLessonPlanId)
    const existing = tasks.get(key)
    if (existing) {
      await supabase.from('homework_tasks').update({ title: taskTitle }).eq('id', existing.id)
      setTasks(prev => new Map(prev).set(key, { ...existing, title: taskTitle }))
    } else {
      const { data } = await supabase
        .from('homework_tasks')
        .insert({ school_id: schoolId, module_id: selectedModule, lesson_plan_id: selectedLessonPlanId, title: taskTitle })
        .select().single()
      if (data) setTasks(prev => new Map(prev).set(key, data as HomeworkTask))
    }
    setEditTask(false)
  }

  const allRooms = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  const roomOptions = boundRooms.length > 0 ? [...new Set(boundRooms)].sort() : allRooms

  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  function selectRoom(room: string | null) { setSelectedRoom(room); storeRoom(room) }

  const boundStudents = boundRooms.length > 0
    ? students.filter(s => boundRooms.includes(s.class_name))
    : students

  const visibleStudents = selectedRoom
    ? boundStudents.filter(s => s.class_name === selectedRoom)
    : boundStudents

  // matrix students: filtered by selected room (or all bound)
  const matrixStudents = selectedRoom
    ? boundStudents.filter(s => s.class_name === selectedRoom)
    : boundStudents

  function handleScan(text: string) {
    setScanning(false)
    const match = visibleStudents.find(s => s.id === text || s.id.startsWith(text))
    if (match) {
      setHighlightId(match.id)
      rowRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightId(null), 2500)
    } else {
      alert('ไม่พบนักเรียนจาก QR นี้')
    }
  }

  // summary cards per filtered module
  const summaryRows = filteredModules.map(mod => {
    const modSubs = matrixStudents
      .map(b => latestByStudentModule.get(`${b.id}:${mod.id}`))
      .filter((s): s is HomeworkSubmission => !!s)
    const total = matrixStudents.length
    const onTime = modSubs.filter(s => s.status === 'On_Time').length
    const late = modSubs.filter(s => s.status === 'Late').length
    const missing = modSubs.filter(s => s.status === 'Missing').length
    const pct = total > 0 ? Math.round((onTime + late) / total * 100) : 0
    const firstLp = (lessonPlansByModule.get(mod.id) ?? [])[0]
    const task = tasks.get(taskKey(mod.id, firstLp?.id ?? null))
    return { mod, task, onTime, late, missing, total, pct }
  })

  const doneCount = visibleStudents.filter(s => subs.has(s.id)).length
  const currentTask = tasks.get(taskKey(selectedModule, selectedLessonPlanId))

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ภาระงาน/ชิ้นงาน</h2>
          <p className="text-sm text-gray-500 mt-1">สรุปภาพรวม · ตารางรายนักเรียน · เช็กส่งงาน</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setScanning(true)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl">
          <QrCode size={15} /> สแกน QR
        </motion.button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setView('summary')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ${view === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          <BarChart3 size={14} /> ภาพรวมทั้งหมด
        </button>
        <button onClick={() => setView('entry')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ${view === 'entry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          <CheckCheck size={14} /> เช็คส่งงาน
        </button>
      </div>

      {/* ======= SUMMARY VIEW ======= */}
      {view === 'summary' && (
        <div className="space-y-4">

          {/* Room filter */}
          <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />

          {/* Subject filter pills */}
          {subjects.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedSubject('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-colors ${!selectedSubject ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ทั้งหมด
              </button>
              {subjects.map(s => (
                <button key={s}
                  onClick={() => setSelectedSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-colors ${selectedSubject === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* ── Matrix table ── */}
          {filteredModules.length > 0 && matrixStudents.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">ตารางรายนักเรียน</p>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> ตรงเวลา</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> ช้า</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> ไม่ส่ง</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> ยังไม่เช็ก</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="text-xs border-collapse" style={{ minWidth: `${140 + filteredModules.length * 52}px` }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-10 bg-gray-50 border-b border-gray-200 text-left px-3 py-2 font-semibold text-gray-600 w-36">
                        นักเรียน
                      </th>
                      {filteredModules.map(mod => {
                        const firstLp = (lessonPlansByModule.get(mod.id) ?? [])[0]
                        return (
                          <th key={mod.id} className="border-b border-gray-200 px-1 py-2 text-center font-medium text-gray-500 w-12">
                            <div className="text-[10px] font-semibold text-gray-700 leading-tight">{mod.module_code}</div>
                            <div className="text-[9px] text-gray-400 truncate max-w-[44px] mx-auto leading-tight mt-0.5">
                              {tasks.get(taskKey(mod.id, firstLp?.id ?? null))?.title?.slice(0, 6) ?? ''}
                            </div>
                          </th>
                        )
                      })}
                      <th className="border-b border-gray-200 px-2 py-2 text-center font-medium text-gray-500 w-12">
                        <div className="text-[10px] font-semibold text-gray-700">รวม</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixStudents.map((student, idx) => {
                      const submitted = filteredModules.filter(mod => {
                        const st = subsLookup.get(`${student.id}:${mod.id}`)
                        return st === 'On_Time' || st === 'Late'
                      }).length
                      const total = filteredModules.length
                      return (
                        <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                          <td className={`sticky left-0 z-10 border-b border-gray-100 px-3 py-2 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                            <p className="font-medium text-gray-800 truncate max-w-[120px]">{student.name}</p>
                            <p className="text-[10px] text-gray-400">{student.class_name}</p>
                          </td>
                          {filteredModules.map(mod => {
                            const status = subsLookup.get(`${student.id}:${mod.id}`)
                            return (
                              <td key={mod.id} className="border-b border-gray-100 text-center px-1 py-2">
                                <button
                                  onClick={() => gotoModule(mod.id)}
                                  title={status === 'On_Time' ? 'ตรงเวลา' : status === 'Late' ? 'ส่งช้า' : status === 'Missing' ? 'ไม่ส่ง' : 'ยังไม่เช็ก'}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-transform hover:scale-110"
                                >
                                  {status === 'On_Time' && <span className="w-4 h-4 rounded-full bg-green-500 inline-block" />}
                                  {status === 'Late'    && <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block" />}
                                  {status === 'Missing' && <span className="w-4 h-4 rounded-full bg-red-400 inline-block" />}
                                  {!status              && <span className="w-4 h-4 rounded-full bg-gray-200 inline-block" />}
                                </button>
                              </td>
                            )
                          })}
                          <td className="border-b border-gray-100 text-center px-2 py-2">
                            <span className={`text-[11px] font-bold ${submitted === total ? 'text-green-600' : submitted >= total * 0.8 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {submitted}/{total}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Summary cards per module ── */}
          <p className="text-xs font-semibold text-gray-500 mt-2">สรุปรายภาระงาน</p>
          {summaryRows.map(({ mod, task, onTime, late, missing, total, pct }) => {
            const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
            const pctColor = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
            return (
              <button key={mod.id}
                onClick={() => gotoModule(mod.id)}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500">{mod.module_code}</p>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{task?.title ?? mod.title}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${pctColor}`}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-3 text-[11px]">
                  <span className="flex items-center gap-0.5 text-green-700 font-semibold"><CheckCircle2 size={11} /> {onTime}</span>
                  <span className="flex items-center gap-0.5 text-yellow-600 font-semibold"><Clock size={11} /> {late}</span>
                  <span className="flex items-center gap-0.5 text-red-500 font-semibold"><XCircle size={11} /> {missing}</span>
                  <span className="ml-auto text-gray-400">จาก {total} คน</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ======= ENTRY VIEW ======= */}
      {view === 'entry' && (
        <div className="space-y-4">
          {/* Module / lesson-plan selector — explodes into hours when a module has multiple plans */}
          <div className="relative">
            <select value={`${selectedModule}::${selectedLessonPlanId ?? ''}`} onChange={e => selectEntry(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {modules.map(m => {
                const lps = lessonPlansByModule.get(m.id) ?? []
                if (lps.length > 0) {
                  return (
                    <optgroup key={m.id} label={m.title}>
                      {lps.map(lp => (
                        <option key={lp.id} value={`${m.id}::${lp.id}`}>{`#${lp.plan_number} ${lp.topic}`}</option>
                      ))}
                    </optgroup>
                  )
                }
                return <option key={m.id} value={`${m.id}::`}>{m.module_code} — {m.title}</option>
              })}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {(() => {
            const mod = modules.find(m => m.id === selectedModule)
            const lp = selectedLessonPlanId ? lessonPlans.find(l => l.id === selectedLessonPlanId) : null
            if (!mod) return null
            return (
              <p className="text-xs text-gray-400 -mt-1">
                {lp ? `${mod.title} — ${lp.topic}` : mod.title}
              </p>
            )
          })()}

          {/* Task */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <ClipboardList size={14} /> งานวันนี้/สัปดาห์นี้
              </span>
              {!editTask ? (
                <button onClick={() => setEditTask(true)} className="text-xs text-amber-600 flex items-center gap-1">
                  <Pencil size={11} /> แก้ไข
                </button>
              ) : (
                <button onClick={saveTask} className="text-xs text-green-600 flex items-center gap-1">
                  <Check size={12} /> บันทึก
                </button>
              )}
            </div>
            {editTask ? (
              <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                className="w-full mt-1.5 text-sm bg-white border border-amber-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="เช่น คัดคำควบกล้ำแท้ 10 คำ" />
            ) : (
              <p className="text-sm text-amber-800 mt-1">{currentTask?.title ?? 'ยังไม่ได้กำหนดงาน'}</p>
            )}
          </div>

          {/* Room filter */}
          <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />

          {/* Progress + bulk */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>เช็กแล้ว {doneCount}/{visibleStudents.length} คน</span>
                <span className="text-gray-400">{selectedRoom ?? 'ทุกห้อง'}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div className="h-full bg-green-500 rounded-full"
                  animate={{ width: `${(doneCount / Math.max(1, visibleStudents.length)) * 100}%` }} />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={markAllOnTime} disabled={markingAll}
              className="flex-shrink-0 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2.5 rounded-xl">
              {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              ส่งทั้งหมด
            </motion.button>
          </div>

          {/* Students */}
          <div className="space-y-2">
            {visibleStudents.map(student => {
              const current = subs.get(student.id)
              const highlighted = highlightId === student.id
              return (
                <div key={student.id} ref={el => { rowRefs.current[student.id] = el }}
                  className={`rounded-2xl border px-4 py-3 transition-all ${highlighted ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-400">{student.class_name}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {(Object.entries(STATUS) as [HomeworkStatus, typeof STATUS[HomeworkStatus]][]).map(([s, cfg]) => (
                        <motion.button key={s} whileTap={{ scale: 0.9 }} onClick={() => setStatus(student.id, s)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${current === s ? cfg.on : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {cfg.icon}
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
