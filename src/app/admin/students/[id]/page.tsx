'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Student, StudentAssessment, CurriculumModule, Test, TestIndicator, TestScore, Indicator,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentRadar } from '@/components/student-radar'
import {
  buildStudentTagScores, buildBehaviorSubjectScores, buildFocusBreakdown, average, TagScore, FocusBreakdown,
} from '@/lib/analytics'
import { latestAssessmentPerPlan } from '@/lib/db'
import { Loader2, ArrowLeft, Share2, Star } from 'lucide-react'

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

  useEffect(() => {
    async function load() {
      const [
        { data: s }, { data: modules }, { data: assessments },
        { data: tests }, { data: testInds }, { data: testScores }, { data: inds },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('curriculum_modules').select('*'),
        supabase.from('student_assessments').select('*').eq('student_id', studentId),
        supabase.from('tests').select('*'),
        supabase.from('test_indicators').select('*'),
        supabase.from('test_scores').select('*').eq('student_id', studentId),
        supabase.from('indicators').select('id, code'),
      ])

      setStudent(s)
      const moduleMap = new Map<string, CurriculumModule>((modules ?? []).map(m => [m.id, m]))
      const list = latestAssessmentPerPlan((assessments ?? []) as StudentAssessment[])

      setTagScores(buildStudentTagScores(list, moduleMap))
      setBehaviorScores(buildBehaviorSubjectScores(list, moduleMap))

      // summative: % per indicator from real tests, scaled to the same 0-2 axis
      const testById = new Map(((tests ?? []) as Test[]).map(t => [t.id, t]))
      const codeById = new Map(((inds ?? []) as Pick<Indicator, 'id' | 'code'>[]).map(i => [i.id, i.code]))
      const indsByTest = new Map<string, string[]>()
      ;((testInds ?? []) as TestIndicator[]).forEach(ti => {
        if (!indsByTest.has(ti.test_id)) indsByTest.set(ti.test_id, [])
        const code = codeById.get(ti.indicator_id)
        if (code) indsByTest.get(ti.test_id)!.push(code)
      })
      const buckets = new Map<string, number[]>()
      ;((testScores ?? []) as TestScore[]).forEach(sc => {
        const t = testById.get(sc.test_id)
        if (!t || t.max_score <= 0) return
        const pct = Math.min(1, sc.score / t.max_score)
        ;(indsByTest.get(sc.test_id) ?? []).forEach(code => {
          if (!buckets.has(code)) buckets.set(code, [])
          buckets.get(code)!.push(pct)
        })
      })
      setTestTagScores(
        Array.from(buckets.entries()).map(([tag, pcts]) => ({
          tag,
          avgScore: +(pcts.reduce((a, b) => a + b, 0) / pcts.length * 2).toFixed(2),
          count: pcts.length,
        }))
      )
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
      <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
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

      {/* Personalized radar */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">
            จุดแข็ง–จุดอ่อนตามมาตรฐานการเรียนรู้
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
