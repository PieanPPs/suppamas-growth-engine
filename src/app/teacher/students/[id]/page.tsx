'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Student, StudentAssessment, CurriculumModule, Test, TestItem, TestScore, TestItemResponse, Indicator,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentRadar } from '@/components/student-radar'
import {
  buildStudentTagScores, buildBehaviorSubjectScores, buildFocusBreakdown, average,
  splitStrengthsWeaknesses, buildStudentIndicatorScores, buildMonthlyAcademicTrend,
  TagScore, FocusBreakdown, MonthlyTrendPoint,
} from '@/lib/analytics'
import { latestAssessmentPerPlan } from '@/lib/db'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, ArrowLeft, Share2, Star, TrendingUp, TrendingDown, LineChart as LineChartIcon } from 'lucide-react'

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
}

export default function StudentDetailPage() {
  const params = useParams()
  const studentId = params.id as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [tagScores, setTagScores] = useState<TagScore[]>([])
  const [testTagScores, setTestTagScores] = useState<TagScore[]>([])
  const [behaviorScores, setBehaviorScores] = useState<TagScore[]>([])
  const [focus, setFocus] = useState<FocusBreakdown>({ green: 0, yellow: 0, red: 0, total: 0 })
  const [avgAcademic, setAvgAcademic] = useState(0)
  const [avgSoft, setAvgSoft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [assessmentCount, setAssessmentCount] = useState(0)
  const [indicatorDesc, setIndicatorDesc] = useState<Map<string, string>>(new Map())
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendPoint[]>([])

  const { strengths, weaknesses } = useMemo(
    () => splitStrengthsWeaknesses(tagScores),
    [tagScores]
  )
  const { strengths: examStrengths, weaknesses: examWeaknesses } = useMemo(
    () => splitStrengthsWeaknesses(testTagScores),
    [testTagScores]
  )
  const describe = (t: TagScore) => indicatorDesc.get(`${t.subject}::${t.tag}`)

  useEffect(() => {
    async function load() {
      const [
        { data: s }, { data: modules }, { data: assessments },
        { data: tests }, { data: testItems }, { data: testScores }, { data: testItemResponses }, { data: inds },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('curriculum_modules').select('*'),
        supabase.from('student_assessments').select('*').eq('student_id', studentId),
        supabase.from('tests').select('*'),
        supabase.from('test_items').select('*'),
        supabase.from('test_scores').select('*').eq('student_id', studentId),
        supabase.from('test_item_responses').select('*').eq('student_id', studentId),
        supabase.from('indicators').select('id, subject, code, description'),
      ])

      setStudent(s)
      const moduleMap = new Map<string, CurriculumModule>((modules ?? []).map(m => [m.id, m]))
      const list = latestAssessmentPerPlan((assessments ?? []) as StudentAssessment[])

      setTagScores(buildStudentTagScores(list, moduleMap))
      setBehaviorScores(buildBehaviorSubjectScores(list, moduleMap))
      setAssessmentCount(list.length)
      setMonthlyTrend(buildMonthlyAcademicTrend(list))

      // Summative: exact per-item exam results (test_items.indicator_code + test_item_responses),
      // not just the whole test's aggregate score spread evenly across its indicators — a student
      // who nails half the indicators on a test and misses the rest should show that split, not
      // one blended percentage on every indicator the test happened to cover.
      setTestTagScores(buildStudentIndicatorScores(
        studentId,
        (tests ?? []) as Test[],
        (testItems ?? []) as TestItem[],
        (testScores ?? []) as TestScore[],
        (testItemResponses ?? []) as TestItemResponse[],
      ))
      setIndicatorDesc(new Map(
        ((inds ?? []) as Pick<Indicator, 'subject' | 'code' | 'description'>[]).map(i => [`${i.subject}::${i.code}`, i.description])
      ))
      setFocus(buildFocusBreakdown(list))
      setAvgAcademic(average(list.map(a => a.academic_score)))
      setAvgSoft(average(list.map(a => a.soft_skill_score)))
      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <Link href="/teacher/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> กลับ
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{student?.name ?? 'ไม่พบนักเรียน'}</h2>
          <p className="text-sm text-gray-500">{student?.class_name}</p>
        </div>
        <Link
          href={`/report/${studentId}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <Share2 size={14} /> รายงานผู้ปกครอง
        </Link>
      </div>

      {/* Score summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={16} className="fill-yellow-400 text-yellow-400" />
              <span className="text-2xl font-bold text-gray-900">{avgAcademic.toFixed(1)}</span>
              <span className="text-sm text-gray-400">/2</span>
            </div>
            <p className="text-xs text-gray-500">ผลการเรียนเฉลี่ย</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={16} className="fill-blue-400 text-blue-400" />
              <span className="text-2xl font-bold text-gray-900">{avgSoft.toFixed(1)}</span>
              <span className="text-sm text-gray-400">/2</span>
            </div>
            <p className="text-xs text-gray-500">ทักษะสังคมเฉลี่ย</p>
          </CardContent>
        </Card>
      </div>

      {/* Strengths / weaknesses — explicit sorted list, easier to read than the radar
          once many standards have accumulated over months of assessment */}
      {tagScores.length > 0 && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800">
              เก่งด้านไหน อ่อนด้านไหน
            </CardTitle>
            <p className="text-xs text-gray-400">จากการประเมิน {assessmentCount} ครั้งสะสม · เรียงตามคะแนนเฉลี่ยแต่ละมาตรฐาน</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-green-700 flex items-center gap-1"><TrendingUp size={13} /> จุดแข็ง</p>
              {strengths.length === 0 && <p className="text-xs text-gray-300">—</p>}
              {strengths.map(t => (
                <div key={`${t.subject}-${t.tag}`} className="bg-green-50 border border-green-100 rounded-xl px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-green-800 leading-snug">{t.tag}</p>
                  {describe(t) && <p className="text-[10px] text-green-500 leading-snug line-clamp-2">{describe(t)}</p>}
                  <p className="text-[10px] text-green-600">{t.avgScore.toFixed(1)}/2 · {t.count} ครั้ง</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-red-600 flex items-center gap-1"><TrendingDown size={13} /> ควรเสริม</p>
              {weaknesses.length === 0 && <p className="text-xs text-gray-300">—</p>}
              {weaknesses.map(t => (
                <div key={`${t.subject}-${t.tag}`} className="bg-red-50 border border-red-100 rounded-xl px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-red-800 leading-snug">{t.tag}</p>
                  {describe(t) && <p className="text-[10px] text-red-400 leading-snug line-clamp-2">{describe(t)}</p>}
                  <p className="text-[10px] text-red-500">{t.avgScore.toFixed(1)}/2 · {t.count} ครั้ง</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths / weaknesses from REAL exams — per-item results tied to indicator codes,
          distinct source from the daily exit-ticket tags above (teachers build tests from
          indicators and grade item-by-item, so this reflects actual test performance) */}
      {testTagScores.length > 0 && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800">
              เก่งด้านไหน อ่อนด้านไหน (จากผลสอบจริง)
            </CardTitle>
            <p className="text-xs text-gray-400">อ้างอิงตัวชี้วัดที่ผูกไว้กับข้อสอบแต่ละข้อ (ไม่ใช่คะแนนรายคาบ)</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-green-700 flex items-center gap-1"><TrendingUp size={13} /> จุดแข็ง</p>
              {examStrengths.length === 0 && <p className="text-xs text-gray-300">—</p>}
              {examStrengths.map(t => (
                <div key={`${t.subject}-${t.tag}`} className="bg-green-50 border border-green-100 rounded-xl px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-green-800 leading-snug">{t.tag}</p>
                  {describe(t) && <p className="text-[10px] text-green-500 leading-snug line-clamp-2">{describe(t)}</p>}
                  <p className="text-[10px] text-green-600">{t.avgScore.toFixed(1)}/2 · {t.count} ข้อ</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-red-600 flex items-center gap-1"><TrendingDown size={13} /> ควรเสริม</p>
              {examWeaknesses.length === 0 && <p className="text-xs text-gray-300">—</p>}
              {examWeaknesses.map(t => (
                <div key={`${t.subject}-${t.tag}`} className="bg-red-50 border border-red-100 rounded-xl px-2.5 py-1.5">
                  <p className="text-xs font-semibold text-red-800 leading-snug">{t.tag}</p>
                  {describe(t) && <p className="text-[10px] text-red-400 leading-snug line-clamp-2">{describe(t)}</p>}
                  <p className="text-[10px] text-red-500">{t.avgScore.toFixed(1)}/2 · {t.count} ข้อ</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* พัฒนาการข้ามเดือน — คะแนนเฉลี่ยเดียวไม่บอกว่าดีขึ้นหรือแย่ลง ต้องดูเป็นเส้นตามเวลา
          โดยเฉพาะเมื่อผ่านไปหลายเดือนแล้วอยากรู้ว่าต้องปรับแผนตรงไหน */}
      {monthlyTrend.length > 0 && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <LineChartIcon size={15} className="text-blue-500" /> พัฒนาการข้ามเดือน
            </CardTitle>
            <p className="text-xs text-gray-400">คะแนนรายคาบเฉลี่ยแต่ละเดือน (เต็ม 2)</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {monthlyTrend.length < 2 ? (
              <p className="text-xs text-gray-400 text-center py-6">ต้องมีข้อมูลอย่างน้อย 2 เดือนถึงจะดูแนวโน้มได้</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyTrend.map(t => ({ ...t, label: formatMonthLabel(t.month) }))} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis domain={[0, 2]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickCount={3} />
                  <Tooltip formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : '', 'คะแนนเฉลี่ย']} />
                  <Line type="monotone" dataKey="avgScore" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personalized radar */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">
            จุดแข็ง–จุดอ่อนตามมาตรฐานการเรียนรู้ (ภาพรวม)
            {testTagScores.length > 0 && <span className="text-xs font-normal text-gray-400"> · รายคาบ vs สอบจริง</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <StudentRadar data={tagScores} compare={testTagScores} />
        </CardContent>
      </Card>

      {/* Behavioral radar — focus consistency by subject */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">
            สมาธิรายวิชา (พฤติกรรม)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <StudentRadar data={behaviorScores} color="#a855f7" />
        </CardContent>
      </Card>

      {/* Focus breakdown */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">สมาธิในชั้นเรียน</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {focus.total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">ยังไม่มีข้อมูล</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-2">
                <div className="bg-green-500" style={{ width: `${(focus.green / focus.total) * 100}%` }} />
                <div className="bg-yellow-400" style={{ width: `${(focus.yellow / focus.total) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(focus.red / focus.total) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>🟢 โฟกัส {focus.green}</span>
                <span>🟡 วอกแวก {focus.yellow}</span>
                <span>🔴 ไม่ตั้งใจ {focus.red}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
