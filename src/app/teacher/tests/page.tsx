'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Student, Teacher, Course, Indicator, Test, TestType, TestScore, TestIndicator, TestItem, TestItemResponse,
} from '@/lib/types'
import { ScoreModeSwitch } from '@/components/score-mode-switch'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { fetchAllPaged } from '@/lib/db'
import { PromptKit } from '@/components/tests/prompt-kit'
import { ImportItems } from '@/components/tests/import-items'
import { ParsedExamItem } from '@/lib/exam-import'
import {
  Loader2, ChevronDown, UserCircle2, Plus, X, Check, ArrowLeft, Trash2,
  ClipboardPaste, Save, FileSpreadsheet, Target, CalendarDays, Info, Wand2, Printer, FileText,
  BarChart2,
} from 'lucide-react'

const TEACHER_KEY = 'sge_teacher_id'

const TEST_TYPES: Record<TestType, { label: string; cls: string }> = {
  quiz:    { label: 'สอบเก็บคะแนน', cls: 'bg-blue-100 text-blue-700' },
  midterm: { label: 'กลางภาค', cls: 'bg-purple-100 text-purple-700' },
  final:   { label: 'ปลายภาค', cls: 'bg-rose-100 text-rose-700' },
  mock_nt: { label: 'Pre-NT', cls: 'bg-emerald-100 text-emerald-700' },
}

/** normalize Thai student names for fuzzy matching (strip prefixes/spaces) */
function normName(s: string): string {
  return s.replace(/เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|น\.ส\./g, '').replace(/\s+/g, '')
}

interface PastedRow { ident: string; score: number; studentId: string | null; studentName: string | null }

export default function TestsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [isTeacherRole, setIsTeacherRole] = useState(false)
  const [boundRooms, setBoundRooms] = useState<string[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [testIndicators, setTestIndicators] = useState<TestIndicator[]>([])
  const [allScores, setAllScores] = useState<TestScore[]>([])
  const [testItems, setTestItems] = useState<TestItem[]>([])
  const [allResponses, setAllResponses] = useState<TestItemResponse[]>([])
  const [promptOpen, setPromptOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // create form
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ title: '', subject: '', type: 'quiz' as TestType, maxScore: '20', date: new Date().toISOString().slice(0, 10) })
  const [draftIndicators, setDraftIndicators] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // score entry
  const [activeTest, setActiveTest] = useState<Test | null>(null)
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({})
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  async function loadAll() {
    const [{ data: ts }, { data: crs }, { data: inds }, { data: stds }, { data: tst }, { data: ti }, sc, items, resp] = await Promise.all([
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('indicators').select('*').eq('school_id', schoolId).order('standard').order('sequence_order'),
      supabase.from('students').select('*').eq('school_id', schoolId).order('class_name').order('student_number'),
      supabase.from('tests').select('*').eq('school_id', schoolId).order('test_date', { ascending: false }),
      supabase.from('test_indicators').select('*'),
      fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
      fetchAllPaged<TestItem>(() => supabase.from('test_items').select('*').order('test_id').order('item_no')),
      fetchAllPaged<TestItemResponse>(() => supabase.from('test_item_responses').select('*').eq('school_id', schoolId).order('id')),
    ])
    setTeachers(ts ?? []); setCourses(crs ?? []); setIndicators(inds ?? [])
    setStudents(stds ?? []); setTests(tst ?? []); setTestIndicators(ti ?? []); setAllScores(sc)
    setTestItems(items); setAllResponses(resp)
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
  const allRooms = Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort()
  const roomOptions = boundRooms.length > 0 ? [...new Set(boundRooms)].sort() : allRooms
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  function selectRoom(room: string | null) {
    setSelectedRoom(room)
    storeRoom(room)
  }

  const boundStudents = boundRooms.length > 0 ? students.filter(s => boundRooms.includes(s.class_name)) : students
  const visibleStudents = selectedRoom ? boundStudents.filter(s => s.class_name === selectedRoom) : boundStudents
  const visibleTests = teacher && teacher.subjects?.length
    ? tests.filter(t => teacher.subjects.includes(t.subject))
    : tests
  const draftSubjectIndicators = indicators.filter(i => i.subject === draft.subject)

  // prefill score inputs from saved scores when opening a test
  useEffect(() => {
    if (!activeTest) return
    const existing = new Map(allScores.filter(s => s.test_id === activeTest.id).map(s => [s.student_id, s.score]))
    const init: Record<string, string> = {}
    visibleStudents.forEach(s => { init[s.id] = existing.has(s.id) ? String(existing.get(s.id)) : '' })
    setScoreInputs(init)
  }, [activeTest?.id, visibleStudents.map(s => s.id).join(',')])

  function selectTeacher(id: string) {
    setTeacherId(id)
    localStorage.setItem(TEACHER_KEY, id)
  }

  async function createTest() {
    if (!draft.title.trim() || !draft.subject || !Number(draft.maxScore)) return
    setSaving(true)
    const { data } = await supabase.from('tests').insert({
      school_id: schoolId,
      title: draft.title.trim(), subject: draft.subject, type: draft.type,
      max_score: Number(draft.maxScore), test_date: draft.date,
    }).select().single()
    if (data && draftIndicators.size > 0) {
      await supabase.from('test_indicators').insert(
        Array.from(draftIndicators).map(indicator_id => ({ test_id: data.id, indicator_id }))
      )
    }
    setSaving(false); setCreating(false)
    setDraft({ title: '', subject: draft.subject, type: 'quiz', maxScore: '20', date: new Date().toISOString().slice(0, 10) })
    setDraftIndicators(new Set())
    loadAll()
  }

  async function deleteTest(id: string) {
    if (!confirm('ลบแบบทดสอบนี้พร้อมคะแนนทั้งหมด?')) return
    await supabase.from('tests').delete().eq('id', id)
    loadAll()
  }

  async function saveScores() {
    if (!activeTest) return
    setSaving(true)
    const max = activeTest.max_score
    const rows = visibleStudents
      .map(s => ({ student_id: s.id, raw: scoreInputs[s.id] }))
      .filter(r => r.raw !== '' && r.raw != null && !isNaN(Number(r.raw)))
      .map(r => ({
        school_id: schoolId,
        test_id: activeTest.id,
        student_id: r.student_id,
        score: Math.min(max, Math.max(0, Number(r.raw))),
      }))
    if (rows.length > 0) {
      await supabase.from('test_scores').upsert(rows, { onConflict: 'test_id,student_id' })
    }
    const sc = await fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id'))
    setAllScores(sc)
    setSaving(false)
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000)
  }

  // ---- Excel paste: "เลขที่/ชื่อ <tab> คะแนน" ----
  const pastedRows: PastedRow[] = useMemo(() => {
    if (!pasteText.trim()) return []
    const rows: PastedRow[] = []
    for (const line of pasteText.split('\n')) {
      const tokens = line.split(/[\t,]+|\s{2,}/).map(t => t.trim()).filter(Boolean)
      if (tokens.length < 2) continue
      const score = parseFloat(tokens[tokens.length - 1])
      if (isNaN(score)) continue
      const ident = tokens.slice(0, -1).join(' ').trim()
      // match: student_number exact → name fuzzy
      let match = visibleStudents.find(s => s.student_number && s.student_number === ident)
      if (!match) {
        const target = normName(ident)
        if (target) match = visibleStudents.find(s => normName(s.name).includes(target) || target.includes(normName(s.name)))
      }
      rows.push({ ident, score, studentId: match?.id ?? null, studentName: match?.name ?? null })
    }
    return rows
  }, [pasteText, visibleStudents.map(s => s.id).join(',')])

  function applyPaste() {
    setScoreInputs(prev => {
      const next = { ...prev }
      pastedRows.forEach(r => { if (r.studentId) next[r.studentId] = String(r.score) })
      return next
    })
    setPasteOpen(false); setPasteText('')
  }

  async function toggleItemResponse(testId: string, itemId: string, studentId: string, nowCorrect: boolean) {
    await supabase.from('test_item_responses').upsert(
      { school_id: schoolId, test_id: testId, test_item_id: itemId, student_id: studentId, correct: nowCorrect },
      { onConflict: 'test_item_id,student_id' }
    )
    const updated = allResponses
      .filter(r => !(r.test_item_id === itemId && r.student_id === studentId))
      .concat({ id: '', test_id: testId, test_item_id: itemId, student_id: studentId, correct: nowCorrect })
    setAllResponses(updated)
    // an item with no response row yet defaults to correct (teacher only taps the wrong
    // ones), so the score is total items minus however many were explicitly marked wrong
    const totalItems = testItems.filter(i => i.test_id === testId).length
    const wrongCount = updated.filter(r => r.test_id === testId && r.student_id === studentId && !r.correct).length
    setScoreInputs(prev => ({ ...prev, [studentId]: String(totalItems - wrongCount) }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key
  const scoresOf = (testId: string) => allScores.filter(s => s.test_id === testId)
  const itemsOf = (testId: string) => testItems.filter(i => i.test_id === testId).sort((a, b) => a.item_no - b.item_no)
  const indicatorCodes = (testId: string) =>
    Array.from(new Set(
      testIndicators.filter(ti => ti.test_id === testId)
        .map(ti => indicators.find(i => i.id === ti.indicator_id)?.code)
        .filter(Boolean) as string[]
    ))

  // ตัวชี้วัดสำหรับ Prompt Kit: ใช้ที่ติ๊กไว้ ถ้าไม่ติ๊กเลยใช้ทั้งวิชา
  const promptIndicators = (testId: string, subject: string) => {
    const ticked = testIndicators.filter(ti => ti.test_id === testId)
      .map(ti => indicators.find(i => i.id === ti.indicator_id))
      .filter(Boolean) as Indicator[]
    return (ticked.length ? ticked : indicators.filter(i => i.subject === subject))
      .map(i => ({ code: i.code, description: i.description }))
  }

  async function importExamItems(parsed: ParsedExamItem[]) {
    if (!activeTest) return
    await supabase.from('test_items').delete().eq('test_id', activeTest.id)
    if (parsed.length) {
      await supabase.from('test_items').insert(parsed.map(p => ({ test_id: activeTest.id, ...p })))
      // sync ตัวชี้วัดของข้อสอบให้ตรงกับรหัสที่พบรายข้อ
      const codes = Array.from(new Set(parsed.map(p => p.indicator_code).filter(Boolean))) as string[]
      const matched = indicators.filter(i => i.subject === activeTest.subject && codes.includes(i.code))
      const existing = new Set(testIndicators.filter(ti => ti.test_id === activeTest.id).map(ti => ti.indicator_id))
      const missing = matched.filter(i => !existing.has(i.id))
      if (missing.length) {
        await supabase.from('test_indicators').insert(missing.map(i => ({ test_id: activeTest.id, indicator_id: i.id })))
      }
    }
    const [{ data: items }, { data: ti }] = await Promise.all([
      supabase.from('test_items').select('*').order('item_no'),
      supabase.from('test_indicators').select('*'),
    ])
    setTestItems(items ?? [])
    setTestIndicators(ti ?? [])
    setImportOpen(false)
  }

  // ============ SCORE ENTRY VIEW ============
  if (activeTest) {
    const activeItems = itemsOf(activeTest.id) // items sorted by item_no
    const hasItems = activeItems.length > 0
    const entered = visibleStudents.filter(s => scoreInputs[s.id] !== '' && scoreInputs[s.id] != null).length
    const valid = visibleStudents.map(s => scoreInputs[s.id]).filter(v => v !== '' && v != null && !isNaN(Number(v))).map(Number)
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null

    return (
      <div className="space-y-4 pb-28">
        <button onClick={() => setActiveTest(null)} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> รายการแบบทดสอบ
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TEST_TYPES[activeTest.type].cls}`}>
              {TEST_TYPES[activeTest.type].label}
            </span>
            <span className="text-xs text-gray-400">{courseName(activeTest.subject)} · เต็ม {activeTest.max_score}</span>
          </div>
          <h2 className="text-base font-bold text-gray-900 mt-1">{activeTest.title}</h2>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {indicatorCodes(activeTest.id).map(c => (
              <span key={c} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{c}</span>
            ))}
          </div>

          {/* Question bank actions */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button onClick={() => setPromptOpen(true)}
              className="flex items-center justify-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold py-2 rounded-xl hover:bg-violet-100">
              <Wand2 size={13} /> พรอมต์ AI
            </button>
            <button onClick={() => setImportOpen(true)}
              className="flex items-center justify-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold py-2 rounded-xl hover:bg-blue-100">
              <FileText size={13} /> ข้อสอบ ({itemsOf(activeTest.id).length})
            </button>
            {itemsOf(activeTest.id).length > 0 ? (
              <a href={`/teacher/tests/${activeTest.id}/print`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 bg-gray-900 text-white text-xs font-semibold py-2 rounded-xl hover:bg-black">
                <Printer size={13} /> พิมพ์ชุดสอบ
              </a>
            ) : (
              <span className="flex items-center justify-center gap-1 bg-gray-50 border border-gray-200 text-gray-300 text-xs font-semibold py-2 rounded-xl">
                <Printer size={13} /> พิมพ์ชุดสอบ
              </span>
            )}
          </div>
        </div>

        {/* เลือกห้อง */}
        <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{selectedRoom ?? 'ทุกห้อง'} · กรอกแล้ว {entered}/{visibleStudents.length} คน{avg != null && <> · เฉลี่ย {avg.toFixed(1)}/{activeTest.max_score}</>}</span>
          <button onClick={() => setPasteOpen(true)} className="text-indigo-600 font-semibold flex items-center gap-1">
            <ClipboardPaste size={13} /> วางจาก Excel
          </button>
        </div>

        {/* ── Item Analysis (only when test has items and someone has responses) ── */}
        {hasItems && allResponses.some(r => r.test_id === activeTest.id) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-gray-600 flex items-center gap-1 mb-2.5">
              <BarChart2 size={13} className="text-blue-500" /> วิเคราะห์รายข้อ (% ถูก)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeItems.map(item => {
                const rsp = allResponses.filter(r => r.test_item_id === item.id && visibleStudents.some(s => s.id === r.student_id))
                const correctCount = rsp.filter(r => r.correct).length
                const total = rsp.length
                const pct = total > 0 ? correctCount / total : null
                return (
                  <div key={item.id} className={`flex flex-col items-center rounded-xl px-2 py-1.5 min-w-[2.8rem] ${
                    pct === null ? 'bg-gray-50 border border-gray-100' :
                    pct >= 0.8 ? 'bg-green-100' :
                    pct >= 0.5 ? 'bg-yellow-100' :
                    'bg-red-100'
                  }`}>
                    <span className="text-xs font-bold text-gray-700">{item.item_no}</span>
                    {item.indicator_code && <span className="text-[9px] text-gray-500 leading-tight">{item.indicator_code}</span>}
                    {pct !== null && <span className={`text-[10px] font-semibold mt-0.5 ${pct >= 0.8 ? 'text-green-700' : pct >= 0.5 ? 'text-yellow-700' : 'text-red-600'}`}>{Math.round(pct * 100)}%</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {visibleStudents.map((s, i) => {
            const val = scoreInputs[s.id] ?? ''
            const score = val !== '' && !isNaN(Number(val)) ? Number(val) : null
            const pct = score != null ? score / activeTest.max_score : null
            const isExpanded = expandedStudent === s.id
            // per-item responses for this student
            const studentResponses = allResponses.filter(r => r.test_id === activeTest.id && r.student_id === s.id)
            const responseMap = new Map(studentResponses.map(r => [r.test_item_id, r.correct]))

            function pickScore(n: number) {
              setScoreInputs(prev => ({ ...prev, [s.id]: String(n) }))
              const nextStudent = visibleStudents[i + 1]
              setExpandedStudent(nextStudent ? nextStudent.id : null)
            }

            return (
              <div key={s.id} className={`bg-white border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                  onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                >
                  <span className="w-5 text-center text-xs text-gray-400 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.class_name}{s.student_number ? ` · เลขที่ ${s.student_number}` : ''}</p>
                  </div>
                  {hasItems && studentResponses.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-end max-w-[120px]">
                      {activeItems.map(item => {
                        // no row yet defaults to correct (teacher only taps the wrong ones)
                        const c = responseMap.get(item.id)
                        return <span key={item.id} className={`w-3 h-3 rounded-sm ${c === false ? 'bg-red-300' : 'bg-green-400'}`} />
                      })}
                    </div>
                  )}
                  {score != null ? (
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${pct! >= 0.5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {score}<span className="text-[10px] font-normal text-gray-400 ml-0.5">/{activeTest.max_score}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300 font-medium px-2.5 py-1 border border-dashed border-gray-200 rounded-lg flex-shrink-0">—</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-blue-100">
                    {hasItems ? (
                      /* Per-item toggle mode */
                      <div className="mt-2.5 space-y-2">
                        <p className="text-[10px] text-gray-400">แตะข้อที่ <span className="text-red-600 font-semibold">ผิด</span> — ข้อที่ไม่แตะ = ถูก</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {activeItems.map(item => {
                            const stored = responseMap.get(item.id)
                            const isCorrect = stored === undefined ? true : stored
                            return (
                              <button
                                key={item.id}
                                onClick={() => toggleItemResponse(activeTest.id, item.id, s.id, !isCorrect)}
                                className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                                  isCorrect ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-red-500 text-white shadow-sm'
                                }`}
                              >
                                <span className="text-sm">{item.item_no}</span>
                                {item.indicator_code && <span className="text-[8px] opacity-70 leading-none">{item.indicator_code}</span>}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-blue-600 font-semibold">คะแนนรวม: {score ?? 0}/{activeTest.max_score} · อัปเดตอัตโนมัติ</p>
                      </div>
                    ) : (
                      /* Total-score button mode (no items) */
                      <div>
                        <div className="grid grid-cols-6 gap-1.5 mt-2.5">
                          {Array.from({ length: activeTest.max_score + 1 }, (_, n) => n).map(n => (
                            <button
                              key={n}
                              onClick={() => pickScore(n)}
                              className={`py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                                score === n ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="text-xs text-gray-400">หรือพิมพ์:</span>
                          <input
                            type="number" inputMode="decimal" min={0} max={activeTest.max_score} value={val}
                            onChange={e => setScoreInputs(prev => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="—"
                            className="w-20 text-center text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* sticky save */}
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={saveScores}
              disabled={saving}
              className={`w-full text-white font-bold py-4 rounded-2xl shadow-lg text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${savedFlash ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {saving ? <><Loader2 size={18} className="animate-spin" /> กำลังบันทึก...</>
                : savedFlash ? <><Check size={18} /> บันทึกแล้ว</>
                : <><Save size={16} /> บันทึกคะแนน ({entered} คน)</>}
            </button>
          </div>
        </div>

        {/* prompt kit + item import modals */}
        <AnimatePresence>
          {promptOpen && (
            <PromptKit
              subjectName={courseName(activeTest.subject)}
              grade={courses.find(c => c.subject_key === activeTest.subject)?.grade}
              indicators={promptIndicators(activeTest.id, activeTest.subject)}
              onClose={() => setPromptOpen(false)}
            />
          )}
          {importOpen && (
            <ImportItems
              existingCount={itemsOf(activeTest.id).length}
              onImport={importExamItems}
              onClose={() => setImportOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* paste modal */}
        <AnimatePresence>
          {pasteOpen && (
            <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <ClipboardPaste size={16} className="text-indigo-600" /> วางคะแนนจาก Excel
                  </p>
                  <button onClick={() => setPasteOpen(false)} className="text-gray-400"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                  <p className="text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                    คัดลอก 2 คอลัมน์จาก Excel: <strong>เลขที่ (หรือชื่อ) · คะแนน</strong> — ระบบจับคู่นักเรียนให้อัตโนมัติ
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    rows={7}
                    placeholder={'5894\t18\n5908\t12\nหรือ\nณัฐกมล\t18'}
                    className="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  {pastedRows.length > 0 && (
                    <div className="space-y-1 max-h-44 overflow-y-auto">
                      {pastedRows.map((r, i) => (
                        <div key={i} className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${r.studentId ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-600'}`}>
                          <span className="truncate">{r.studentId ? r.studentName : `ไม่พบ: ${r.ident}`}</span>
                          <span className="font-bold">{r.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button
                    onClick={applyPaste}
                    disabled={pastedRows.filter(r => r.studentId).length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50"
                  >
                    เติมคะแนน {pastedRows.filter(r => r.studentId).length} คน (ตรวจก่อนกดบันทึกอีกครั้ง)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ============ LIST VIEW ============
  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">บันทึกคะแนน</h2>
        <p className="text-sm text-gray-500 mt-1">แบบทดสอบ — สอบเก็บคะแนน กลางภาค ปลายภาค Pre-NT</p>
      </div>

      <ScoreModeSwitch />

      {/* Teacher picker — hidden for teacher role */}
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

      {teacherId && boundRooms.length === 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <p>ครูยังไม่ถูกผูกห้อง — จะแสดงนักเรียนทุกห้องตอนกรอกคะแนน</p>
        </div>
      )}

      {!creating ? (
        <button onClick={() => {
          setCreating(true)
          setDraft(d => ({ ...d, subject: d.subject || teacher?.subjects?.[0] || courses[0]?.subject_key || '' }))
        }}
          className="w-full border border-dashed border-blue-300 text-blue-600 rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-50">
          <Plus size={16} /> สร้างแบบทดสอบ
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-2.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">สร้างแบบทดสอบใหม่</p>
            <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="ชื่อแบบทดสอบ เช่น สอบเก็บคะแนน เศษส่วน ครั้งที่ 1"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <div className="grid grid-cols-2 gap-2">
            <select value={draft.subject} onChange={e => { setDraft(d => ({ ...d, subject: e.target.value })); setDraftIndicators(new Set()) }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {courses.map(c => <option key={c.id} value={c.subject_key}>{c.name}</option>)}
            </select>
            <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as TestType }))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {(Object.entries(TEST_TYPES) as [TestType, typeof TEST_TYPES[TestType]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">คะแนนเต็ม
              <input type="number" min={1} value={draft.maxScore} onChange={e => setDraft(d => ({ ...d, maxScore: e.target.value }))}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </label>
            <label className="text-xs text-gray-500">วันสอบ
              <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
              <Target size={13} /> ตัวชี้วัดที่ข้อสอบครอบคลุม ({draftIndicators.size})
            </p>
            {draftSubjectIndicators.length === 0 ? (
              <p className="text-xs text-gray-400">วิชานี้ยังไม่มีตัวชี้วัด — เพิ่มได้ที่ โครงสร้างรายวิชา</p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {draftSubjectIndicators.map(ind => {
                  const on = draftIndicators.has(ind.id)
                  return (
                    <button key={ind.id} onClick={() => setDraftIndicators(prev => {
                      const next = new Set(prev); if (next.has(ind.id)) next.delete(ind.id); else next.add(ind.id); return next
                    })}
                      className={`w-full text-left flex items-start gap-2 rounded-lg px-2.5 py-1.5 border text-xs transition-colors ${on ? 'border-blue-300 bg-blue-100/60' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center text-[9px] ${on ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>{on ? '✓' : ''}</span>
                      <span><span className="font-mono text-gray-500">{ind.code}</span> <span className="text-gray-700">{ind.description}</span></span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={createTest} disabled={saving || !draft.title.trim() || !draft.subject}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} สร้างแบบทดสอบ
          </button>
        </motion.div>
      )}

      {/* Test list */}
      <div className="space-y-2">
        {visibleTests.map(t => {
          const sc = scoresOf(t.id)
          const avg = sc.length ? sc.reduce((a, b) => a + b.score, 0) / sc.length : null
          const avgPct = avg != null ? avg / t.max_score : null
          return (
            <button key={t.id} onClick={() => setActiveTest(t)}
              className="w-full text-left bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TEST_TYPES[t.type].cls}`}>{TEST_TYPES[t.type].label}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><CalendarDays size={10} /> {t.test_date}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {courseName(t.subject)} · เต็ม {t.max_score}
                    {itemsOf(t.id).length > 0 && <> · {itemsOf(t.id).length} ข้อ</>} · กรอกแล้ว {sc.length} คน
                    {avgPct != null && (
                      <span className={`font-semibold ${avgPct >= 0.5 ? 'text-green-600' : 'text-red-500'}`}> · เฉลี่ย {Math.round(avgPct * 100)}%</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {indicatorCodes(t.id).map(c => (
                      <span key={c} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{c}</span>
                    ))}
                  </div>
                </div>
                <span onClick={e => { e.stopPropagation(); deleteTest(t.id) }}
                  className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0"><Trash2 size={14} /></span>
              </div>
            </button>
          )
        })}
        {visibleTests.length === 0 && !creating && (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
            <FileSpreadsheet size={26} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">ยังไม่มีแบบทดสอบ — สร้างชุดแรกได้เลย</p>
          </div>
        )}
      </div>
    </div>
  )
}
