'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CurriculumModule, PacingLog, StudentAssessment, Student } from '@/lib/types'
import { computeAtRiskStudents, RiskWarning } from '@/lib/predictive'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { AlertTriangle, BookOpen, Users, TrendingUp, Loader2, TrendingDown } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'

/** Extract grade prefixes, e.g. "ภาษาไทย ป.3" → "ป.3" */
function extractGrades(subjects: string[]): string[] {
  const grades = subjects.map(s => {
    const m = s.match(/((?:ป|ม)\.\d+)/)
    return m?.[1] ?? null
  }).filter(Boolean) as string[]
  return [...new Set(grades)]
}

type ModuleSummary = {
  module: CurriculumModule
  pacing?: PacingLog
  avgScore: number
  studentCount: number
  isHazard: boolean
}

type TagSummary = { tag: string; avgScore: number; count: number }

export default function TeacherOverviewPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [summaries, setSummaries] = useState<ModuleSummary[]>([])
  const [tagData, setTagData] = useState<TagSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [totalStudents, setTotalStudents] = useState(0)
  const [grades, setGrades] = useState<string[]>([])
  const [warnings, setWarnings] = useState<RiskWarning[]>([])

  useEffect(() => {
    async function load() {
      const session = getSession()
      if (!session?.userId) { setLoading(false); return }

      // Fetch teacher's subjects to derive grade levels
      const { data: teacher } = await supabase
        .from('teachers').select('subjects').eq('id', session.userId).maybeSingle()

      const subjects: string[] = teacher?.subjects ?? []
      const subjectSet = subjects.length ? new Set(subjects) : null
      const gradeList = extractGrades(subjects)
      setGrades(gradeList)

      const [{ data: modules }, { data: pacings }, { data: assessments }, { data: students }] =
        await Promise.all([
          supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
          supabase.from('pacing_logs').select('*').eq('school_id', schoolId),
          supabase.from('student_assessments').select('*').eq('school_id', schoolId),
          supabase.from('students').select('*').eq('school_id', schoolId),
        ])

      if (!modules) { setLoading(false); return }

      // Filter by teacher's subjects and grade levels
      const visibleModules = subjectSet
        ? modules.filter(m => subjectSet.has(m.subject))
        : modules
      const visibleStudents = gradeList.length
        ? (students ?? []).filter(s => gradeList.some(g => (s.class_name ?? '').startsWith(g)))
        : (students ?? [])

      setTotalStudents(visibleStudents.length)
      setWarnings(computeAtRiskStudents(
        visibleStudents as Student[],
        (assessments ?? []) as StudentAssessment[],
        visibleModules as CurriculumModule[],
      ))

      const pacingMap = new Map<string, PacingLog>()
      pacings?.forEach(p => {
        const ex = pacingMap.get(p.module_id)
        if (!ex || p.created_at > ex.created_at) pacingMap.set(p.module_id, p)
      })

      const assessmentsByModule = new Map<string, StudentAssessment[]>()
      assessments?.forEach(a => {
        if (!assessmentsByModule.has(a.module_id)) assessmentsByModule.set(a.module_id, [])
        assessmentsByModule.get(a.module_id)!.push(a)
      })

      const built: ModuleSummary[] = visibleModules.map(module => {
        const pacing = pacingMap.get(module.id)
        const modA = assessmentsByModule.get(module.id) ?? []
        const avgScore = modA.length ? modA.reduce((s, a) => s + a.academic_score, 0) / modA.length : 0
        const isHazard = pacing?.status === 'Completed' && modA.length > 0 && avgScore < 1.0
        return { module, pacing, avgScore, studentCount: modA.length, isHazard }
      })

      setSummaries(built)

      const tagMap = new Map<string, number[]>()
      built.forEach(s => {
        if (!s.studentCount) return
        s.module.academic_tags.forEach(tag => {
          if (!tagMap.has(tag)) tagMap.set(tag, [])
          tagMap.get(tag)!.push(s.avgScore)
        })
      })
      setTagData(Array.from(tagMap.entries())
        .map(([tag, scores]) => ({ tag, avgScore: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }))
        .sort((a, b) => a.tag.localeCompare(b.tag)))

      setLoading(false)
    }
    load()
  }, [])

  const barData = summaries.filter(s => s.studentCount > 0).map(s => ({
    name: s.module.module_code,
    score: parseFloat(s.avgScore.toFixed(2)),
    hazard: s.isHazard,
  }))
  const hazards = summaries.filter(s => s.isHazard)
  const completedModules = summaries.filter(s => s.pacing?.status === 'Completed').length

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Hero banner */}
      <motion.section
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-900 to-emerald-950 px-5 pt-6 pb-5 text-white shadow-xl"
      >
        <div className="absolute -left-12 -top-12 w-40 h-40 rounded-full bg-teal-400/15 blur-2xl" />
        <div className="absolute -right-10 -bottom-14 w-40 h-40 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-medium tracking-wide text-white/55">
            ผลสัมฤทธิ์นักเรียน{grades.length ? ` สายชั้น ${grades.join(', ')}` : ''} · โรงเรียนอนุสรณ์ศุภมาศ
          </p>
          <h2 className="text-2xl font-extrabold mt-1">ภาพรวมห้องเรียน</h2>
          <p className="text-xs text-white/50 mt-0.5">
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-3">
              <Users size={15} className="text-teal-300" />
              <p className="text-3xl font-extrabold mt-1 leading-none">{totalStudents}</p>
              <p className="text-[11px] text-white/55 mt-1">นักเรียน</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-3">
              <BookOpen size={15} className="text-emerald-300" />
              <p className="text-3xl font-extrabold mt-1 leading-none">{completedModules}</p>
              <p className="text-[11px] text-white/55 mt-1">บทเรียนสอนจบ</p>
            </div>
            <div className={`rounded-2xl px-3 py-3 border ${hazards.length > 0 ? 'bg-red-500/15 border-red-400/30' : 'bg-white/[0.07] border-white/10'}`}>
              <AlertTriangle size={15} className={hazards.length > 0 ? 'text-red-300' : 'text-white/40'} />
              <p className={`text-3xl font-extrabold mt-1 leading-none ${hazards.length > 0 ? 'text-red-300' : ''}`}>{hazards.length}</p>
              <p className="text-[11px] text-white/55 mt-1">{hazards.length > 0 ? 'คำเตือน' : 'ไม่มีคำเตือน'}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Hazard alerts */}
      {hazards.map(h => (
        <div key={h.module.id} className="border border-red-300 bg-red-50 rounded-2xl p-3">
          <p className="text-sm font-bold text-red-800 flex items-center gap-1.5">
            <AlertTriangle size={14} /> สอนเร็วเกินไป — {h.module.module_code}
          </p>
          <p className="text-xs text-red-700 mt-0.5">
            "{h.module.title}" สอนเสร็จแต่คะแนนเฉลี่ย <strong>{h.avgScore.toFixed(2)}/2.00</strong>
          </p>
        </div>
      ))}

      {/* AI early warning */}
      {warnings.length > 0 && (
        <Card className="border border-orange-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <TrendingDown size={16} className="text-orange-500" /> เตือนภัยล่วงหน้า — {warnings.length} คน
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {warnings.map(w => (
              <div key={w.student.id} className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{w.student.name}</p>
                  <p className="text-xs text-orange-600">
                    {w.trend === 'declining' ? 'คะแนนลดลงต่อเนื่อง' : 'คะแนนต่ำต่อเนื่อง'}
                    {w.weakTags.length > 0 && <> · จุดอ่อน: {w.weakTags.join(', ')}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {w.recentScores.map((s, i) => (
                    <span key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${s >= 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Radar chart */}
      {tagData.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" /> คะแนนเฉลี่ยตามมาตรฐานการเรียนรู้
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={tagData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Radar dataKey="avgScore" stroke="#0d9488" fill="#0d9488" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 text-center mt-1">คะแนนสูงสุด = 2.0</p>
          </CardContent>
        </Card>
      )}

      {/* Bar chart */}
      {barData.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800">คะแนนเฉลี่ยแต่ละบทเรียน</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 2]} tick={{ fontSize: 10 }} ticks={[0, 0.5, 1, 1.5, 2]} />
                <Tooltip formatter={(v) => v != null ? [`${Number(v).toFixed(2)} / 2.00`, 'คะแนนเฉลี่ย'] : ['-', '']} contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((e, i) => (
                    <Cell key={i} fill={e.hazard ? '#ef4444' : e.score >= 1.5 ? '#22c55e' : e.score >= 1.0 ? '#facc15' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Module list */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">รายละเอียดแต่ละบทเรียน</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {summaries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ยังไม่มีข้อมูลบทเรียน</p>
          ) : summaries.map(s => (
            <div key={s.module.id} className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${s.isHazard ? 'bg-red-50 -mx-4 px-4 rounded' : ''}`}>
              <div className="min-w-0">
                <p className="text-xs font-mono text-gray-400">{s.module.module_code}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{s.module.title}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {s.pacing && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.pacing.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    s.pacing.status === 'In_Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {s.pacing.status === 'Completed' ? 'เสร็จ' : s.pacing.status === 'In_Progress' ? 'กำลังสอน' : 'ล่าช้า'}
                  </span>
                )}
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.isHazard ? 'text-red-600' : 'text-gray-900'}`}>
                    {s.studentCount > 0 ? s.avgScore.toFixed(1) : '—'}
                  </p>
                  <p className="text-xs text-gray-400">{s.studentCount} คน</p>
                </div>
                {s.isHazard && <AlertTriangle size={14} className="text-red-500" />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
