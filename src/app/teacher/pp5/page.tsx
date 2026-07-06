'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Student, Teacher, Course, Test, TestScore, StudentAssessment, CurriculumModule,
  ScoreComponent, ComponentScore, ScorePhase, ScoreSource, HomeworkSubmission, TraitRating,
  AttendanceRecord,
} from '@/lib/types'
import {
  TRAIT_ITEMS, LEVEL_LABELS, LEVEL_COLORS, buildEvidence, suggestTrait, suggestRwa, evidenceNote,
} from '@/lib/traits'
import { ScoreModeSwitch } from '@/components/score-mode-switch'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import {
  buildPp5Row, defaultStructure, GRADE_COLORS, PHASE_LABEL,
} from '@/lib/pp5'
import {
  Loader2, ChevronDown, UserCircle2, Plus, X, Check, Settings2, Trash2,
  Printer, Save, Sparkles, BookCheck, Info,
} from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { fetchAllPaged, latestAssessmentPerPlan } from '@/lib/db'

const TEACHER_KEY = 'sge_teacher_id'

const SOURCE_LABEL: Record<ScoreSource, string> = {
  manual: 'กรอกเอง',
  test: 'ดึงจากแบบทดสอบ',
  stars: 'ดาวรายคาบ (อัตโนมัติ)',
}

export default function Pp5Page() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [isTeacherRole, setIsTeacherRole] = useState(false)
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [assessments, setAssessments] = useState<StudentAssessment[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testScores, setTestScores] = useState<TestScore[]>([])
  const [components, setComponents] = useState<ScoreComponent[]>([])
  const [savedScores, setSavedScores] = useState<ComponentScore[]>([])
  const [homework, setHomework] = useState<HomeworkSubmission[]>([])
  const [traitRatings, setTraitRatings] = useState<TraitRating[]>([])
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRecord[]>([])
  const [view, setView] = useState<'scores' | 'traits'>('scores')
  const [traitCells, setTraitCells] = useState<Record<string, number>>({})
  const [savedTraitKeys, setSavedTraitKeys] = useState<Set<string>>(new Set())

  const [subject, setSubject] = useState('')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({}) // `${componentId}_${studentId}`
  const [structureOpen, setStructureOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // component editor draft
  const [editingComp, setEditingComp] = useState<ScoreComponent | 'new' | null>(null)
  const [compDraft, setCompDraft] = useState({ name: '', max: '10', phase: 'before_mid' as ScorePhase, source: 'manual' as ScoreSource, testId: '' })

  async function loadAll() {
    const [
      { data: ts }, { data: crs }, { data: stds }, { data: mods },
      asm, { data: tst }, tsc, { data: comps }, cs,
      hw, tr, att,
    ] = await Promise.all([
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('*').eq('school_id', schoolId).order('class_name').order('student_number'),
      supabase.from('curriculum_modules').select('id, subject').eq('school_id', schoolId),
      // page through — these tables exceed Supabase's 1000-row-per-request cap
      fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').eq('school_id', schoolId).order('id')),
      supabase.from('tests').select('*').eq('school_id', schoolId).order('test_date'),
      fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
      supabase.from('score_components').select('*').eq('school_id', schoolId).order('sequence_order'),
      fetchAllPaged<ComponentScore>(() => supabase.from('component_scores').select('*').order('id')),
      fetchAllPaged<HomeworkSubmission>(() => supabase.from('homework_submissions').select('*').eq('school_id', schoolId).order('id')),
      fetchAllPaged<TraitRating>(() => supabase.from('trait_ratings').select('*').eq('school_id', schoolId).order('id')),
      fetchAllPaged<AttendanceRecord>(() => supabase.from('attendance').select('*').eq('school_id', schoolId).order('id')),
    ])
    setTeachers(ts ?? []); setCourses(crs ?? []); setStudents(stds ?? [])
    setModules((mods ?? []) as CurriculumModule[])
    setAssessments(latestAssessmentPerPlan(asm)); setTests(tst ?? []); setTestScores(tsc)
    setComponents(comps ?? []); setSavedScores(cs)
    setHomework(hw); setTraitRatings(tr); setAttendanceRows(att)
    const session = getSession()
    const isTeacher = session?.role === 'teacher'
    setIsTeacherRole(isTeacher)
    const effectiveId = isTeacher && session?.userId
      ? session.userId
      : (typeof window !== 'undefined' ? localStorage.getItem(TEACHER_KEY) : null)
    if (effectiveId) setTeacherId(effectiveId)
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (!teacherId) { setBoundRooms([]); return }
    async function loadRooms() {
      const { data } = await supabase
        .from('teacher_classrooms').select('classrooms(name)').eq('teacher_id', teacherId)
      const names = (data ?? [])
        .map((r: { classrooms: { name: string } | { name: string }[] | null }) =>
          Array.isArray(r.classrooms) ? r.classrooms[0]?.name : r.classrooms?.name)
        .filter(Boolean) as string[]
      setBoundRooms(names)
    }
    loadRooms()
  }, [teacherId])

  const teacher = teachers.find(t => t.id === teacherId)
  const subjectOptions = teacher && teacher.subjects?.length
    ? courses.filter(c => teacher.subjects.includes(c.subject_key))
    : courses

  useEffect(() => {
    if (subjectOptions.length === 0) return
    if (subject && subjectOptions.some(c => c.subject_key === subject)) return
    setSubject(subjectOptions[0].subject_key)
  }, [subjectOptions.map(c => c.subject_key).join(','), subject])

  const allRooms = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  const roomOptions = boundRooms.length > 0 ? [...new Set(boundRooms)].sort() : allRooms

  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  function selectRoom(room: string | null) { setSelectedRoom(room); storeRoom(room) }
  function selectTeacher(id: string) { setTeacherId(id); localStorage.setItem(TEACHER_KEY, id) }

  const subjectComponents = components.filter(c => c.subject === subject)
  const subjectTests = tests.filter(t => t.subject === subject)
  const boundStudents = boundRooms.length > 0 ? students.filter(s => boundRooms.includes(s.class_name)) : students
  const visibleStudents = selectedRoom ? boundStudents.filter(s => s.class_name === selectedRoom) : boundStudents
  const moduleSubject = new Map(modules.map(m => [m.id, m.subject]))
  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key

  // เติมค่าที่บันทึกไว้ลงช่องกรอก
  useEffect(() => {
    const map: Record<string, string> = {}
    savedScores.forEach(cs => { map[`${cs.component_id}_${cs.student_id}`] = String(cs.score) })
    setInputs(map)
  }, [savedScores.map(s => s.id).join(',')])

  const manualMap = new Map<string, number>()
  Object.entries(inputs).forEach(([k, v]) => {
    if (v !== '' && !isNaN(Number(v))) manualMap.set(k, Number(v))
  })

  const rows = visibleStudents.map(s =>
    buildPp5Row(s.id, subjectComponents, manualMap, tests, testScores, assessments, moduleSubject)
  )

  const totalMax = subjectComponents.reduce((s, c) => s + c.max_score, 0)

  // % มาเรียนโดยประมาณ: วันเรียน = วันที่มีการประเมินใดๆ ในระบบ · ขาด/ป่วย/ลา = วันหาย
  const teachingDays = new Set(assessments.map(a => a.created_at.slice(0, 10))).size
  const missedDays = new Map<string, number>()
  attendanceRows.forEach(a => {
    if (a.status === 'late') return
    missedDays.set(a.student_id, (missedDays.get(a.student_id) ?? 0) + 1)
  })
  const attendancePctOf = (studentId: string): number | null => {
    if (teachingDays === 0) return null
    const missed = Math.min(teachingDays, missedDays.get(studentId) ?? 0)
    return Math.round(((teachingDays - missed) / teachingDays) * 100)
  }

  // ---- คุณลักษณะฯ: เติมค่า "บันทึกแล้ว ?? ระบบเสนอ" ----
  useEffect(() => {
    if (!subject || visibleStudents.length === 0) { setTraitCells({}); setSavedTraitKeys(new Set()); return }
    const saved = new Map<string, number>()
    traitRatings.filter(t => t.subject === subject).forEach(t => {
      saved.set(`${t.kind}_${t.item_no}_${t.student_id}`, t.level)
    })
    const cells: Record<string, number> = {}
    const savedKeys = new Set<string>()
    visibleStudents.forEach(s => {
      const ev = buildEvidence(s.id, subject, assessments, homework, moduleSubject, attendancePctOf(s.id))
      TRAIT_ITEMS.forEach(item => {
        const key = `trait_${item.no}_${s.id}`
        const sv = saved.get(key)
        cells[key] = sv ?? suggestTrait(item.no, ev)
        if (sv != null) savedKeys.add(key)
      })
      const rwaKey = `rwa_0_${s.id}`
      const rwaSv = saved.get(rwaKey)
      cells[rwaKey] = rwaSv ?? suggestRwa(ev)
      if (rwaSv != null) savedKeys.add(rwaKey)
    })
    setTraitCells(cells)
    setSavedTraitKeys(savedKeys)
  }, [subject, visibleStudents.map(s => s.id).join(','), traitRatings.map(t => t.id).join(','), attendanceRows.length])

  function cycleTrait(key: string) {
    setTraitCells(prev => {
      const cur = prev[key] ?? 2
      const next = cur <= 0 ? 3 : cur - 1 // 3→2→1→0→3
      return { ...prev, [key]: next }
    })
  }

  async function saveTraits() {
    setSaving(true)
    const rowsToSave: { school_id: string; student_id: string; subject: string; kind: string; item_no: number; level: number }[] = []
    visibleStudents.forEach(s => {
      TRAIT_ITEMS.forEach(item => {
        const v = traitCells[`trait_${item.no}_${s.id}`]
        if (v != null) rowsToSave.push({ school_id: schoolId, student_id: s.id, subject, kind: 'trait', item_no: item.no, level: v })
      })
      const rwa = traitCells[`rwa_0_${s.id}`]
      if (rwa != null) rowsToSave.push({ school_id: schoolId, student_id: s.id, subject, kind: 'rwa', item_no: 0, level: rwa })
    })
    if (rowsToSave.length > 0) {
      await supabase.from('trait_ratings').upsert(rowsToSave, { onConflict: 'school_id,student_id,subject,kind,item_no' })
    }
    const data = await fetchAllPaged<TraitRating>(() => supabase.from('trait_ratings').select('*').eq('school_id', schoolId).order('id'))
    setTraitRatings(data)
    setSaving(false)
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000)
  }

  // ---- structure CRUD ----
  function openCompEditor(c?: ScoreComponent) {
    setEditingComp(c ?? 'new')
    setCompDraft(c
      ? { name: c.name, max: String(c.max_score), phase: c.phase, source: c.source, testId: c.test_id ?? '' }
      : { name: '', max: '10', phase: 'before_mid', source: 'manual', testId: '' })
  }

  async function saveComponent() {
    if (!compDraft.name.trim() || !Number(compDraft.max)) return
    const payload = {
      subject, name: compDraft.name.trim(), max_score: Number(compDraft.max),
      phase: compDraft.phase, source: compDraft.source,
      test_id: compDraft.source === 'test' && compDraft.testId ? compDraft.testId : null,
    }
    if (editingComp && editingComp !== 'new') {
      await supabase.from('score_components').update(payload).eq('id', editingComp.id)
    } else {
      await supabase.from('score_components').insert({ school_id: schoolId, ...payload, sequence_order: subjectComponents.length + 1 })
    }
    const { data } = await supabase.from('score_components').select('*').eq('school_id', schoolId).order('sequence_order')
    setComponents(data ?? [])
    setEditingComp(null)
  }

  async function deleteComponent(id: string) {
    if (!confirm('ลบช่องคะแนนนี้พร้อมคะแนนที่กรอกไว้?')) return
    await supabase.from('score_components').delete().eq('id', id)
    const { data } = await supabase.from('score_components').select('*').eq('school_id', schoolId).order('sequence_order')
    setComponents(data ?? [])
  }

  async function createDefault() {
    await supabase.from('score_components').insert(defaultStructure(subject).map(r => ({ school_id: schoolId, ...r })))
    const { data } = await supabase.from('score_components').select('*').eq('school_id', schoolId).order('sequence_order')
    setComponents(data ?? [])
    setStructureOpen(true)
  }

  // ---- save manual scores ----
  async function saveAll() {
    setSaving(true)
    const rowsToSave: { component_id: string; student_id: string; score: number }[] = []
    subjectComponents.filter(c => c.source === 'manual').forEach(c => {
      visibleStudents.forEach(s => {
        const v = inputs[`${c.id}_${s.id}`]
        if (v !== undefined && v !== '' && !isNaN(Number(v))) {
          rowsToSave.push({
            component_id: c.id, student_id: s.id,
            score: Math.min(c.max_score, Math.max(0, Number(v))),
          })
        }
      })
    })
    if (rowsToSave.length > 0) {
      await supabase.from('component_scores').upsert(rowsToSave, { onConflict: 'component_id,student_id' })
    }
    const data = await fetchAllPaged<ComponentScore>(() => supabase.from('component_scores').select('*').order('id'))
    setSavedScores(data)
    setSaving(false)
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h2 className="text-xl font-bold text-gray-900">บันทึกคะแนน</h2>
        <p className="text-sm text-gray-500 mt-1">ปพ.5 — ระบบดึงคะแนนสอบและดาวรายคาบมาเติมให้ ครูกรอกเฉพาะช่อง "กรอกเอง"</p>
      </div>

      <ScoreModeSwitch />

      {/* Teacher picker — hidden for teacher role */}
      {!isTeacherRole && (
        <div className="relative">
          <UserCircle2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          <select value={teacherId ?? ''} onChange={e => selectTeacher(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="" disabled>เลือกชื่อครูผู้สอน...</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Subject picker */}
      <div className="relative">
        <select value={subject} onChange={e => setSubject(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {subjectOptions.map(c => <option key={c.id} value={c.subject_key}>{c.name}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />

      {/* มุมมอง: ตารางคะแนน | คุณลักษณะฯ */}
      <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-2xl p-1">
        <button onClick={() => setView('scores')}
          className={`text-xs font-semibold py-2.5 rounded-xl transition-all ${view === 'scores' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          ตารางคะแนน
        </button>
        <button onClick={() => setView('traits')}
          className={`text-xs font-semibold py-2.5 rounded-xl transition-all ${view === 'traits' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          คุณลักษณะฯ & อ่านคิดเขียน
        </button>
      </div>

      {view === 'traits' ? (
        <>
          <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 text-xs text-violet-700 leading-relaxed">
            <strong>ระบบเสนอ — ครูยืนยัน:</strong> ช่องที่มีวงแหวนคือค่าที่ระบบเสนอจากพฤติกรรมจริง
            (มีวินัย ← ส่งงานตรงเวลา · ใฝ่เรียนรู้ ← สมาธิ 🟢 · มุ่งมั่น ← ทักษะสังคม · จิตสาธารณะ ← ช่วยเพื่อน)
            แตะช่องเพื่อปรับระดับ แล้วกดบันทึกท้ายหน้า
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-2 py-2 text-left sticky left-0 bg-gray-50 min-w-[140px]">ชื่อ-สกุล</th>
                  {TRAIT_ITEMS.map(item => (
                    <th key={item.no} className="px-1 py-2 text-center font-medium" title={item.name}>
                      <span className="block text-[9.5px] leading-tight">{item.no}.{item.short}</span>
                      {item.auto && <span className="text-[8px] text-violet-400">⚡อัตโนมัติ</span>}
                    </th>
                  ))}
                  <th className="px-1 py-2 text-center font-medium">
                    <span className="block text-[9.5px] leading-tight">อ่านคิดฯ</span>
                    <span className="text-[8px] text-violet-400">⚡อัตโนมัติ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map(s => {
                  const ev = buildEvidence(s.id, subject, assessments, homework, moduleSubject, attendancePctOf(s.id))
                  const cellBtn = (key: string, note: string | null) => {
                    const v = traitCells[key] ?? 2
                    const isSaved = savedTraitKeys.has(key)
                    return (
                      <button onClick={() => cycleTrait(key)} title={note ?? undefined}
                        className={`min-w-[30px] text-[11px] font-bold px-1.5 py-1 rounded-lg transition-all active:scale-95 ${LEVEL_COLORS[v]} ${!isSaved ? 'ring-1 ring-violet-300' : ''}`}>
                        {v}
                      </button>
                    )
                  }
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 sticky left-0 bg-white">
                        <p className="font-medium text-gray-800 truncate max-w-[140px]">{s.name}</p>
                        <p className="text-[9px] text-gray-400">{s.class_name}</p>
                      </td>
                      {TRAIT_ITEMS.map(item => (
                        <td key={item.no} className="px-1 py-1.5 text-center">
                          {cellBtn(`trait_${item.no}_${s.id}`, evidenceNote(item.no, ev))}
                        </td>
                      ))}
                      <td className="px-1 py-1.5 text-center">
                        {cellBtn(`rwa_0_${s.id}`, ev.academicAvg != null ? `ผลการเรียนเฉลี่ย ${ev.academicAvg}/2` : null)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleStudents.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">ไม่มีนักเรียนในห้องที่เลือก</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            {([3, 2, 1, 0] as const).map(l => (
              <span key={l} className={`px-2 py-0.5 rounded-full font-semibold ${LEVEL_COLORS[l]}`}>{l} = {LEVEL_LABELS[l]}</span>
            ))}
            <span className="text-violet-500">วงแหวนม่วง = ระบบเสนอ ยังไม่บันทึก</span>
          </div>

          {/* sticky save (traits) */}
          <div className="fixed bottom-20 left-0 right-0 px-4">
            <div className="max-w-2xl mx-auto">
              <button onClick={saveTraits} disabled={saving}
                className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${savedFlash ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}>
                {saving ? <><Loader2 size={18} className="animate-spin" /> กำลังบันทึก...</>
                  : savedFlash ? <><Check size={18} /> บันทึกแล้ว</>
                  : <><Save size={16} /> ยืนยันคุณลักษณะฯ ({visibleStudents.length} คน)</>}
              </button>
            </div>
          </div>
        </>
      ) : subjectComponents.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-300 rounded-2xl bg-white">
          <BookCheck size={28} className="mx-auto text-gray-300" />
          <p className="text-sm font-semibold text-gray-600 mt-2">วิชานี้ยังไม่มีโครงสร้างคะแนน</p>
          <p className="text-xs text-gray-400 mt-1">เริ่มจากมาตรฐานโรงเรียน (เก็บ 50 + กลางภาค 20 + ปลายภาค 30) แล้วปรับแก้ได้</p>
          <button onClick={createDefault}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Sparkles size={14} className="inline mr-1" /> สร้างโครงสร้าง 70:30
          </button>
        </div>
      ) : (
        <>
          {/* ---- structure summary + editor toggle ---- */}
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
            <button onClick={() => setStructureOpen(v => !v)} className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Settings2 size={14} className="text-gray-400" />
                โครงสร้างคะแนน — เต็ม {totalMax} คะแนน ({subjectComponents.length} ช่อง)
              </span>
              <ChevronDown size={15} className={`text-gray-400 transition-transform ${structureOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {structureOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="space-y-1.5 mt-3">
                    {subjectComponents.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{c.name} <span className="text-gray-400 font-normal">(เต็ม {c.max_score})</span></p>
                          <p className="text-[10px] text-gray-400">
                            {PHASE_LABEL[c.phase]} · {SOURCE_LABEL[c.source]}
                            {c.source === 'test' && c.test_id && <> — {tests.find(t => t.id === c.test_id)?.title ?? '?'}</>}
                            {c.source === 'test' && !c.test_id && <span className="text-amber-500"> — ยังไม่เลือกข้อสอบ</span>}
                          </p>
                        </div>
                        <button onClick={() => openCompEditor(c)} className="text-gray-400 hover:text-blue-600 p-1"><Settings2 size={13} /></button>
                        <button onClick={() => deleteComponent(c.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>

                  {editingComp ? (
                    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3 mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-700">{editingComp === 'new' ? 'เพิ่มช่องคะแนน' : 'แก้ไขช่องคะแนน'}</p>
                        <button onClick={() => setEditingComp(null)} className="text-gray-400"><X size={14} /></button>
                      </div>
                      <input value={compDraft.name} onChange={e => setCompDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="ชื่อช่อง เช่น Workbook, Quiz, ชิ้นงาน"
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" min={1} value={compDraft.max} onChange={e => setCompDraft(d => ({ ...d, max: e.target.value }))}
                          placeholder="เต็ม" className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        <select value={compDraft.phase} onChange={e => setCompDraft(d => ({ ...d, phase: e.target.value as ScorePhase }))}
                          className="text-xs border border-gray-200 rounded-lg px-1.5 py-2 bg-white focus:outline-none">
                          {(Object.entries(PHASE_LABEL) as [ScorePhase, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={compDraft.source} onChange={e => setCompDraft(d => ({ ...d, source: e.target.value as ScoreSource }))}
                          className="text-xs border border-gray-200 rounded-lg px-1.5 py-2 bg-white focus:outline-none">
                          {(Object.entries(SOURCE_LABEL) as [ScoreSource, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      {compDraft.source === 'test' && (
                        <select value={compDraft.testId} onChange={e => setCompDraft(d => ({ ...d, testId: e.target.value }))}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none">
                          <option value="">เลือกแบบทดสอบ...</option>
                          {subjectTests.map(t => <option key={t.id} value={t.id}>{t.title} (เต็ม {t.max_score})</option>)}
                        </select>
                      )}
                      <button onClick={saveComponent} disabled={!compDraft.name.trim()}
                        className="w-full bg-blue-600 text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                        <Check size={13} /> บันทึกช่องคะแนน
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openCompEditor()}
                      className="w-full mt-2 border border-dashed border-blue-300 text-blue-600 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-50">
                      <Plus size={13} /> เพิ่มช่องคะแนน
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {totalMax !== 100 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <Info size={13} /> คะแนนเต็มรวมตอนนี้ {totalMax} (ปกติ ปพ.5 = 100) — ปรับที่โครงสร้างคะแนน
            </p>
          )}

          {/* ---- score grid ---- */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-2 py-2 text-left sticky left-0 bg-gray-50 min-w-[150px]">ชื่อ-สกุล</th>
                  {subjectComponents.map(c => (
                    <th key={c.id} className="px-1.5 py-2 text-center font-medium">
                      <span className="block truncate max-w-[64px] mx-auto">{c.name}</span>
                      <span className="text-[9px] text-gray-400 font-normal">
                        ({c.max_score}){c.source !== 'manual' && ' ⚡'}
                      </span>
                    </th>
                  ))}
                  <th className="px-1.5 py-2 text-center">เก็บ</th>
                  <th className="px-1.5 py-2 text-center">รวม<br /><span className="text-[9px] font-normal">({totalMax})</span></th>
                  <th className="px-2 py-2 text-center">เกรด</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((s, idx) => {
                  const row = rows[idx]
                  return (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 sticky left-0 bg-white">
                        <p className="font-medium text-gray-800 truncate max-w-[150px]">{s.name}</p>
                        <p className="text-[9px] text-gray-400">{s.class_name}{s.student_number ? ` · ${s.student_number}` : ''}</p>
                      </td>
                      {subjectComponents.map((c, ci) => {
                        const cell = row.cells[ci]
                        return (
                          <td key={c.id} className="px-1 py-1.5 text-center">
                            {cell.auto ? (
                              <span className={`font-semibold ${cell.value == null ? 'text-gray-300' : 'text-indigo-600'}`}>
                                {cell.value ?? '—'}
                              </span>
                            ) : (
                              <input
                                type="number" inputMode="decimal" min={0} max={c.max_score}
                                value={inputs[`${c.id}_${s.id}`] ?? ''}
                                onChange={e => setInputs(prev => ({ ...prev, [`${c.id}_${s.id}`]: e.target.value }))}
                                placeholder="—"
                                className="w-12 text-center text-xs border border-gray-200 rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              />
                            )}
                          </td>
                        )
                      })}
                      <td className="px-1.5 py-1.5 text-center font-semibold text-gray-700">{row.collectTotal}</td>
                      <td className="px-1.5 py-1.5 text-center font-bold text-gray-900">{row.total}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-block min-w-[34px] text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                          row.complete ? GRADE_COLORS[String(row.grade)] : 'bg-gray-100 text-gray-300'
                        }`}>
                          {row.complete ? row.grade : '…'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleStudents.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">ไม่มีนักเรียนในห้องที่เลือก</p>
            )}
          </div>

          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            ⚡ = ดึงอัตโนมัติจากแบบทดสอบ/ดาวรายคาบ (เทียบสัดส่วนให้แล้ว) · เกรดคิดเมื่อคะแนนครบทุกช่อง
          </p>

          {/* print */}
          <div className="grid grid-cols-2 gap-2">
            <a href={`/teacher/pp5/print?subject=${encodeURIComponent(subject)}&room=${encodeURIComponent(selectedRoom ?? '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold py-3 rounded-2xl transition-colors">
              <Printer size={14} /> พิมพ์ ปพ.5 {selectedRoom ? `(${selectedRoom})` : ''}
            </a>
            <a href={`/teacher/pp6/print?room=${encodeURIComponent(selectedRoom ?? '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-3 rounded-2xl transition-colors">
              <Printer size={14} /> ปพ.6 รายคน ทั้งห้อง
            </a>
          </div>

          {/* sticky save */}
          <div className="fixed bottom-20 left-0 right-0 px-4">
            <div className="max-w-2xl mx-auto">
              <button onClick={saveAll} disabled={saving}
                className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${savedFlash ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saving ? <><Loader2 size={18} className="animate-spin" /> กำลังบันทึก...</>
                  : savedFlash ? <><Check size={18} /> บันทึกแล้ว</>
                  : <><Save size={16} /> บันทึกคะแนน ปพ.5</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
