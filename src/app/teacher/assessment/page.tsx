'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  CurriculumModule, Student, Teacher, FocusColor, StudentAssessment, AcademicSettings,
  AttendanceRecord, AttendanceStatus,
} from '@/lib/types'
import { currentAcademicWeek, isCurrentWeekModule } from '@/lib/pacing'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreModeSwitch } from '@/components/score-mode-switch'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { Loader2, CheckCircle2, ChevronDown, UserCircle2, Info, Zap, CalendarCheck } from 'lucide-react'

const TEACHER_KEY = 'sge_teacher_id'

type StudentGrade = {
  academic_score: 0 | 1 | 2
  focus_color: FocusColor
  soft_skill_score: 0 | 1 | 2
  saved: boolean
  recordId: string | null // today's existing row (same-day edits update in place)
  touched: boolean        // ครูแตะรายคนเอง (ข้อยกเว้น)
  fromDefault: boolean    // ถูกตั้งจากแถบ "ตั้งค่าทั้งห้อง"
}

type ClassDefault = {
  academic_score: 0 | 1 | 2
  focus_color: FocusColor
  soft_skill_score: 0 | 1 | 2
}

const FOCUS_CONFIG: Record<FocusColor, { label: string; bg: string; active: string }> = {
  Green:  { label: 'โฟกัส', bg: 'bg-gray-100 text-gray-500', active: 'bg-green-500 text-white' },
  Yellow: { label: 'วอกแวก', bg: 'bg-gray-100 text-gray-500', active: 'bg-yellow-400 text-white' },
  Red:    { label: 'ไม่ตั้งใจ', bg: 'bg-gray-100 text-gray-500', active: 'bg-red-500 text-white' },
}

// ระดับการมีส่วนร่วมช่วงกิจกรรมกลุ่ม 20 นาที (Active)
const SOFT_CONFIG: Record<0 | 1 | 2, { label: string; active: string }> = {
  0: { label: 'ยังไม่ร่วม', active: 'bg-gray-500 text-white' },
  1: { label: 'ร่วมเมื่อชวน', active: 'bg-sky-500 text-white' },
  2: { label: 'ร่วม+ช่วยเพื่อน', active: 'bg-indigo-600 text-white' },
}

/** ผ่าน / ไม่ผ่าน Exit Ticket: 0=ยังไม่บันทึก, 1=ไม่ผ่าน, 2=ผ่าน */
function PassFail({ value, onChange }: { value: 0 | 1 | 2; onChange: (v: 0 | 1 | 2) => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChange(value === 1 ? 0 : 1)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${value === 1 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}
      >
        ไม่ผ่าน
      </button>
      <button
        onClick={() => onChange(value === 2 ? 0 : 2)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${value === 2 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}
      >
        ผ่าน
      </button>
    </div>
  )
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ลำดับการแตะวน: มา → ขาด → ป่วย → ลา → สาย → มา
const ATTEND_CYCLE: (AttendanceStatus | null)[] = [null, 'absent', 'sick', 'leave', 'late']
const ATTEND_META: Record<AttendanceStatus, { label: string; cls: string }> = {
  absent: { label: 'ขาด', cls: 'bg-red-500 border-red-500 text-white' },
  sick:   { label: 'ป่วย', cls: 'bg-amber-500 border-amber-500 text-white' },
  leave:  { label: 'ลา', cls: 'bg-blue-500 border-blue-500 text-white' },
  late:   { label: 'สาย', cls: 'bg-yellow-400 border-yellow-400 text-white' },
}

export default function AssessmentPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [isTeacherRole, setIsTeacherRole] = useState(false)
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [settings, setSettings] = useState<AcademicSettings | null>(null)
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [grades, setGrades] = useState<Record<string, StudentGrade>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [allSaved, setAllSaved] = useState(false)
  const [classDefault, setClassDefault] = useState<ClassDefault>({
    academic_score: 2, focus_color: 'Green', soft_skill_score: 1,
  })
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [attendOpen, setAttendOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: stds }, { data: mods }, { data: ts }, { data: st }] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('class_name').order('student_number'),
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
      ])
      setStudents(stds ?? [])
      setModules(mods ?? [])
      setTeachers(ts ?? [])
      setSettings(st ?? null)
      const session = getSession()
      setIsTeacherRole(session?.role === 'teacher')
      const stored = typeof window !== 'undefined' ? localStorage.getItem(TEACHER_KEY) : null
      if (stored) setTeacherId(stored)
      setLoading(false)
    }
    load()
  }, [])

  // rooms bound to the selected teacher
  useEffect(() => {
    if (!teacherId) { setBoundRooms([]); return }
    async function loadRooms() {
      const { data } = await supabase
        .from('teacher_classrooms')
        .select('classroom_id, classrooms(name)')
        .eq('teacher_id', teacherId)
      const names = (data ?? [])
        .map((r: { classrooms: { name: string } | { name: string }[] | null }) =>
          Array.isArray(r.classrooms) ? r.classrooms[0]?.name : r.classrooms?.name)
        .filter(Boolean) as string[]
      setBoundRooms(names)
    }
    loadRooms()
  }, [teacherId])

  const teacher = teachers.find(t => t.id === teacherId)
  const roomFiltered = boundRooms.length > 0
  const allRooms = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  const roomOptions = roomFiltered ? [...boundRooms].sort() : allRooms
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  // default ห้องแรก (หรือห้องที่จำไว้) เมื่อรายการห้องพร้อม
  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  function selectRoom(room: string | null) {
    setSelectedRoom(room)
    storeRoom(room)
  }

  const boundStudents = roomFiltered ? students.filter(s => boundRooms.includes(s.class_name)) : students
  const visibleStudents = selectedRoom ? boundStudents.filter(s => s.class_name === selectedRoom) : boundStudents
  const visibleModules = teacher && teacher.subjects?.length
    ? modules.filter(m => teacher.subjects.includes(m.subject))
    : modules

  // default module: ?module= → current-week lesson → first
  useEffect(() => {
    if (visibleModules.length === 0) return
    if (selectedModule && visibleModules.some(m => m.id === selectedModule)) return
    const wanted = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('module')
      : null
    const fromUrl = wanted ? visibleModules.find(m => m.id === wanted) : undefined
    const week = settings ? currentAcademicWeek(settings.term_start_date) : 0
    const thisWeek = week > 0 ? visibleModules.find(m => isCurrentWeekModule(m, week)) : undefined
    setSelectedModule((fromUrl ?? thisWeek ?? visibleModules[0]).id)
  }, [visibleModules.map(m => m.id).join(','), settings])

  // init grades + prefill today's existing records (one per student/module/day)
  useEffect(() => {
    if (!selectedModule || visibleStudents.length === 0) { setGrades({}); return }
    async function initGrades() {
      const { data: existing } = await supabase
        .from('student_assessments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('module_id', selectedModule)
        .gte('created_at', startOfTodayISO())
      const byStudent = new Map<string, StudentAssessment>()
      ;(existing ?? []).forEach((a: StudentAssessment) => byStudent.set(a.student_id, a))

      const initial: Record<string, StudentGrade> = {}
      visibleStudents.forEach(s => {
        const rec = byStudent.get(s.id)
        initial[s.id] = rec
          ? {
              academic_score: rec.academic_score as 0 | 1 | 2,
              focus_color: rec.focus_color,
              soft_skill_score: rec.soft_skill_score as 0 | 1 | 2,
              saved: true,
              recordId: rec.id,
              touched: false,
              fromDefault: false,
            }
          : { academic_score: 0, focus_color: 'Green', soft_skill_score: 0, saved: false, recordId: null, touched: false, fromDefault: false }
      })
      setGrades(initial)
      setAllSaved(visibleStudents.length > 0 && visibleStudents.every(s => initial[s.id]?.saved))
    }
    initGrades()
  }, [visibleStudents.map(s => s.id).join(','), selectedModule])

  function selectTeacher(id: string) {
    setTeacherId(id)
    localStorage.setItem(TEACHER_KEY, id)
  }

  // เช็คชื่อวันนี้ของห้องที่เลือก
  useEffect(() => {
    async function loadAttendance() {
      const { data } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('date', todayDateStr())
      const map: Record<string, AttendanceRecord> = {}
      ;(data ?? []).forEach((a: AttendanceRecord) => { map[a.student_id] = a })
      setAttendance(map)
    }
    loadAttendance()
  }, [selectedRoom])

  async function cycleAttendance(studentId: string) {
    const current = attendance[studentId]?.status ?? null
    const next = ATTEND_CYCLE[(ATTEND_CYCLE.indexOf(current) + 1) % ATTEND_CYCLE.length]
    if (next === null) {
      // กลับเป็น "มาเรียน" = ลบรายการ
      if (attendance[studentId]) {
        await supabase.from('attendance').delete().eq('id', attendance[studentId].id)
        setAttendance(prev => { const n = { ...prev }; delete n[studentId]; return n })
      }
      return
    }
    const { data } = await supabase.from('attendance')
      .upsert({ school_id: schoolId, student_id: studentId, date: todayDateStr(), status: next }, { onConflict: 'school_id,student_id,date' })
      .select().single()
    if (data) setAttendance(prev => ({ ...prev, [studentId]: data as AttendanceRecord }))
  }

  function updateGrade<K extends keyof StudentGrade>(studentId: string, key: K, value: StudentGrade[K]) {
    setGrades(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [key]: value, saved: false, touched: true },
    }))
    setAllSaved(false)
  }

  // จำนวนคนที่ยังไม่ถูกแตะรายคนและยังไม่บันทึก = เป้าหมายของ "ตั้งค่าทั้งห้อง"
  const untouchedCount = visibleStudents.filter(s => {
    const g = grades[s.id]
    return g && !g.saved && !g.touched
  }).length

  function applyClassDefault() {
    setGrades(prev => {
      const next = { ...prev }
      visibleStudents.forEach(s => {
        const g = next[s.id]
        if (!g || g.saved || g.touched) return
        next[s.id] = { ...g, ...classDefault, saved: false, fromDefault: true }
      })
      return next
    })
    setAllSaved(false)
  }

  async function persistGrade(studentId: string, grade: StudentGrade): Promise<string | null> {
    const payload = {
      school_id: schoolId,
      student_id: studentId,
      module_id: selectedModule,
      academic_score: grade.academic_score,
      focus_color: grade.focus_color,
      soft_skill_score: grade.soft_skill_score,
    }
    if (grade.recordId) {
      await supabase.from('student_assessments').update(payload).eq('id', grade.recordId)
      return grade.recordId
    }
    const { data } = await supabase.from('student_assessments').insert(payload).select('id').single()
    return data?.id ?? null
  }

  async function saveStudent(student: Student) {
    const grade = grades[student.id]
    if (!grade || !selectedModule) return
    setSaving(student.id)
    const id = await persistGrade(student.id, grade)
    setGrades(prev => ({
      ...prev,
      [student.id]: { ...prev[student.id], saved: true, recordId: id },
    }))
    setSaving(null)
  }

  async function saveAll() {
    if (!selectedModule) return
    setSaving('all')
    const unsaved = visibleStudents.filter(s => !grades[s.id]?.saved)
    const results = await Promise.all(
      unsaved.map(async s => ({ id: s.id, recordId: await persistGrade(s.id, grades[s.id]) }))
    )
    setGrades(prev => {
      const updated = { ...prev }
      results.forEach(r => { updated[r.id] = { ...updated[r.id], saved: true, recordId: r.recordId } })
      return updated
    })
    setAllSaved(true)
    setSaving(null)
  }

  const savedCount = visibleStudents.filter(s => grades[s.id]?.saved).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h2 className="text-xl font-bold text-gray-900">บันทึกคะแนน</h2>
        <p className="text-sm text-gray-500 mt-1">ประเมิน 3 มิติหลังจบคาบ — วันเดียวกันบันทึกซ้ำเพื่อแก้ไขได้</p>
      </div>

      <ScoreModeSwitch />

      {/* Teacher picker (filters rooms + subjects) — hidden for teacher role */}
      {!isTeacherRole && (
        <div className="relative">
          <UserCircle2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          <select
            value={teacherId ?? ''}
            onChange={e => selectTeacher(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="" disabled>เลือกชื่อครูผู้สอน...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* room-binding status */}
      {teacherId && !roomFiltered && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <p>
            ครูคนนี้ยังไม่ถูกผูกห้องเรียน — กำลังแสดงนักเรียนทุกห้อง ({students.length} คน)
            ผูกห้องได้ที่ <Link href="/admin/teachers" className="font-semibold underline">จัดการครู</Link>
          </p>
        </div>
      )}
      {/* เลือกห้อง — กันรายชื่อหลายห้องปนกัน */}
      <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />
      <p className="text-xs text-gray-400 -mt-1">
        {selectedRoom ?? 'ทุกห้อง'} — {visibleStudents.length} คน
      </p>

      {/* 📋 เช็คชื่อวันนี้ — ติ๊กเฉพาะคนที่ไม่มา (มาเรียน = ไม่ต้องแตะ) */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <button onClick={() => setAttendOpen(v => !v)} className="w-full flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <CalendarCheck size={14} className="text-emerald-500" />
            เช็คชื่อวันนี้ — แตะเฉพาะคนที่ไม่มา
          </span>
          <span className="flex items-center gap-2">
            {(() => {
              const marked = visibleStudents.filter(s => attendance[s.id])
              return marked.length > 0
                ? <span className="text-[11px] font-semibold text-red-500">ไม่มา {marked.length} คน</span>
                : <span className="text-[11px] font-semibold text-emerald-600">มาครบ {visibleStudents.length} คน</span>
            })()}
            <ChevronDown size={15} className={`text-gray-400 transition-transform ${attendOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {attendOpen && (
          <div className="mt-3">
            <p className="text-[10px] text-gray-400 mb-2">แตะชื่อเพื่อวนสถานะ: มา → <span className="text-red-500 font-semibold">ขาด</span> → <span className="text-amber-500 font-semibold">ป่วย</span> → <span className="text-blue-500 font-semibold">ลา</span> → <span className="text-yellow-500 font-semibold">สาย</span> → มา</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleStudents.map(s => {
                const st = attendance[s.id]?.status
                const meta = st ? ATTEND_META[st] : null
                const firstName = s.name.replace(/เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\./g, '').trim().split(' ')[0]
                return (
                  <button key={s.id} onClick={() => cycleAttendance(s.id)}
                    className={`text-[11px] font-medium px-2 py-1.5 rounded-lg border transition-colors ${
                      meta ? meta.cls : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {firstName}{meta && <span className="ml-1 font-bold">· {meta.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Module selector */}
      <div className="relative">
        <select
          value={selectedModule}
          onChange={e => setSelectedModule(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {visibleModules.map(m => (
            <option key={m.id} value={m.id}>
              {m.module_code} — {m.title}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>บันทึกแล้ว {savedCount}/{visibleStudents.length} คน</span>
        {savedCount > 0 && visibleStudents.length > 0 && (
          <span className="text-green-600 font-medium">{Math.round((savedCount / visibleStudents.length) * 100)}%</span>
        )}
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${visibleStudents.length ? (savedCount / visibleStudents.length) * 100 : 0}%` }}
        />
      </div>

      {/* ⚡ ตั้งค่าทั้งห้อง — ประเมินเฉพาะข้อยกเว้น */}
      {untouchedCount > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-4 py-3.5">
          <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
            <Zap size={13} className="fill-blue-500 text-blue-500" /> ตั้งค่าทั้งห้องก่อน แล้วแก้เฉพาะคนที่ต่างออกไป
          </p>

          <div className="space-y-2 mt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 w-20 flex-shrink-0">สมาธิ</span>
              <div className="flex gap-1.5">
                {(Object.entries(FOCUS_CONFIG) as [FocusColor, typeof FOCUS_CONFIG[FocusColor]][]).map(([color, cfg]) => (
                  <button key={color}
                    onClick={() => setClassDefault(d => ({ ...d, focus_color: color }))}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${classDefault.focus_color === color ? cfg.active : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 w-20 flex-shrink-0">ทักษะสังคม</span>
              <div className="flex gap-1.5">
                {([0, 1, 2] as const).map(level => (
                  <button key={level}
                    onClick={() => setClassDefault(d => ({ ...d, soft_skill_score: level }))}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${classDefault.soft_skill_score === level ? SOFT_CONFIG[level].active : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {SOFT_CONFIG[level].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 w-20 flex-shrink-0">ผลการเรียน</span>
              <PassFail
                value={classDefault.academic_score}
                onChange={v => setClassDefault(d => ({ ...d, academic_score: v }))}
              />
            </div>
          </div>

          <button onClick={applyClassDefault}
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors active:scale-[0.99] flex items-center justify-center gap-1.5">
            <Zap size={13} /> ใช้กับ {untouchedCount} คนที่ยังไม่ได้แตะ
          </button>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">คนที่ครูแตะรายคนแล้วหรือบันทึกแล้ว จะไม่ถูกเปลี่ยน — อย่าลืมกดบันทึกทั้งหมดท้ายหน้า</p>
        </div>
      )}

      {/* Student cards — rows follow the 10-15-20-5 routine order */}
      <div className="space-y-3">
        {visibleStudents.map(student => {
          const grade = grades[student.id] ?? {
            academic_score: 0 as const, focus_color: 'Green' as FocusColor,
            soft_skill_score: 0 as const, saved: false, recordId: null,
            touched: false, fromDefault: false,
          }
          const isSaving = saving === student.id
          return (
            <Card
              key={student.id}
              className={`border shadow-sm transition-all ${grade.saved ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
            >
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      {student.name}
                      {grade.fromDefault && !grade.touched && !grade.saved && (
                        <span className="text-[9px] font-medium bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded-full">ค่าทั้งห้อง</span>
                      )}
                      {attendance[student.id] && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ATTEND_META[attendance[student.id].status].cls}`}>
                          {ATTEND_META[attendance[student.id].status].label}วันนี้
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{student.class_name}</p>
                  </div>
                  {grade.saved ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <button
                      onClick={() => saveStudent(student)}
                      disabled={isSaving}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 size={14} className="animate-spin" /> : grade.recordId ? 'บันทึกแก้ไข' : 'บันทึก'}
                    </button>
                  )}
                </div>

                {/* ① สมาธิ — สังเกตทั้งคาบ ตั้งแต่ช่วง Hook */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-24 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-600 block">สมาธิ</span>
                    <span className="text-[10px] text-gray-400 leading-tight block">ภาพรวมทั้งคาบ</span>
                  </div>
                  <div className="flex gap-1.5">
                    {(Object.entries(FOCUS_CONFIG) as [FocusColor, typeof FOCUS_CONFIG[FocusColor]][]).map(([color, cfg]) => (
                      <button
                        key={color}
                        onClick={() => updateGrade(student.id, 'focus_color', color)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${grade.focus_color === color ? cfg.active : cfg.bg}`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ② ทักษะสังคม — ระดับการมีส่วนร่วมช่วงกิจกรรมกลุ่ม */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-24 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-600 block">ทักษะสังคม</span>
                    <span className="text-[10px] text-gray-400 leading-tight block">ช่วงกิจกรรมกลุ่ม 20 นาที</span>
                  </div>
                  <div className="flex gap-1.5">
                    {([0, 1, 2] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => updateGrade(student.id, 'soft_skill_score', level)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${
                          grade.soft_skill_score === level ? SOFT_CONFIG[level].active : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {SOFT_CONFIG[level].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ③ ผลการเรียน — Exit Ticket ท้ายคาบ */}
                <div className="flex items-center justify-between">
                  <div className="w-24 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-600 block">ผลการเรียน</span>
                    <span className="text-[10px] text-gray-400 leading-tight block">ตามจุดประสงค์การเรียนรู้</span>
                  </div>
                  <PassFail
                    value={grade.academic_score}
                    onChange={v => updateGrade(student.id, 'academic_score', v)}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
        {visibleStudents.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">ไม่มีนักเรียนในห้องที่ผูกไว้ — ตรวจสอบที่ จัดการครู</p>
        )}
      </div>

      {/* Save all sticky button */}
      {!allSaved && visibleStudents.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={saveAll}
              disabled={saving === 'all'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg text-sm transition-all active:scale-98 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving === 'all' ? (
                <><Loader2 size={18} className="animate-spin" /> กำลังบันทึก...</>
              ) : (
                <>บันทึกทั้งหมด ({visibleStudents.length - savedCount} คน)</>
              )}
            </button>
          </div>
        </div>
      )}

      {allSaved && visibleStudents.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <CheckCircle2 size={28} className="text-green-500 mx-auto mb-1" />
          <p className="text-sm font-semibold text-green-800">บันทึกครบทุกคนแล้ว! แตะการ์ดเพื่อแก้ไขได้ตลอดวันนี้</p>
        </div>
      )}
    </div>
  )
}
