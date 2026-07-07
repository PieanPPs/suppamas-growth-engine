'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, LessonPlanStatus, Teacher, CurriculumModule, Course, AcademicSettings } from '@/lib/types'
import { currentAcademicWeek } from '@/lib/pacing'
import { getSchoolId } from '@/lib/school'
import {
  Loader2, CheckCircle2, AlertCircle, Clock, Pencil, BookOpen,
  Check, X, ChevronRight, User, MessageSquare,
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
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [modWeeks, setModWeeks] = useState<Map<string, number | null>>(new Map())
  const [totalWeeks, setTotalWeeks] = useState(20)
  const [currentWeek, setCurrentWeek] = useState(1)
  // มุมมองรายสัปดาห์ — พอครู/วิชาเยอะขึ้น รายการรวมทุกสัปดาห์จะอ่านไม่ไหว
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('submitted')

  // Review panel
  const [reviewing, setReviewing] = useState<PlanWithMeta | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: ps }, { data: ts }, { data: mods }, { data: crs }, { data: settings }] = await Promise.all([
        supabase.from('lesson_plans').select('*').eq('school_id', schoolId).order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
        supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('curriculum_modules').select('id, title, module_code, planned_week').eq('school_id', schoolId),
        supabase.from('courses').select('*').eq('school_id', schoolId),
        supabase.from('academic_settings').select('*').eq('school_id', schoolId).maybeSingle(),
      ])
      const teacherMap = new Map<string, string>((ts ?? []).map((t: Teacher) => [t.id, t.name]))
      const modMap = new Map<string, string>((mods ?? []).map((m: Pick<CurriculumModule, 'id' | 'title' | 'module_code'>) => [m.id, `${m.module_code} ${m.title}`]))
      const enriched: PlanWithMeta[] = (ps ?? []).map((p: LessonPlan) => ({
        ...p,
        teacher_name: p.teacher_id ? (teacherMap.get(p.teacher_id) ?? 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ',
        module_title: p.module_id ? (modMap.get(p.module_id) ?? '') : '',
      }))
      setPlans(enriched)
      setTeachers((ts ?? []) as Teacher[])
      setCourses((crs ?? []) as Course[])
      setModWeeks(new Map((mods ?? []).map((m: { id: string; planned_week: number | null }) => [m.id, m.planned_week])))
      const s = settings as AcademicSettings | null
      if (s) {
        setTotalWeeks(s.total_weeks)
        const wk = Math.min(s.total_weeks, Math.max(1, currentAcademicWeek(s.term_start_date) || 1))
        setCurrentWeek(wk)
        setSelectedWeek(wk) // เปิดมาเห็นสัปดาห์ปัจจุบันก่อน — กดดู "ทุกสัปดาห์" ได้
      }
      setLoading(false)
    }
    load()
  }, [])

  async function approve(plan: PlanWithMeta) {
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('lesson_plans')
      .update({ status: 'approved', reviewed_at: now, reviewer_note: null })
      .eq('id', plan.id)
    setSaving(false)
    if (error) { alert(`อนุมัติไม่สำเร็จ: ${error.message}`); return }
    setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, status: 'approved', reviewed_at: now, reviewer_note: null } : p))
    setReviewing(null)
  }

  async function requestRevision(plan: PlanWithMeta) {
    if (!note.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('lesson_plans')
      .update({ status: 'revision', reviewed_at: now, reviewer_note: note.trim() })
      .eq('id', plan.id)
    setSaving(false)
    if (error) { alert(`ส่งขอแก้ไขไม่สำเร็จ: ${error.message}`); return }
    setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, status: 'revision', reviewed_at: now, reviewer_note: note.trim() } : p))
    setReviewing(null)
    setNote('')
  }

  async function saveNote(plan: PlanWithMeta) {
    if (!note.trim()) return
    setSaving(true)
    const { error } = await supabase.from('lesson_plans')
      .update({ reviewer_note: note.trim() })
      .eq('id', plan.id)
    setSaving(false)
    if (error) { alert(`บันทึกหมายเหตุไม่สำเร็จ: ${error.message}`); return }
    setPlans(ps => ps.map(p => p.id === plan.id ? { ...p, reviewer_note: note.trim() } : p))
    setReviewing(null)
    setNote('')
  }

  // สัปดาห์ที่แผนสังกัด: ใช้ planned_week ของแผน — แผนเก่าที่ไม่ระบุใช้สัปดาห์แรกของหน่วยแทน
  const effWeek = (p: PlanWithMeta): number | null =>
    p.planned_week ?? (p.module_id ? modWeeks.get(p.module_id) ?? null : null)

  const weekPlans = selectedWeek === 'all' ? plans : plans.filter(p => effWeek(p) === selectedWeek)
  const noWeekCount = selectedWeek === 'all' ? 0 : plans.filter(p => effWeek(p) === null).length

  const counts: Record<Tab, number> = {
    all: weekPlans.length,
    draft: weekPlans.filter(p => (p.status ?? 'draft') === 'draft').length,
    submitted: weekPlans.filter(p => (p.status ?? 'draft') === 'submitted').length,
    approved: weekPlans.filter(p => (p.status ?? 'draft') === 'approved').length,
    revision: weekPlans.filter(p => (p.status ?? 'draft') === 'revision').length,
  }

  const filtered = activeTab === 'all' ? weekPlans
    : weekPlans.filter(p => (p.status ?? 'draft') === activeTab)

  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key.replace('_', ' ')

  // ครูที่ยังไม่ส่งแผน (ในสัปดาห์ที่เลือก): นับจากครูทุกคนที่มีบทบาทครูสอน
  // ไม่ใช่แค่ครูที่เคยมีแผน — คนที่ยังไม่เคยสร้างแผนเลยคือคนที่ต้องเห็นชัดที่สุด
  const notSubmitted = useMemo(() => {
    const submittedTeacherIds = new Set(
      weekPlans
        .filter(p => (p.status ?? 'draft') === 'submitted' || (p.status ?? 'draft') === 'approved')
        .map(p => p.teacher_id)
        .filter(Boolean)
    )
    return teachers
      .filter(t => (t.role ?? 'teacher') === 'teacher' && !submittedTeacherIds.has(t.id))
      .map(t => ({
        id: t.id,
        name: t.name,
        subjects: (t.subjects ?? []).map(courseName).join(' · '),
      }))
  }, [teachers, weekPlans, courses])

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

      {/* Week selector — ดูรายสัปดาห์ (ค่าเริ่มต้น = สัปดาห์ปัจจุบัน) หรือรวมทุกสัปดาห์ */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button onClick={() => setSelectedWeek('all')}
          className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
            selectedWeek === 'all' ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-500'
          }`}>
          ทุกสัปดาห์
        </button>
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(wk => (
          <button key={wk} onClick={() => setSelectedWeek(wk)}
            className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
              selectedWeek === wk ? 'bg-violet-600 border-violet-600 text-white'
                : wk === currentWeek ? 'bg-violet-50 border-violet-300 text-violet-700'
                : 'bg-white border-gray-200 text-gray-500'
            }`}>
            {wk === currentWeek ? `สัปดาห์นี้ (${wk})` : `สป. ${wk}`}
          </button>
        ))}
      </div>
      {selectedWeek !== 'all' && noWeekCount > 0 && (
        <p className="text-[11px] text-gray-400 -mt-3">
          มีอีก {noWeekCount} แผนที่ไม่ระบุสัปดาห์ — ดูได้ในมุมมอง &quot;ทุกสัปดาห์&quot;
        </p>
      )}

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

      {/* Who hasn't submitted (สัปดาห์ที่เลือก) — บอกวิชา/ชั้นที่รับผิดชอบด้วย */}
      {notSubmitted.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-amber-700 mb-2">
            ยังไม่ได้ส่งแผน{selectedWeek !== 'all' ? `สัปดาห์ที่ ${selectedWeek}` : ''} ({notSubmitted.length} คน)
          </p>
          <div className="space-y-1">
            {notSubmitted.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-xl">
                <User size={11} className="flex-shrink-0" />
                <span className="font-semibold">{t.name}</span>
                {t.subjects && <span className="text-amber-600 truncate">— {t.subjects}</span>}
              </div>
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
                            {plan.subject}{plan.grade ? ` ${plan.grade}` : ''}
                          </span>
                        )}
                        {effWeek(plan) != null && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">
                            สป. {effWeek(plan)}
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
                  หมายเหตุ / ข้อเสนอแนะ
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="พิมพ์หมายเหตุถึงครู ครูจะเห็นทันที..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
                {note.trim() && (
                  <button onClick={() => saveNote(reviewing)} disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl py-2 hover:bg-blue-50 disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                    บันทึกหมายเหตุ (ไม่เปลี่ยนสถานะ)
                  </button>
                )}
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
