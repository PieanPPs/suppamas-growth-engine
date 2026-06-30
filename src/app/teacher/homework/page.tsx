'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Student, CurriculumModule, HomeworkStatus, HomeworkSubmission, HomeworkTask,
} from '@/lib/types'
import {
  Loader2, ChevronDown, QrCode, CheckCircle2, Clock, XCircle,
  Pencil, Check, ClipboardList, BarChart3, CheckCheck,
} from 'lucide-react'
import { QrScanner } from '@/components/qr-scanner'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { getSchoolId } from '@/lib/school'

const STATUS: Record<HomeworkStatus, { label: string; on: string; icon: React.ReactNode }> = {
  On_Time: { label: 'ตรงเวลา', on: 'bg-green-500 text-white', icon: <CheckCircle2 size={16} /> },
  Late:    { label: 'ส่งช้า',   on: 'bg-yellow-400 text-white', icon: <Clock size={16} /> },
  Missing: { label: 'ไม่ส่ง',   on: 'bg-red-500 text-white',    icon: <XCircle size={16} /> },
}

const TEACHER_KEY = 'sge_teacher_id'

export default function HomeworkPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()

  const [students, setStudents] = useState<Student[]>([])
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [selectedModule, setSelectedModule] = useState('')
  const [tasks, setTasks] = useState<Map<string, HomeworkTask>>(new Map())
  const [allSubs, setAllSubs] = useState<HomeworkSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [view, setView] = useState<'summary' | 'entry'>('summary')
  const [markingAll, setMarkingAll] = useState(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    async function load() {
      const [{ data: st }, { data: mods }, { data: tk }, { data: subsData }] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
        supabase.from('homework_tasks').select('*').eq('school_id', schoolId),
        supabase.from('homework_submissions').select('*').eq('school_id', schoolId),
      ])
      setStudents(st ?? [])
      setModules(mods ?? [])
      setTasks(new Map((tk ?? []).map((t: HomeworkTask) => [t.module_id, t])))
      setAllSubs(subsData ?? [])
      if (mods?.[0]) setSelectedModule(mods[0].id)

      const teacherId = typeof window !== 'undefined' ? localStorage.getItem(TEACHER_KEY) : null
      if (teacherId) {
        const { data: links } = await supabase
          .from('teacher_classrooms')
          .select('classrooms(name)')
          .eq('teacher_id', teacherId)
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

  // subs derived from allSubs for selected module
  const subs = new Map(
    allSubs.filter(s => s.module_id === selectedModule).map(s => [s.student_id, s.status])
  )

  // sync task title when module changes
  useEffect(() => {
    setTaskTitle(tasks.get(selectedModule)?.title ?? '')
    setEditTask(false)
  }, [selectedModule, tasks])

  async function setStatus(studentId: string, status: HomeworkStatus) {
    setAllSubs(prev => [
      ...prev.filter(s => !(s.module_id === selectedModule && s.student_id === studentId)),
      { id: '', student_id: studentId, module_id: selectedModule, status, created_at: '' },
    ])
    await supabase.from('homework_submissions').upsert(
      { school_id: schoolId, student_id: studentId, module_id: selectedModule, status },
      { onConflict: 'school_id,student_id,module_id' }
    )
  }

  async function markAllOnTime() {
    if (markingAll) return
    setMarkingAll(true)
    setAllSubs(prev => [
      ...prev.filter(s => !(s.module_id === selectedModule && visibleStudents.some(v => v.id === s.student_id))),
      ...visibleStudents.map(s => ({ id: '', student_id: s.id, module_id: selectedModule, status: 'On_Time' as HomeworkStatus, created_at: '' })),
    ])
    await supabase.from('homework_submissions').upsert(
      visibleStudents.map(s => ({ school_id: schoolId, student_id: s.id, module_id: selectedModule, status: 'On_Time' })),
      { onConflict: 'school_id,student_id,module_id' }
    )
    setMarkingAll(false)
  }

  async function saveTask() {
    const existing = tasks.get(selectedModule)
    if (existing) {
      await supabase.from('homework_tasks').update({ title: taskTitle }).eq('id', existing.id)
      setTasks(prev => new Map(prev).set(selectedModule, { ...existing, title: taskTitle }))
    } else {
      const { data } = await supabase
        .from('homework_tasks')
        .insert({ school_id: schoolId, module_id: selectedModule, title: taskTitle })
        .select().single()
      if (data) setTasks(prev => new Map(prev).set(selectedModule, data as HomeworkTask))
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

  // summary per module (filtered to bound students only)
  const summaryRows = modules.map(mod => {
    const modSubs = allSubs.filter(s => s.module_id === mod.id && boundStudents.some(b => b.id === s.student_id))
    const total = boundStudents.length
    const onTime = modSubs.filter(s => s.status === 'On_Time').length
    const late = modSubs.filter(s => s.status === 'Late').length
    const missing = modSubs.filter(s => s.status === 'Missing').length
    const pct = total > 0 ? Math.round((onTime + late) / total * 100) : 0
    return { mod, task: tasks.get(mod.id), onTime, late, missing, total, pct }
  })

  const doneCount = visibleStudents.filter(s => subs.has(s.id)).length
  const currentTask = tasks.get(selectedModule)

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">การบ้าน</h2>
          <p className="text-sm text-gray-500 mt-1">สรุปภาพรวม · เช็กส่งงานรายคน</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setScanning(true)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2.5 rounded-xl">
          <QrCode size={15} /> สแกน QR
        </motion.button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setView('summary')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ${view === 'summary' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <BarChart3 size={14} /> ภาพรวมทั้งหมด
        </button>
        <button
          onClick={() => setView('entry')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-all ${view === 'entry' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          <CheckCheck size={14} /> เช็คส่งงาน
        </button>
      </div>

      {/* ======= SUMMARY VIEW ======= */}
      {view === 'summary' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">แสดงทุกวิชา · คลิกแถวเพื่อเช็คส่งงาน</p>
          {summaryRows.map(({ mod, task, onTime, late, missing, total, pct }) => {
            const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
            const pctColor = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
            return (
              <button
                key={mod.id}
                onClick={() => { setSelectedModule(mod.id); setView('entry') }}
                className="w-full text-left bg-white border border-gray-200 rounded-2xl px-4 py-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-500">{mod.module_code}</p>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{task?.title ?? mod.title}</p>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${pctColor}`}>{pct}%</span>
                </div>

                {/* progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>

                {/* counts */}
                <div className="flex gap-2 text-[11px]">
                  <span className="flex items-center gap-0.5 text-green-700 font-semibold">
                    <CheckCircle2 size={11} /> ตรงเวลา {onTime}
                  </span>
                  <span className="flex items-center gap-0.5 text-yellow-600 font-semibold">
                    <Clock size={11} /> ช้า {late}
                  </span>
                  <span className="flex items-center gap-0.5 text-red-500 font-semibold">
                    <XCircle size={11} /> ไม่ส่ง {missing}
                  </span>
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
          {/* Module selector */}
          <div className="relative">
            <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {modules.map(m => <option key={m.id} value={m.id}>{m.module_code} — {m.title}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Task / Quest */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                <ClipboardList size={14} /> ภารกิจสัปดาห์นี้
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
              <p className="text-sm text-amber-800 mt-1">{currentTask?.title ?? 'ยังไม่ได้กำหนดภารกิจ'}</p>
            )}
          </div>

          {/* Room filter */}
          <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />

          {/* Progress + bulk button */}
          <div className="flex items-center justify-between gap-3">
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
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={markAllOnTime}
              disabled={markingAll}
              className="flex-shrink-0 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2.5 rounded-xl"
            >
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
                <div
                  key={student.id}
                  ref={el => { rowRefs.current[student.id] = el }}
                  className={`rounded-2xl border px-4 py-3 transition-all ${
                    highlighted ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{student.name}</p>
                      <p className="text-xs text-gray-400">{student.class_name}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {(Object.entries(STATUS) as [HomeworkStatus, typeof STATUS[HomeworkStatus]][]).map(([s, cfg]) => (
                        <motion.button
                          key={s}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setStatus(student.id, s)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                            current === s ? cfg.on : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
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
