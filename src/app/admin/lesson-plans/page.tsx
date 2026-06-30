'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, LessonPlanStatus, Teacher, CurriculumModule } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import {
  Loader2, CheckCircle2, AlertCircle, Clock, Pencil, BookOpen,
  Check, X, ChevronRight, User,
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

type PlanWithMeta = LessonPlan & { teacher_name: string; module_title: string }

const STATUS_CFG: Record<LessonPlanStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'ฉบับร่าง',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  submitted: { label: 'รอตรวจ',      bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  approved:  { label: 'อนุมัติแล้ว', bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  revision:  { label: 'ขอแก้ไข',     bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
}

type Tab = 'all' | LessonPlanStatus

export default function AdminLessonPlansPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [plans, setPlans] = useState<PlanWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('submitted')

  // Review panel
  const [reviewing, setReviewing] = useState<PlanWithMeta | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: ps }, { data: ts }, { data: mods }] = await Promise.all([
        supabase.from('lesson_plans').select('*').eq('school_id', schoolId).order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        supabase.from('teachers').select('id, name').eq('school_id', schoolId),
        supabase.from('curriculum_modules').select('id, title, module_code').eq('school_id', schoolId),
      ])
      const teacherMap = new Map<string, string>((ts ?? []).map((t: Pick<Teacher, 'id' | 'name'>) => [t.id, t.name]))
      const modMap = new Map<string, string>((mods ?? []).map((m: Pick<CurriculumModule, 'id' | 'title' | 'module_code'>) => [m.id, `${m.module_code} ${m.title}`]))
      const enriched: PlanWithMeta[] = (ps ?? []).map((p: LessonPlan) => ({
        ...p,
        teacher_name: p.teacher_id ? (teacherMap.get(p.teacher_id) ?? 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ',
        module_title: p.module_id ? (modMap.get(p.module_id) ?? '') : '',
      }))
      setPlans(enriched)
      setLoading(false)
    }
    load()
  }, [])

  async function approve(plan: PlanWithMeta) {
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('lesson_plans')
      .update({ status: 'approved', reviewed_at: now, reviewer_note: null })
      .eq('id', plan.id)
    setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, status: 'approved', reviewed_at: now, reviewer_note: null } : p))
    setSaving(false)
    setReviewing(null)
  }

  async function requestRevision(plan: PlanWithMeta) {
    if (!note.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('lesson_plans')
      .update({ status: 'revision', reviewed_at: now, reviewer_note: note.trim() })
      .eq('id', plan.id)
    setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, status: 'revision', reviewed_at: now, reviewer_note: note.trim() } : p))
    setSaving(false)
    setReviewing(null)
    setNote('')
  }

  const counts: Record<Tab, number> = {
    all: plans.length,
    draft: plans.filter(p => (p.status ?? 'draft') === 'draft').length,
    submitted: plans.filter(p => (p.status ?? 'draft') === 'submitted').length,
    approved: plans.filter(p => (p.status ?? 'draft') === 'approved').length,
    revision: plans.filter(p => (p.status ?? 'draft') === 'revision').length,
  }

  const filtered = activeTab === 'all' ? plans
    : plans.filter(p => (p.status ?? 'draft') === activeTab)

  // Who hasn't submitted — teachers with only draft/no plans
  const teacherStatuses = new Map<string, Set<LessonPlanStatus>>()
  plans.forEach(p => {
    if (!p.teacher_id) return
    if (!teacherStatuses.has(p.teacher_id)) teacherStatuses.set(p.teacher_id, new Set())
    teacherStatuses.get(p.teacher_id)!.add(p.status ?? 'draft')
  })
  const notSubmitted = Array.from(teacherStatuses.entries())
    .filter(([, statuses]) => !statuses.has('submitted') && !statuses.has('approved'))
    .map(([id]) => {
      const plan = plans.find(p => p.teacher_id === id)
      return plan?.teacher_name ?? id
    })

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen size={20} className="text-violet-600" /> ตรวจแผนการสอน
        </h2>
        <p className="text-sm text-gray-500 mt-1">อนุมัติ / ขอแก้ไขแผนของครู</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {(['submitted', 'approved', 'revision', 'draft'] as LessonPlanStatus[]).map(s => {
          const cfg = STATUS_CFG[s]
          return (
            <button key={s} onClick={() => setActiveTab(s)}
              className={`rounded-2xl px-3 py-3 text-center transition-all ${activeTab === s ? cfg.bg + ' ring-2 ring-offset-1 ' + (s === 'submitted' ? 'ring-blue-400' : s === 'approved' ? 'ring-green-400' : s === 'revision' ? 'ring-red-400' : 'ring-gray-300') : 'bg-white border border-gray-200'}`}>
              <p className={`text-lg font-bold ${activeTab === s ? cfg.text : 'text-gray-800'}`}>{counts[s]}</p>
              <p className={`text-[10px] font-semibold ${activeTab === s ? cfg.text : 'text-gray-500'}`}>{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Who hasn't submitted */}
      {notSubmitted.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-amber-700 mb-2">ยังไม่ได้ส่งแผน ({notSubmitted.length} คน)</p>
          <div className="flex flex-wrap gap-1.5">
            {notSubmitted.map(name => (
              <span key={name} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                <User size={10} /> {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {(['all', 'submitted', 'approved', 'revision', 'draft'] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-xl transition-all ${activeTab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {t === 'all' ? `ทั้งหมด (${counts.all})` : `${STATUS_CFG[t as LessonPlanStatus].label} (${counts[t as LessonPlanStatus]})`}
          </button>
        ))}
      </div>

      {/* Plan list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">ไม่มีแผนในหมวดนี้</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((plan, i) => {
            const status = (plan.status ?? 'draft') as LessonPlanStatus
            const cfg = STATUS_CFG[status]
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          <User size={10} /> {plan.teacher_name}
                        </span>
                        {plan.subject && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                            {plan.subject}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">{plan.topic}</p>
                      {plan.module_title && (
                        <p className="text-xs text-gray-400 mt-0.5">{plan.module_title}</p>
                      )}
                      {plan.submitted_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          ส่งเมื่อ {new Date(plan.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {plan.reviewer_note && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-1">💬 {plan.reviewer_note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link href={`/teacher/lesson-plans/${plan.id}`}
                        className="text-xs text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                        <ChevronRight size={15} />
                      </Link>
                      {status === 'submitted' && (
                        <button onClick={() => { setReviewing(plan); setNote('') }}
                          className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-lg">
                          ตรวจ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Review panel (slide-up) */}
      <AnimatePresence>
        {reviewing && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setReviewing(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-2xl mx-auto px-5 pt-4 pb-8 space-y-4"
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
              <div>
                <p className="text-xs text-gray-400 font-semibold">{reviewing.teacher_name} · {reviewing.subject}</p>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{reviewing.topic}</h3>
              </div>

              <div className="flex gap-2">
                <Link href={`/teacher/lesson-plans/${reviewing.id}`}
                  className="flex-1 text-center text-sm font-semibold text-violet-600 border border-violet-200 rounded-xl py-2.5 hover:bg-violet-50">
                  เปิดดูแผน
                </Link>
                <Link href={`/teacher/lesson-plans/${reviewing.id}/print`}
                  className="flex-1 text-center text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">
                  พิมพ์แผน
                </Link>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  ข้อเสนอแนะ (กรณีขอแก้ไข)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="ระบุรายละเอียดที่ต้องการให้แก้ไข..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => approve(reviewing)} disabled={saving}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  อนุมัติ
                </button>
                <button onClick={() => requestRevision(reviewing)} disabled={saving || !note.trim()}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <AlertCircle size={15} />}
                  ขอแก้ไข
                </button>
              </div>

              <button onClick={() => setReviewing(null)}
                className="w-full text-sm text-gray-400 py-1 hover:text-gray-600 flex items-center justify-center gap-1">
                <X size={14} /> ปิด
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
