'use client'

// วงจรติว NT/O-NET: Pre-NT → หาตัวชี้วัดอ่อน → ชุดฝึกเฉพาะจุด → สอบรอบใหม่ → กราฟพัฒนาการข้ามรอบ
// ใช้ข้อมูลที่มีอยู่แล้วทั้งหมด: ชุดสอบประเภท Pre-NT (mock_nt) + ผลตรวจรายข้อ (แตะ = ผิด)
// ชุดฝึกที่ AI สร้างใช้ฟอร์แมต ===ข้อสอบ=== เดิม จึงนำเข้าเป็นรอบสอบใหม่ได้ทันที — ครบวงจร

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Student, Course, Indicator, Test, TestScore, TestItem, TestItemResponse,
} from '@/lib/types'
import { buildExamPrompt } from '@/lib/exam-import'
import { fetchAllPaged } from '@/lib/db'
import { getSchoolId } from '@/lib/school'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  Loader2, Repeat2, Copy, Check, X, Target, TrendingUp, ArrowRight, Wand2,
} from 'lucide-react'

interface RoundStat {
  test: Test
  gradedCount: number
  avgPct: number | null                    // % เฉลี่ยทั้งห้อง 0-100
  indicatorPct: Map<string, number>        // code → % ถูก 0-100
  wrongByStudent: Map<string, number>      // student_id → จำนวนข้อผิด
  itemCount: number
}

const PASS_BAR = 50   // เกณฑ์ NT ขั้นต่ำที่ใช้เตือน (แดงต่ำกว่านี้)
const GOOD_BAR = 75   // เขียวตั้งแต่นี้ขึ้นไป

function pctColor(pct: number | null): string {
  if (pct == null) return 'bg-gray-50 text-gray-300'
  if (pct >= GOOD_BAR) return 'bg-green-100 text-green-700'
  if (pct >= PASS_BAR) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-600'
}

export default function NtCyclePage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [scores, setScores] = useState<TestScore[]>([])
  const [items, setItems] = useState<TestItem[]>([])
  const [responses, setResponses] = useState<TestItemResponse[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: stds }, { data: crs }, { data: inds }, { data: tst }, sc, its, resp] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
        supabase.from('courses').select('*').eq('school_id', schoolId),
        supabase.from('indicators').select('*'),
        supabase.from('tests').select('*').eq('school_id', schoolId).eq('type', 'mock_nt').order('test_date'),
        fetchAllPaged<TestScore>(() => supabase.from('test_scores').select('*').eq('school_id', schoolId).order('id')),
        fetchAllPaged<TestItem>(() => supabase.from('test_items').select('*').order('test_id').order('item_no')),
        fetchAllPaged<TestItemResponse>(() => supabase.from('test_item_responses').select('*').eq('school_id', schoolId).order('id')),
      ])
      setStudents((stds ?? []) as Student[])
      setCourses((crs ?? []) as Course[])
      setIndicators((inds ?? []) as Indicator[])
      setTests((tst ?? []) as Test[])
      setScores(sc)
      setItems(its)
      setResponses(resp)
      setLoading(false)
    }
    load()
  }, [])

  const subjects = useMemo(
    () => Array.from(new Set(tests.map(t => t.subject))),
    [tests]
  )
  useEffect(() => {
    if (subjects.length && !subjects.includes(selectedSubject)) setSelectedSubject(subjects[0])
  }, [subjects.join(',')])

  const roomOptions = useMemo(
    () => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort(),
    [students]
  )
  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  const visibleStudents = useMemo(
    () => selectedRoom ? students.filter(s => s.class_name === selectedRoom) : students,
    [students, selectedRoom]
  )

  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key.replace('_', ' ')

  // ---- สถิติรายรอบ (convention เดียวกับหน้า tests: ไม่มีแถว response = ตอบถูก,
  // นักเรียนที่ "ตรวจแล้ว" = มีคะแนนรวมหรือมีแถว response อย่างน้อย 1 ข้อ) ----
  const rounds: RoundStat[] = useMemo(() => {
    const visIds = new Set(visibleStudents.map(s => s.id))
    return tests
      .filter(t => t.subject === selectedSubject)
      .sort((a, b) => (a.test_date ?? a.created_at).localeCompare(b.test_date ?? b.created_at))
      .map(test => {
        const testItemsList = items.filter(i => i.test_id === test.id)
        const testResponses = responses.filter(r => r.test_id === test.id && visIds.has(r.student_id))
        const testScores = scores.filter(sc => sc.test_id === test.id && visIds.has(sc.student_id))
        const graded = new Set<string>([
          ...testScores.map(sc => sc.student_id),
          ...testResponses.map(r => r.student_id),
        ])
        const gradedCount = graded.size

        const wrongByStudent = new Map<string, number>()
        testResponses.filter(r => !r.correct).forEach(r => {
          wrongByStudent.set(r.student_id, (wrongByStudent.get(r.student_id) ?? 0) + 1)
        })

        let avgPct: number | null = null
        if (testItemsList.length > 0 && gradedCount > 0) {
          let sum = 0
          graded.forEach(sid => {
            sum += ((testItemsList.length - (wrongByStudent.get(sid) ?? 0)) / testItemsList.length) * 100
          })
          avgPct = sum / gradedCount
        } else if (testScores.length > 0 && test.max_score > 0) {
          avgPct = (testScores.reduce((s, v) => s + v.score, 0) / testScores.length / test.max_score) * 100
        }

        const indicatorPct = new Map<string, number>()
        if (gradedCount > 0) {
          const byCode = new Map<string, TestItem[]>()
          testItemsList.forEach(it => {
            if (!it.indicator_code) return
            if (!byCode.has(it.indicator_code)) byCode.set(it.indicator_code, [])
            byCode.get(it.indicator_code)!.push(it)
          })
          byCode.forEach((list, code) => {
            let sum = 0
            list.forEach(it => {
              const wrong = new Set(
                testResponses.filter(r => r.test_item_id === it.id && !r.correct).map(r => r.student_id)
              ).size
              sum += ((gradedCount - wrong) / gradedCount) * 100
            })
            indicatorPct.set(code, sum / list.length)
          })
        }

        return { test, gradedCount, avgPct, indicatorPct, wrongByStudent, itemCount: testItemsList.length }
      })
  }, [tests, items, responses, scores, selectedSubject, visibleStudents])

  const gradedRounds = rounds.filter(r => r.gradedCount > 0)
  const latest = gradedRounds[gradedRounds.length - 1] ?? null

  // ตัวชี้วัดทั้งหมดที่เคยออกสอบ (สำหรับตาราง matrix ข้ามรอบ)
  const allCodes = useMemo(() => {
    const set = new Set<string>()
    rounds.forEach(r => r.indicatorPct.forEach((_, code) => set.add(code)))
    return Array.from(set).sort()
  }, [rounds])

  const indicatorDesc = (code: string) =>
    indicators.find(i => i.subject === selectedSubject && i.code === code)?.description
    ?? indicators.find(i => i.code === code)?.description ?? ''

  // จุดอ่อนรอบล่าสุด — ต่ำกว่าเกณฑ์เขียว เรียงจากอ่อนสุด
  const weakest = useMemo(() => {
    if (!latest) return []
    return Array.from(latest.indicatorPct.entries())
      .filter(([, pct]) => pct < GOOD_BAR)
      .sort((a, b) => a[1] - b[1])
      .map(([code, pct]) => ({ code, pct, description: indicatorDesc(code) }))
  }, [latest, indicators])

  // เด็กที่พลาดเยอะสุดในรอบล่าสุด
  const focusStudents = useMemo(() => {
    if (!latest || latest.itemCount === 0) return []
    return Array.from(latest.wrongByStudent.entries())
      .map(([sid, wrong]) => ({ student: students.find(s => s.id === sid), wrong }))
      .filter(x => x.student && x.wrong / latest.itemCount > 0.5)
      .sort((a, b) => b.wrong - a.wrong)
      .slice(0, 8)
  }, [latest, students])

  const chartData = gradedRounds.map((r, i) => ({
    name: `รอบ ${i + 1}`,
    title: r.test.title,
    pct: r.avgPct != null ? Math.round(r.avgPct) : null,
  }))

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Repeat2 size={20} className="text-emerald-600" /> วงจรติว NT / O-NET
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          สอบ Pre-NT → ระบบชี้ตัวชี้วัดที่อ่อน → สร้างชุดฝึกเฉพาะจุด → สอบรอบใหม่ → ดูพัฒนาการข้ามรอบ
        </p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 space-y-2">
          <p>ยังไม่มีชุดสอบประเภท Pre-NT ในระบบ</p>
          <Link href="/teacher/tests" className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
            ไปสร้างแบบทดสอบ (เลือกประเภท Pre-NT) <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {/* subject tabs */}
          {subjects.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {subjects.map(s => (
                <button key={s} onClick={() => setSelectedSubject(s)}
                  className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border ${
                    selectedSubject === s ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-500'
                  }`}>
                  {courseName(s)}
                </button>
              ))}
            </div>
          )}

          <RoomFilter rooms={roomOptions} value={selectedRoom}
            onChange={r => { setSelectedRoom(r); storeRoom(r) }} />

          {/* ---- กราฟพัฒนาการข้ามรอบ ---- */}
          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-1">
                <TrendingUp size={15} className="text-emerald-600" /> พัฒนาการข้ามรอบ — % ถูกเฉลี่ยของห้อง
              </p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip formatter={(v) => [`${v ?? ''}%`, '% ถูกเฉลี่ย']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.title ?? label} />
                  <ReferenceLine y={PASS_BAR} stroke="#f87171" strokeDasharray="4 4" />
                  <ReferenceLine y={GOOD_BAR} stroke="#4ade80" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="pct" stroke="#059669" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#059669' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-gray-400 text-center">เส้นประแดง = เกณฑ์ขั้นต่ำ {PASS_BAR}% · เส้นประเขียว = เป้าหมาย {GOOD_BAR}%</p>
            </div>
          )}

          {/* ---- matrix ตัวชี้วัด × รอบ ---- */}
          {allCodes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-x-auto">
              <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-2">
                <Target size={15} className="text-emerald-600" /> % ถูกรายตัวชี้วัด แยกตามรอบสอบ
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-gray-500 font-semibold pb-1.5 pr-2">ตัวชี้วัด</th>
                    {gradedRounds.map((r, i) => (
                      <th key={r.test.id} className="text-center text-gray-500 font-semibold pb-1.5 px-1 whitespace-nowrap" title={r.test.title}>
                        รอบ {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allCodes.map(code => (
                    <tr key={code} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2">
                        <span className="font-semibold text-gray-700">{code}</span>
                        {indicatorDesc(code) && (
                          <span className="block text-[10px] text-gray-400 leading-tight max-w-[180px] truncate" title={indicatorDesc(code)}>
                            {indicatorDesc(code)}
                          </span>
                        )}
                      </td>
                      {gradedRounds.map(r => {
                        const pct = r.indicatorPct.get(code) ?? null
                        return (
                          <td key={r.test.id} className="text-center px-1 py-1.5">
                            <span className={`inline-block min-w-[2.6rem] rounded-lg px-1.5 py-1 font-bold ${pctColor(pct)}`}>
                              {pct != null ? `${Math.round(pct)}%` : '—'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- จุดอ่อนรอบล่าสุด + สร้างชุดฝึก ---- */}
          {latest && weakest.length > 0 && (
            <div className="bg-white border border-red-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-bold text-red-700">
                จุดอ่อนจากรอบล่าสุด ({latest.test.title}) — {weakest.length} ตัวชี้วัด
              </p>
              {weakest.map(w => (
                <div key={w.code} className="flex items-center gap-2 text-xs bg-red-50/60 rounded-xl px-3 py-2">
                  <span className={`font-bold rounded-lg px-2 py-1 flex-shrink-0 ${pctColor(w.pct)}`}>{Math.round(w.pct)}%</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{w.code}</p>
                    {w.description && <p className="text-gray-500 leading-snug">{w.description}</p>}
                  </div>
                </div>
              ))}
              <button onClick={() => setPromptOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5">
                <Wand2 size={15} /> สร้างชุดฝึกเฉพาะจุดอ่อน ({weakest.length} ตัวชี้วัด)
              </button>
            </div>
          )}
          {latest && weakest.length === 0 && (
            <p className="text-center text-sm text-green-600 bg-green-50 border border-green-200 rounded-2xl py-4">
              🎉 รอบล่าสุดทุกตัวชี้วัดถึงเป้าหมาย {GOOD_BAR}% แล้ว
            </p>
          )}

          {/* ---- เด็กที่ควรดูแลเป็นพิเศษ ---- */}
          {focusStudents.length > 0 && latest && (
            <div className="bg-white border border-orange-200 rounded-2xl p-4 space-y-1.5">
              <p className="text-sm font-bold text-orange-700">เด็กที่พลาดเกินครึ่งในรอบล่าสุด ({focusStudents.length} คน)</p>
              {focusStudents.map(({ student, wrong }) => (
                <div key={student!.id} className="flex items-center justify-between text-xs bg-orange-50/60 rounded-xl px-3 py-2">
                  <span className="font-semibold text-gray-800">{student!.name}</span>
                  <span className="text-orange-600">ผิด {wrong}/{latest.itemCount} ข้อ</span>
                </div>
              ))}
              <Link href="/teacher/remediation"
                className="block text-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl py-2.5 hover:bg-rose-100">
                💗 สร้างแผนซ่อมเสริมรายคน →
              </Link>
            </div>
          )}
        </>
      )}

      {promptOpen && latest && (
        <PracticePromptModal
          subjectName={courseName(selectedSubject)}
          grade={courses.find(c => c.subject_key === selectedSubject)?.grade ?? null}
          weakest={weakest}
          onClose={() => setPromptOpen(false)}
        />
      )}
    </div>
  )
}

// ================= modal ชุดฝึกเฉพาะจุด =================

function PracticePromptModal({ subjectName, grade, weakest, onClose }: {
  subjectName: string
  grade: string | null
  weakest: { code: string; pct: number; description: string }[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(weakest.map(w => w.code)))
  const [count, setCount] = useState(15)
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(() => {
    const chosen = weakest.filter(w => selected.has(w.code))
    return buildExamPrompt({
      subjectName,
      grade,
      count,
      indicators: chosen.map(w => ({ code: w.code, description: w.description || w.code })),
      qtype: 'mc4',
      styles: [
        'นี่คือชุดฝึกซ่อมจุดอ่อนหลังสอบ Pre-NT: ออกข้อสอบเฉพาะตัวชี้วัดที่ให้มาเท่านั้น กระจายจำนวนข้อให้ตัวชี้วัดที่อ่อนที่สุด (ลำดับแรก ๆ) ได้ข้อมากกว่า',
        'คละระดับความยาก: ง่าย 40% ปานกลาง 40% ยาก 20% เรียงจากง่ายไปยาก เพื่อให้เด็กที่กำลังซ่อมพื้นฐานทำข้อแรก ๆ ได้และมีกำลังใจ',
      ],
    })
  }, [subjectName, grade, count, selected, weakest])

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Wand2 size={16} className="text-emerald-600" /> ชุดฝึกเฉพาะจุดอ่อน — {subjectName}
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs text-emerald-700 leading-relaxed">
            <strong>ครบวงจรใน 3 ขั้น:</strong> ① คัดลอกพรอมต์ → วางในเว็บ AI ฟรี
            ② ไปหน้า <Link href="/teacher/tests" className="underline font-semibold">แบบทดสอบ</Link> สร้างชุดสอบใหม่
            (ประเภท <strong>Pre-NT</strong>) แล้วใช้ &quot;นำเข้าข้อสอบ&quot; วางผลลัพธ์
            ③ สอบ+ตรวจตามปกติ — กราฟพัฒนาการจะเพิ่มรอบใหม่ให้อัตโนมัติ
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">ตัวชี้วัดที่จะฝึก (แตะเพื่อเลือก/ไม่เลือก)</p>
            <div className="space-y-1">
              {weakest.map(w => {
                const on = selected.has(w.code)
                return (
                  <button key={w.code}
                    onClick={() => {
                      const next = new Set(selected)
                      if (next.has(w.code)) next.delete(w.code); else next.add(w.code)
                      setSelected(next)
                    }}
                    className={`w-full text-left rounded-xl border px-2.5 py-2 ${on ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                    <span className={`text-xs font-semibold ${on ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {w.code} · ถูกเพียง {Math.round(w.pct)}%
                    </span>
                    {w.description && <span className="block text-[10px] text-gray-400 leading-snug">{w.description}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500">
            จำนวนข้อ
            <input type="number" min={5} max={40} value={count}
              onChange={e => setCount(Math.max(5, Number(e.target.value) || 5))}
              className="w-20 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            ข้อ (ปรนัย 4 ตัวเลือก — ตรวจรายข้อในระบบได้)
          </label>

          <textarea readOnly value={prompt} rows={8}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700" />
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={copy} disabled={selected.size === 0}
            className={`w-full text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40 ${copied ? 'bg-green-500' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {copied ? <><Check size={15} /> คัดลอกแล้ว — ไปวางในเว็บ AI</> : <><Copy size={15} /> คัดลอกพรอมต์ชุดฝึก</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
