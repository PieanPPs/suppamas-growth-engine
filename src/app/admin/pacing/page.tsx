'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getSchoolId } from '@/lib/school'
import { MAX_ROWS } from '@/lib/db'
import {
  CurriculumModule, PacingLog, StudentAssessment, PlanSubmission, AcademicSettings,
  Indicator, ModuleIndicator, Test, TestScore,
} from '@/lib/types'
import { currentAcademicWeek } from '@/lib/pacing'
import {
  buildCrossTracking, QUADRANT_META, CrossRow, Quadrant,
} from '@/lib/cross-tracking'
import {
  Loader2, AlertTriangle, ArrowLeft, FileCheck2, FileX2, Gauge,
  CheckCircle2, Clock, XCircle, Target, Scale,
} from 'lucide-react'

type Coverage = { total: number; covered: number; finalTotal: number; finalCovered: number }
type HealthRow = { subject: string; formativePct: number; summativePct: number; gap: number }

const STATUS_META = {
  Completed:   { label: 'สอนจบ',    cls: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={12} /> },
  In_Progress: { label: 'กำลังสอน', cls: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
  Delayed:     { label: 'สอนช้า',   cls: 'bg-red-100 text-red-700',      icon: <XCircle size={12} /> },
}

export default function CrossTrackingPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [rows, setRows] = useState<CrossRow[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [health, setHealth] = useState<HealthRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: modules }, { data: pacings }, { data: assessments },
        { data: plans }, { data: settings }, { data: indicators }, { data: moduleIndicators },
        { data: tests }, { data: testScores },
      ] = await Promise.all([
        supabase.from('curriculum_modules').select('*').order('subject').order('sequence_order', { nullsFirst: false }),
        supabase.from('pacing_logs').select('*').limit(MAX_ROWS),
        supabase.from('student_assessments').select('*').limit(MAX_ROWS),
        supabase.from('plan_submissions').select('*').limit(MAX_ROWS),
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
        supabase.from('indicators').select('*'),
        supabase.from('module_indicators').select('*'),
        supabase.from('tests').select('*'),
        supabase.from('test_scores').select('*').limit(MAX_ROWS),
      ])

      const week = settings ? currentAcademicWeek((settings as AcademicSettings).term_start_date) : 0
      setCurrentWeek(week)

      const planSet = new Set((plans ?? []).map((p: PlanSubmission) => p.module_id))
      const built = buildCrossTracking(
        (modules ?? []) as CurriculumModule[],
        (pacings ?? []) as PacingLog[],
        (assessments ?? []) as StudentAssessment[],
        planSet,
        week
      )
      setRows(built)

      // ---- indicator coverage: covered = linked to a Completed module ----
      const inds = (indicators ?? []) as Indicator[]
      if (inds.length > 0) {
        const completedModuleIds = new Set(
          (pacings ?? []).filter((p: PacingLog) => p.status === 'Completed').map((p: PacingLog) => p.module_id)
        )
        const coveredIndicatorIds = new Set(
          (moduleIndicators ?? [])
            .filter((mi: ModuleIndicator) => completedModuleIds.has(mi.module_id))
            .map((mi: ModuleIndicator) => mi.indicator_id)
        )
        const finals = inds.filter(i => i.type === 'final')
        setCoverage({
          total: inds.length,
          covered: inds.filter(i => coveredIndicatorIds.has(i.id)).length,
          finalTotal: finals.length,
          finalCovered: finals.filter(i => coveredIndicatorIds.has(i.id)).length,
        })
      }
      // ---- assessment health: formative (ดาวรายคาบ) vs summative (สอบจริง) per subject ----
      const moduleSubject = new Map(((modules ?? []) as CurriculumModule[]).map(m => [m.id, m.subject]))
      const formBuckets = new Map<string, number[]>()
      ;((assessments ?? []) as StudentAssessment[]).forEach(a => {
        const subj = moduleSubject.get(a.module_id)
        if (!subj) return
        if (!formBuckets.has(subj)) formBuckets.set(subj, [])
        formBuckets.get(subj)!.push(a.academic_score / 2)
      })
      const testById = new Map(((tests ?? []) as Test[]).map(t => [t.id, t]))
      const sumBuckets = new Map<string, number[]>()
      ;((testScores ?? []) as TestScore[]).forEach(sc => {
        const t = testById.get(sc.test_id)
        if (!t || t.max_score <= 0) return
        if (!sumBuckets.has(t.subject)) sumBuckets.set(t.subject, [])
        sumBuckets.get(t.subject)!.push(Math.min(1, sc.score / t.max_score))
      })
      const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length
      const healthRows: HealthRow[] = []
      sumBuckets.forEach((sums, subj) => {
        const forms = formBuckets.get(subj)
        if (!forms || forms.length === 0 || sums.length === 0) return
        const formativePct = Math.round(avg(forms) * 100)
        const summativePct = Math.round(avg(sums) * 100)
        healthRows.push({ subject: subj, formativePct, summativePct, gap: formativePct - summativePct })
      })
      setHealth(healthRows.sort((a, b) => b.gap - a.gap))

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  const hazards = rows.filter(r => r.isHazard)
  const quadrantOrder: Exclude<Quadrant, 'NoData' | 'InProgress'>[] =
    ['PerfectPacing', 'SpeedingHazard', 'DeepLearning', 'CriticalRescue']
  const byQuadrant = (q: Quadrant) => rows.filter(r => r.quadrant === q)
  const tracked = rows.filter(r => r.studentCount > 0 && r.status)

  return (
    <div className="space-y-5 pb-8">
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> แดชบอร์ด
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gauge size={20} className="text-blue-600" /> ศูนย์วิเคราะห์การสอน
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          ไขว้ข้อมูล <strong>แผน/สถานะการสอน</strong> (ระบบ 1) กับ <strong>คะแนน/พฤติกรรมเด็ก</strong> (ระบบ 2) ผ่านรหัสโมดูล
        </p>
      </div>

      {/* Indicator coverage */}
      {coverage && coverage.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Target size={15} className="text-blue-600" /> ความครอบคลุมตัวชี้วัด
            </span>
            <span className="text-sm font-bold text-gray-900">{coverage.covered}/{coverage.total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }} animate={{ width: `${(coverage.covered / coverage.total) * 100}%` }}
              transition={{ duration: 0.8 }} />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            สอนครอบคลุมแล้ว {coverage.covered} ตัว ·{' '}
            {coverage.finalCovered < coverage.finalTotal
              ? <span className="text-orange-600 font-medium">ตัวชี้วัดปลายทางเหลืออีก {coverage.finalTotal - coverage.finalCovered} ตัว</span>
              : <span className="text-green-600 font-medium">ครอบคลุมปลายทางครบแล้ว ✓</span>}
          </p>
        </motion.div>
      )}

      {/* Assessment health: ดาวรายคาบ vs สอบจริง */}
      {health.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-1">
            <Scale size={15} className="text-purple-600" /> สุขภาพการประเมิน — ดาวรายคาบ vs สอบจริง
          </p>
          <p className="text-xs text-gray-400 mb-3">ถ้าดาวสูงแต่สอบจริงต่ำ = เกณฑ์ให้ดาวอาจหลวมเกินไป</p>
          <div className="space-y-2.5">
            {health.map(h => {
              const risky = h.gap >= 25
              return (
                <div key={h.subject}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-gray-700">{h.subject.replace('_', ' ')}</span>
                    {risky ? (
                      <span className="text-red-600 font-bold flex items-center gap-1">
                        <AlertTriangle size={11} /> ดาวสวยแต่สอบตก (ห่าง {h.gap}%)
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">สอดคล้องกัน ✓</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-[10px] text-gray-400">รายคาบ</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${h.formativePct}%` }} />
                      </div>
                      <span className="w-9 text-right text-[10px] font-semibold text-gray-600">{h.formativePct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-[10px] text-gray-400">สอบจริง</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${risky ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${h.summativePct}%` }} />
                      </div>
                      <span className="w-9 text-right text-[10px] font-semibold text-gray-600">{h.summativePct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Speeding Hazard alerts */}
      {hazards.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          {hazards.map(h => (
            <motion.div
              key={h.module.id}
              animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0.4)', '0 0 0 8px rgba(239,68,68,0)'] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="border border-red-300 bg-red-50 rounded-2xl px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-red-800">
                    ⚡ Speeding Hazard — {h.module.module_code} เร่งสอนข้ามหัวเด็ก
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    ครูกดสถานะ <strong>สอนจบ</strong> แล้ว แต่คะแนน Exit Ticket เฉลี่ยอยู่ที่{' '}
                    <strong>{h.avgScore.toFixed(2)}/2.00</strong> (ต่ำกว่าเกณฑ์)
                    {h.redYellowRatio >= 0.4 && (
                      <> และมีสมาธิ 🟡/🔴 สูงถึง <strong>{Math.round(h.redYellowRatio * 100)}%</strong> ของห้อง</>
                    )}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    → AI แนะนำให้ชะลอสปีดการสอน และจัดกิจกรรมซ่อมเสริมที่ดึงสมาธิเด็ก
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* 2×2 strategy matrix */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          แผงวิเคราะห์ยุทธศาสตร์ (Cross-Tracking Matrix)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {quadrantOrder.map((q, i) => {
            const meta = QUADRANT_META[q]
            const items = byQuadrant(q)
            return (
              <motion.div
                key={q}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
                className={`rounded-2xl border ${meta.border} ${meta.bg} px-3 py-3 min-h-[110px]`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-bold ${meta.text}`}>{meta.title}</p>
                  <span className={`text-lg font-extrabold ${meta.text}`}>{items.length}</span>
                </div>
                <p className="text-[11px] text-gray-500">{meta.subtitle}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {items.map(r => (
                    <span key={r.module.id} className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 ${meta.text}`}>
                      {r.module.module_code}
                    </span>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Detailed cross-table */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          รายละเอียดการไขว้ข้อมูลรายโมดูล
        </h3>
        <div className="space-y-2">
          {tracked.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">
              ยังไม่มีข้อมูลที่ไขว้กันได้<br />
              <span className="text-xs">ต้องมีทั้งสถานะการสอน (ระบบ 1) และคะแนนเด็ก (ระบบ 2) ในโมดูลเดียวกัน</span>
            </div>
          )}
          {tracked.map((r, i) => {
            const sMeta = r.status ? STATUS_META[r.status] : null
            const total = r.studentCount || 1
            return (
              <motion.div
                key={r.module.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${r.isHazard ? 'border-red-300' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-gray-400">{r.module.module_code}</span>
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.module.title}</p>
                  </div>
                  {/* plan submitted badge */}
                  {r.planSubmitted ? (
                    <span title="ส่งแผนแล้ว" className="text-green-600 flex-shrink-0"><FileCheck2 size={16} /></span>
                  ) : (
                    <span title="ยังไม่ส่งแผน" className="text-gray-300 flex-shrink-0"><FileX2 size={16} /></span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* System 1: pacing status */}
                  {sMeta && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${sMeta.cls}`}>
                      {sMeta.icon} {sMeta.label}
                    </span>
                  )}
                  {/* System 2: avg score */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.avgScore >= 1.5 ? 'bg-green-100 text-green-700' :
                    r.avgScore >= 1.0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    ★ {r.avgScore.toFixed(2)}/2
                  </span>
                  <span className="text-[11px] text-gray-400">{r.studentCount} คน</span>
                </div>

                {/* focus mini-bar (System 2 behavior) */}
                <div className="flex h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-green-500" style={{ width: `${(r.green / total) * 100}%` }} />
                  <div className="bg-yellow-400" style={{ width: `${(r.yellow / total) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(r.red / total) * 100}%` }} />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
