'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CurriculumModule, PacingLog, StudentAssessment, Student, Indicator, Course } from '@/lib/types'
import { computeAtRiskStudents } from '@/lib/predictive'
import { buildModuleTagSummary, TagScore } from '@/lib/analytics'
import { fetchAllPaged, getTermStartISO, latestAssessmentPerPlan } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import { AlertTriangle, BookOpen, Users, TrendingUp, Loader2, Gauge, TrendingDown, Trophy, Wrench, Flag } from 'lucide-react'
import { getSchoolId } from '@/lib/school'
import { RoomFilter } from '@/components/room-filter'

type ModuleSummary = {
  module: CurriculumModule
  pacing?: PacingLog
  avgScore: number
  studentCount: number
  greenCount: number
  yellowCount: number
  redCount: number
  isHazard: boolean
}

export default function DashboardPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  // raw data — everything below derives from these via useMemo, so the room/subject
  // filters recompute the whole page instantly without refetching
  const [rawModules, setRawModules] = useState<CurriculumModule[]>([])
  const [rawStudents, setRawStudents] = useState<Student[]>([])
  const [rawAssessments, setRawAssessments] = useState<StudentAssessment[]>([])
  const [pacingMap, setPacingMap] = useState<Map<string, PacingLog>>(new Map())
  const [courses, setCourses] = useState<Course[]>([])
  const [indicatorDesc, setIndicatorDesc] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  // มุมมองแยกชั้นเรียน/วิชา — ค่าเริ่มต้นเห็นทั้งโรงเรียนเหมือนเดิม
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // scope growth-table reads to the current term instead of the school's entire
      // all-time history, which only ever grows and slows this page down more each term
      const termStart = await getTermStartISO(supabase, schoolId)

      const [
        { data: modules },
        pacings,
        assessments,
        { data: students },
        { data: inds },
        { data: crs },
      ] = await Promise.all([
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).order('module_code'),
        // NOT term-scoped: pacing status is cumulative per module (latest-wins below), so a
        // module completed last term must still show as completed this term.
        fetchAllPaged<PacingLog>(() => supabase.from('pacing_logs').select('*').eq('school_id', schoolId).order('id')),
        // term-scoped: this feeds "at risk right now" -- diluting it with a year of history
        // would blunt the signal, and it's also this school's single biggest growth table.
        fetchAllPaged<StudentAssessment>(() => {
          let q = supabase.from('student_assessments').select('*').eq('school_id', schoolId)
          if (termStart) q = q.gte('created_at', termStart)
          return q.order('id')
        }),
        supabase.from('students').select('*').eq('school_id', schoolId),
        supabase.from('indicators').select('subject, code, description'),
        supabase.from('courses').select('*').eq('school_id', schoolId),
      ])

      if (!modules) { setLoading(false); return }
      setIndicatorDesc(new Map(
        ((inds ?? []) as Pick<Indicator, 'subject' | 'code' | 'description'>[]).map(i => [`${i.subject}::${i.code}`, i.description])
      ))
      setRawModules(modules as CurriculumModule[])
      setRawStudents((students ?? []) as Student[])
      setRawAssessments(latestAssessmentPerPlan((assessments ?? []) as StudentAssessment[]))
      setCourses((crs ?? []) as Course[])

      // Build pacing map (latest per module)
      const pm = new Map<string, PacingLog>()
      pacings?.forEach(p => {
        const existing = pm.get(p.module_id)
        if (!existing || p.created_at > existing.created_at) pm.set(p.module_id, p)
      })
      setPacingMap(pm)
      setLoading(false)
    }
    load()
  }, [])

  const subjects = useMemo(
    () => Array.from(new Set(rawModules.map(m => m.subject))).sort(),
    [rawModules]
  )
  const roomOptions = useMemo(
    () => Array.from(new Set(rawStudents.map(s => s.class_name).filter(Boolean))).sort(),
    [rawStudents]
  )
  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key.replace('_', ' ')

  const visibleModules = useMemo(
    () => selectedSubject === 'all' ? rawModules : rawModules.filter(m => m.subject === selectedSubject),
    [rawModules, selectedSubject]
  )
  const visibleStudents = useMemo(
    () => selectedRoom ? rawStudents.filter(s => s.class_name === selectedRoom) : rawStudents,
    [rawStudents, selectedRoom]
  )
  const visibleAssessments = useMemo(() => {
    const moduleIds = new Set(visibleModules.map(m => m.id))
    const studentIds = new Set(visibleStudents.map(s => s.id))
    return rawAssessments.filter(a => moduleIds.has(a.module_id) && studentIds.has(a.student_id))
  }, [rawAssessments, visibleModules, visibleStudents])

  const summaries = useMemo<ModuleSummary[]>(() => {
    const assessmentsByModule = new Map<string, StudentAssessment[]>()
    visibleAssessments.forEach(a => {
      if (!assessmentsByModule.has(a.module_id)) assessmentsByModule.set(a.module_id, [])
      assessmentsByModule.get(a.module_id)!.push(a)
    })
    return visibleModules.map(module => {
      const pacing = pacingMap.get(module.id)
      const modAssessments = assessmentsByModule.get(module.id) ?? []
      const avgScore = modAssessments.length
        ? modAssessments.reduce((sum, a) => sum + a.academic_score, 0) / modAssessments.length
        : 0
      return {
        module,
        pacing,
        avgScore,
        studentCount: modAssessments.length,
        greenCount: modAssessments.filter(a => a.focus_color === 'Green').length,
        yellowCount: modAssessments.filter(a => a.focus_color === 'Yellow').length,
        redCount: modAssessments.filter(a => a.focus_color === 'Red').length,
        isHazard: pacing?.status === 'Completed' && modAssessments.length > 0 && avgScore < 1.0,
      }
    })
  }, [visibleModules, visibleAssessments, pacingMap])

  const tagData = useMemo(() => buildModuleTagSummary(summaries), [summaries])
  const warnings = useMemo(
    () => computeAtRiskStudents(visibleStudents, visibleAssessments, visibleModules),
    [visibleStudents, visibleAssessments, visibleModules]
  )
  const totalStudents = visibleStudents.length
  const completedModules = summaries.filter(s => s.pacing?.status === 'Completed').length
  const hazardCount = summaries.filter(s => s.isHazard).length

  const barData = summaries
    .filter(s => s.studentCount > 0)
    .map(s => ({
      name: s.module.module_code,
      score: parseFloat(s.avgScore.toFixed(2)),
      status: s.pacing?.status ?? 'ยังไม่ได้สอน',
      hazard: s.isHazard,
    }))

  const hazards = summaries.filter(s => s.isHazard)
  const describeTag = (t: TagScore) => indicatorDesc.get(`${t.subject}::${t.tag}`)
  const weakestTags = [...tagData].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3)
  // RiskWarning.weakTags has no subject context (see predictive.ts) — best-effort lookup by
  // code alone, ignoring subject, since a bare code is still more useful than none at all here.
  const describeByCode = (code: string) =>
    Array.from(indicatorDesc.entries()).find(([k]) => k.endsWith(`::${code}`))?.[1]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* ===== Hero: ห้องบัญชาการ (โทนเดียวกับหน้า Landing) ===== */}
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-5 pt-6 pb-5 text-white shadow-xl"
      >
        {/* แสงไฟจราจรจางๆ ตามแบรนด์ */}
        <div className="absolute -left-12 -top-12 w-40 h-40 rounded-full bg-green-500/15 blur-2xl" />
        <div className="absolute right-16 -top-10 w-32 h-32 rounded-full bg-yellow-400/15 blur-2xl" />
        <div className="absolute -right-10 -bottom-14 w-40 h-40 rounded-full bg-red-500/15 blur-2xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium tracking-wide text-white/55">
              ศูนย์บัญชาการผู้บริหาร · โรงเรียนอนุสรณ์ศุภมาศ
            </p>
            <div className="flex items-center gap-1.5">
              {['bg-red-500', 'bg-yellow-400', 'bg-green-500'].map((c, i) => (
                <motion.span key={c}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 300 }}
                  className={`w-2.5 h-2.5 rounded-full ${c}`} />
              ))}
            </div>
          </div>
          <h2 className="text-2xl font-extrabold mt-1">ภาพรวมการเรียนการสอน</h2>
          <p className="text-xs text-white/50 mt-0.5">
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {/* สถิติหลัก — กระจกบนพื้นมืด */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-3">
              <Users size={15} className="text-sky-300" />
              <p className="text-3xl font-extrabold mt-1 leading-none">{totalStudents}</p>
              <p className="text-[11px] text-white/55 mt-1">นักเรียน</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
              className="rounded-2xl bg-white/[0.07] border border-white/10 px-3 py-3">
              <BookOpen size={15} className="text-emerald-300" />
              <p className="text-3xl font-extrabold mt-1 leading-none">{completedModules}</p>
              <p className="text-[11px] text-white/55 mt-1">บทเรียนสอนจบ</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.29 }}
              className={`rounded-2xl px-3 py-3 border ${
                hazardCount > 0
                  ? 'bg-red-500/15 border-red-400/30'
                  : 'bg-white/[0.07] border-white/10'
              }`}>
              <span className="relative inline-flex">
                {hazardCount > 0 && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60 animate-ping" />
                )}
                <AlertTriangle size={15} className={`relative ${hazardCount > 0 ? 'text-red-300' : 'text-white/40'}`} />
              </span>
              <p className={`text-3xl font-extrabold mt-1 leading-none ${hazardCount > 0 ? 'text-red-300' : ''}`}>{hazardCount}</p>
              <p className="text-[11px] text-white/55 mt-1">{hazardCount > 0 ? 'คำเตือนเร่งสอน' : 'ไม่มีคำเตือน'}</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ===== มุมมองแยกชั้นเรียน / วิชา — ทุกการ์ดในหน้านี้คำนวณใหม่ตามที่เลือก ===== */}
      <div className="space-y-2">
        <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={setSelectedRoom} />
        {subjects.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button onClick={() => setSelectedSubject('all')}
              className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border ${
                selectedSubject === 'all' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-500'
              }`}>
              ทุกวิชา
            </button>
            {subjects.map(s => (
              <button key={s} onClick={() => setSelectedSubject(s)}
                className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl border ${
                  selectedSubject === s ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-gray-200 text-gray-500'
                }`}>
                {courseName(s)}
              </button>
            ))}
          </div>
        )}
        {(selectedRoom || selectedSubject !== 'all') && (
          <p className="text-[11px] text-gray-400">
            กำลังดู: {selectedRoom ?? 'ทุกห้อง'} · {selectedSubject === 'all' ? 'ทุกวิชา' : courseName(selectedSubject)}
            <button onClick={() => { setSelectedRoom(null); setSelectedSubject('all') }}
              className="ml-2 text-blue-500 font-semibold hover:underline">ล้างตัวกรอง</button>
          </p>
        )}
      </div>

      {/* ===== ทางลัด — ระบบเดียวกันทุกปุ่ม สีอยู่ที่ไอคอนเท่านั้น ===== */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { href: '/admin/pacing', icon: Gauge, label: 'วิเคราะห์ไขว้', tint: 'bg-indigo-50 text-indigo-600' },
          { href: '/teacher/students', icon: Users, label: 'รายบุคคล', tint: 'bg-sky-50 text-sky-600' },
          { href: '/heroes', icon: Trophy, label: 'ฮีโร่', tint: 'bg-amber-50 text-amber-600' },
          { href: '/admin/impact', icon: Flag, label: 'Impact', tint: 'bg-rose-50 text-rose-600' },
          { href: '/admin/manage', icon: Wrench, label: 'หลังบ้าน', tint: 'bg-slate-100 text-slate-600' },
        ].map((t, i) => (
          <motion.div key={t.href}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}>
            <Link href={t.href}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-200 rounded-2xl py-3 px-1 shadow-sm hover:border-gray-300 hover:-translate-y-0.5 transition-all">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.tint}`}>
                <t.icon size={17} />
              </span>
              <span className="text-[10.5px] font-semibold text-gray-600 leading-none">{t.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Speeding Hazard alerts */}
      {hazards.length > 0 && (
        <div className="space-y-2">
          {hazards.map(h => (
            <Alert key={h.module.id} className="border-red-300 bg-red-50">
              <AlertTriangle className="text-red-500" size={16} />
              <AlertTitle className="text-red-800 text-sm font-bold">
                ⚡ สอนเร็วเกินไป — {h.module.module_code}
              </AlertTitle>
              <AlertDescription className="text-red-700 text-xs mt-1">
                บทเรียน "{h.module.title}" ถูกทำเครื่องหมายว่าสอนเสร็จแล้ว
                แต่คะแนนเฉลี่ยของนักเรียนอยู่ที่ <strong>{h.avgScore.toFixed(2)}/2.00</strong> (ต่ำกว่า 1.0)
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Predictive AI early warning */}
      {warnings.length > 0 && (
        <Card className="border border-orange-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-orange-800 flex items-center gap-2">
              <TrendingDown size={16} className="text-orange-500" />
              ระบบเตือนภัยล่วงหน้า (AI Predictive) — {warnings.length} คน
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <p className="text-xs text-gray-500 -mt-1 mb-1">
              เด็กที่คะแนนลดลงต่อเนื่อง ควรจับคู่กับเพื่อนกลุ่มเก่งในสัปดาห์หน้า
            </p>
            {warnings.map(w => (
              <div key={w.student.id} className="flex items-center justify-between bg-orange-50 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{w.student.name}</p>
                  <p className="text-xs text-orange-600">
                    {w.trend === 'declining' ? 'คะแนนลดลงต่อเนื่อง' : 'คะแนนต่ำต่อเนื่อง'}
                    {w.weakTags.length > 0 && <> · จุดอ่อน: {w.weakTags.map(t => describeByCode(t) ?? t).join(', ')}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {w.recentScores.map((s, i) => (
                    <span key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                      s >= 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>{s}</span>
                  ))}
                </div>
              </div>
            ))}
            <Link href="/teacher/remediation"
              className="block text-center text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl py-2.5 hover:bg-rose-100">
              💗 สร้างแผนซ่อมเสริมรายคน + ติดตามผล →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Radar chart — academic tags */}
      {tagData.length > 0 && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              คะแนนเฉลี่ยตามมาตรฐานการเรียนรู้
            </CardTitle>
            <p className="text-xs text-gray-400">แกนคือรหัสตัวชี้วัด (เช่น &quot;ป.3/1&quot;) แตะดูคำอธิบายได้ ไม่ใช่ชื่อห้องเรียน</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={tagData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Radar
                  name="คะแนนเฉลี่ย"
                  dataKey="avgScore"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const t = payload[0].payload as TagScore
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-2.5 py-1.5 max-w-[200px]">
                      <p className="text-xs font-bold text-gray-800">{t.tag}</p>
                      {describeTag(t) && <p className="text-[10px] text-gray-500 leading-snug">{describeTag(t)}</p>}
                      <p className="text-[10px] text-blue-600 font-semibold mt-0.5">{t.avgScore.toFixed(2)}/2</p>
                    </div>
                  )
                }} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 text-center mt-1">คะแนนสูงสุด = 2.0</p>
            {weakestTags.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                <p className="text-xs font-bold text-amber-700">จุดที่ควรเสริม</p>
                {weakestTags.map(t => (
                  <p key={`${t.subject}-${t.tag}`} className="text-[11px] text-gray-600">
                    <span className="font-semibold">{t.tag}</span> ({t.avgScore.toFixed(1)}/2){describeTag(t) ? ` — ${describeTag(t)}` : ''}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bar chart — per module average score */}
      {barData.length > 0 && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-gray-800">
              คะแนนเฉลี่ยแต่ละบทเรียน
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 2]} tick={{ fontSize: 10 }} ticks={[0, 0.5, 1, 1.5, 2]} />
                <Tooltip
                  formatter={(v) => v != null ? [`${Number(v).toFixed(2)} / 2.00`, 'คะแนนเฉลี่ย'] : ['-', 'คะแนนเฉลี่ย']}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.hazard ? '#ef4444' : entry.score >= 1.5 ? '#22c55e' : entry.score >= 1.0 ? '#facc15' : '#f87171'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> ≥ 1.5</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> ≥ 1.0</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> &lt; 1.0</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-module detail table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-gray-800">รายละเอียดแต่ละบทเรียน</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {summaries.map(s => (
            <div
              key={s.module.id}
              className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${s.isHazard ? 'bg-red-50 -mx-4 px-4 rounded' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-mono text-gray-400">{s.module.module_code}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{s.module.title}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                {s.pacing && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.pacing.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    s.pacing.status === 'In_Progress' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {s.pacing.status === 'Completed' ? 'เสร็จ' :
                     s.pacing.status === 'In_Progress' ? 'กำลังสอน' : 'ล่าช้า'}
                  </span>
                )}
                <div className="text-right">
                  <p className={`text-sm font-bold ${s.isHazard ? 'text-red-600' : 'text-gray-900'}`}>
                    {s.studentCount > 0 ? s.avgScore.toFixed(1) : '—'}
                  </p>
                  <p className="text-xs text-gray-400">{s.studentCount} คน</p>
                </div>
                {s.isHazard && <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />}
              </div>
            </div>
          ))}
          {summaries.length === 0 && (
            <div className="text-center py-8">
              <BookOpen size={26} className="mx-auto text-gray-200" />
              <p className="text-sm text-gray-400 mt-2">ยังไม่มีข้อมูลบทเรียน</p>
              <p className="text-xs text-gray-300 mt-0.5">ข้อมูลจะไหลเข้ามาเมื่อครูสร้างหน่วยการเรียนรู้และเริ่มเช็คอิน</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
