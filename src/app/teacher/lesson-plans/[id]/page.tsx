'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, LessonPlanStatus, CurriculumModule } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import {
  Loader2, ChevronLeft, Printer, CalendarDays, Check, Pencil, X,
  NotebookPen, Save, Send, RotateCcw, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import Link from 'next/link'

type DraftPlan = Pick<LessonPlan,
  'topic' | 'subject' | 'grade' |
  'indicators_interim' | 'indicators_final' |
  'objectives_k' | 'objectives_p' | 'objectives_a' |
  'key_content' | 'competencies' | 'desired_traits' |
  'activities' | 'assessment' | 'materials'
>

const STATUS_CONFIG: Record<LessonPlanStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  draft:     { label: 'ฉบับร่าง',    bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <Pencil size={12} /> },
  submitted: { label: 'รอตรวจ',      bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Clock size={12} /> },
  approved:  { label: 'อนุมัติแล้ว', bg: 'bg-green-100',  text: 'text-green-700',  icon: <CheckCircle2 size={12} /> },
  revision:  { label: 'ขอแก้ไข',     bg: 'bg-red-100',    text: 'text-red-700',    icon: <AlertCircle size={12} /> },
}

function ViewField({ label, content }: { label: string; content: string | null }) {
  if (!content) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{content}</p>
    </div>
  )
}

function EditField({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none leading-relaxed"
      />
    </div>
  )
}

export default function LessonPlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [mod, setMod] = useState<CurriculumModule | null>(null)
  const [loading, setLoading] = useState(true)

  // Date
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [dateSaved, setDateSaved] = useState(false)

  // Full edit mode
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<DraftPlan>({
    topic: '', subject: '', grade: '',
    indicators_interim: '', indicators_final: '',
    objectives_k: '', objectives_p: '', objectives_a: '',
    key_content: '', competencies: '', desired_traits: '',
    activities: '', assessment: '', materials: '',
  })
  const [savingPlan, setSavingPlan] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)

  // Post-lesson
  const [postNote, setPostNote] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [savingPost, setSavingPost] = useState(false)
  const [postSaved, setPostSaved] = useState(false)

  // Submit / status
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('lesson_plans').select('*').eq('id', id).single()
      if (!p) { setLoading(false); return }
      const lp = p as LessonPlan
      setPlan(lp)
      setDateInput(lp.teach_date ?? '')
      setPostNote(lp.post_lesson_note ?? '')
      setSuggestion(lp.suggestion ?? '')
      if (lp.module_id) {
        const { data: m } = await supabase.from('curriculum_modules').select('*').eq('id', lp.module_id).single()
        if (m) setMod(m as CurriculumModule)
      }
      setLoading(false)
    }
    load()
  }, [id])

  function startEdit() {
    if (!plan) return
    setDraft({
      topic: plan.topic ?? '',
      subject: plan.subject ?? '',
      grade: plan.grade ?? '',
      indicators_interim: plan.indicators_interim ?? '',
      indicators_final: plan.indicators_final ?? '',
      objectives_k: plan.objectives_k ?? '',
      objectives_p: plan.objectives_p ?? '',
      objectives_a: plan.objectives_a ?? '',
      key_content: plan.key_content ?? '',
      competencies: plan.competencies ?? '',
      desired_traits: plan.desired_traits ?? '',
      activities: plan.activities ?? '',
      assessment: plan.assessment ?? '',
      materials: plan.materials ?? '',
    })
    setEditMode(true)
  }

  function set(field: keyof DraftPlan) {
    return (v: string) => setDraft(d => ({ ...d, [field]: v }))
  }

  async function savePlan() {
    if (!plan) return
    setSavingPlan(true)
    await supabase.from('lesson_plans').update({ ...draft, status: 'draft' }).eq('id', plan.id)
    setPlan(p => p ? { ...p, ...draft, status: 'draft' } : p)
    setSavingPlan(false)
    setEditMode(false)
    setPlanSaved(true)
    setTimeout(() => setPlanSaved(false), 2500)
  }

  async function saveDate() {
    if (!plan) return
    setSavingDate(true)
    await supabase.from('lesson_plans').update({ teach_date: dateInput || null }).eq('id', plan.id)
    setPlan(p => p ? { ...p, teach_date: dateInput || null } : p)
    setSavingDate(false)
    setEditingDate(false)
    setDateSaved(true)
    setTimeout(() => setDateSaved(false), 2000)
  }

  async function savePostLesson() {
    if (!plan) return
    setSavingPost(true)
    await supabase.from('lesson_plans')
      .update({ post_lesson_note: postNote || null, suggestion: suggestion || null })
      .eq('id', plan.id)
    setPlan(p => p ? { ...p, post_lesson_note: postNote || null, suggestion: suggestion || null } : p)
    setSavingPost(false)
    setPostSaved(true)
    setTimeout(() => setPostSaved(false), 2500)
  }

  async function submitPlan() {
    if (!plan) return
    setSubmitting(true)
    const now = new Date().toISOString()
    await supabase.from('lesson_plans')
      .update({ status: 'submitted', submitted_at: now, reviewer_note: null })
      .eq('id', plan.id)
    setPlan(p => p ? { ...p, status: 'submitted', submitted_at: now, reviewer_note: null } : p)
    setSubmitting(false)
  }

  async function recallPlan() {
    if (!plan) return
    setSubmitting(true)
    await supabase.from('lesson_plans')
      .update({ status: 'draft', submitted_at: null })
      .eq('id', plan.id)
    setPlan(p => p ? { ...p, status: 'draft', submitted_at: null } : p)
    setSubmitting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )
  if (!plan) return (
    <div className="text-center py-16 text-gray-400">ไม่พบแผนการสอน</div>
  )

  const status = plan.status ?? 'draft'
  const statusCfg = STATUS_CONFIG[status]
  const canEdit = status === 'draft' || status === 'revision'
  const canSubmit = status === 'draft' || status === 'revision'

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/teacher/lesson-plans" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          {canEdit && !editMode && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:border-gray-300">
              <Pencil size={13} /> แก้ไขแผน
            </button>
          )}
          <Link href={`/teacher/lesson-plans/${id}/print`}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">
            <Printer size={13} /> พิมพ์แผน
          </Link>
        </div>
      </div>

      {/* Status banner */}
      <div className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 ${statusCfg.bg}`}>
        <div className="flex items-center gap-2">
          <span className={statusCfg.text}>{statusCfg.icon}</span>
          <div>
            <p className={`text-sm font-bold ${statusCfg.text}`}>{statusCfg.label}</p>
            {status === 'submitted' && plan.submitted_at && (
              <p className="text-xs text-blue-600">
                ส่งเมื่อ {new Date(plan.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            {status === 'approved' && plan.reviewed_at && (
              <p className="text-xs text-green-600">
                อนุมัติเมื่อ {new Date(plan.reviewed_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {canSubmit && (
          <button onClick={submitPlan} disabled={submitting}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 flex-shrink-0">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            ส่งแผนให้ ผอ.
          </button>
        )}
        {status === 'submitted' && (
          <button onClick={recallPlan} disabled={submitting}
            className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 flex-shrink-0">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            เรียกคืน
          </button>
        )}
      </div>

      {/* Reviewer note (revision) */}
      {status === 'revision' && plan.reviewer_note && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-red-600 mb-1">ข้อเสนอแนะจาก ผอ.</p>
          <p className="text-sm text-red-800 whitespace-pre-line">{plan.reviewer_note}</p>
        </div>
      )}

      {/* Title block */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-semibold">
            แผนที่ {plan.plan_number}
          </span>
          {(editMode ? draft.subject : plan.subject) && (
            <span className="text-[10px] bg-white text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
              {editMode ? draft.subject : plan.subject}
            </span>
          )}
        </div>
        {editMode ? (
          <div className="space-y-2 mt-1">
            <input value={draft.topic} onChange={e => set('topic')(e.target.value)}
              placeholder="ชื่อเรื่อง"
              className="w-full text-sm font-bold border border-violet-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
            <div className="flex gap-2">
              <input value={draft.subject ?? ''} onChange={e => set('subject')(e.target.value)}
                placeholder="รายวิชา"
                className="flex-1 text-xs border border-violet-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
              <input value={draft.grade ?? ''} onChange={e => set('grade')(e.target.value)}
                placeholder="ชั้น"
                className="w-24 text-xs border border-violet-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold text-gray-900">{plan.topic}</h2>
            {mod && <p className="text-xs text-gray-500 mt-0.5">{mod.module_code} — {mod.title}</p>}
          </>
        )}
      </div>

      {/* Edit mode action bar */}
      {editMode && (
        <div className="flex gap-2 sticky top-2 z-20">
          <button onClick={savePlan} disabled={savingPlan}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {savingPlan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            บันทึกแผน
          </button>
          <button onClick={() => setEditMode(false)}
            className="bg-white border border-gray-200 text-gray-500 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1 hover:border-gray-300">
            <X size={15} /> ยกเลิก
          </button>
        </div>
      )}

      {planSaved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-sm text-green-700 font-semibold flex items-center gap-2">
          <Check size={14} /> บันทึกแผนเรียบร้อย
        </div>
      )}

      {/* Date */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-teal-500" />
            <p className="text-sm font-semibold text-gray-700">วันที่สอน</p>
          </div>
          {!editingDate && (
            <button onClick={() => setEditingDate(true)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Pencil size={11} /> แก้ไข
            </button>
          )}
        </div>
        {editingDate ? (
          <div className="flex gap-2 mt-2">
            <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            <button onClick={saveDate} disabled={savingDate}
              className="bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">
              {savingDate ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} บันทึก
            </button>
            <button onClick={() => { setEditingDate(false); setDateInput(plan.teach_date ?? '') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">ยกเลิก</button>
          </div>
        ) : (
          <p className={`text-sm mt-1 ${plan.teach_date ? 'text-teal-700 font-semibold' : 'text-amber-500'}`}>
            {plan.teach_date ?? 'ยังไม่ได้ระบุ — กดแก้ไข'}
          </p>
        )}
        {dateSaved && <p className="text-xs text-green-600 mt-1">บันทึกแล้ว ✓</p>}
      </div>

      {/* Plan sections */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 space-y-4 divide-y divide-gray-100">
        <div className="space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase">1. มาตรฐาน / ตัวชี้วัด</p>
          {editMode ? (
            <>
              <EditField label="ตัวชี้วัดระหว่างทาง" value={draft.indicators_interim ?? ''} onChange={set('indicators_interim')} rows={3} />
              <EditField label="ตัวชี้วัดปลายทาง" value={draft.indicators_final ?? ''} onChange={set('indicators_final')} rows={3} />
            </>
          ) : (
            <>
              <ViewField label="ตัวชี้วัดระหว่างทาง" content={plan.indicators_interim} />
              <ViewField label="ตัวชี้วัดปลายทาง" content={plan.indicators_final} />
            </>
          )}
        </div>

        <div className="pt-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase">2. จุดประสงค์การเรียนรู้</p>
          {editMode ? (
            <>
              <EditField label="ด้านความรู้ (K)" value={draft.objectives_k ?? ''} onChange={set('objectives_k')} rows={2} />
              <EditField label="ด้านทักษะ (P)" value={draft.objectives_p ?? ''} onChange={set('objectives_p')} rows={2} />
              <EditField label="ด้านเจตคติ (A)" value={draft.objectives_a ?? ''} onChange={set('objectives_a')} rows={2} />
            </>
          ) : (
            <>
              <ViewField label="ด้านความรู้ (K)" content={plan.objectives_k} />
              <ViewField label="ด้านทักษะ (P)" content={plan.objectives_p} />
              <ViewField label="ด้านเจตคติ (A)" content={plan.objectives_a} />
            </>
          )}
        </div>

        <div className="pt-4 space-y-4">
          {editMode ? (
            <EditField label="3. สาระสำคัญ" value={draft.key_content ?? ''} onChange={set('key_content')} rows={4} />
          ) : (
            <ViewField label="3. สาระสำคัญ" content={plan.key_content} />
          )}
        </div>

        <div className="pt-4 space-y-4">
          {editMode ? (
            <>
              <EditField label="4. สมรรถนะสำคัญ" value={draft.competencies ?? ''} onChange={set('competencies')} rows={3} />
              <EditField label="5. คุณลักษณะอันพึงประสงค์" value={draft.desired_traits ?? ''} onChange={set('desired_traits')} rows={3} />
            </>
          ) : (
            <>
              <ViewField label="4. สมรรถนะสำคัญ" content={plan.competencies} />
              <ViewField label="5. คุณลักษณะอันพึงประสงค์" content={plan.desired_traits} />
            </>
          )}
        </div>

        <div className="pt-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase">6. กิจกรรมการเรียนรู้</p>
          {editMode ? (
            <EditField label="" value={draft.activities ?? ''} onChange={set('activities')} rows={8} />
          ) : (
            <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{plan.activities}</p>
          )}
        </div>

        <div className="pt-4 space-y-4">
          {editMode ? (
            <>
              <EditField label="7. การวัดและประเมินผล" value={draft.assessment ?? ''} onChange={set('assessment')} rows={3} />
              <EditField label="8. สื่อ / แหล่งการเรียนรู้" value={draft.materials ?? ''} onChange={set('materials')} rows={3} />
            </>
          ) : (
            <>
              <ViewField label="7. การวัดและประเมินผล" content={plan.assessment} />
              <ViewField label="8. สื่อ / แหล่งการเรียนรู้" content={plan.materials} />
            </>
          )}
        </div>
      </div>

      {/* Post-lesson reflection */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <NotebookPen size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">บันทึกหลังสอน</p>
            <p className="text-xs text-amber-600">กรอกหลังจบการสอนจริง</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              9. บันทึกหลังการจัดการเรียนรู้
            </label>
            <textarea
              value={postNote}
              onChange={e => setPostNote(e.target.value)}
              rows={4}
              placeholder="นักเรียนบรรลุจุดประสงค์หรือไม่, สิ่งที่เกิดขึ้นในชั้นเรียน, ปัญหาที่พบ..."
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none leading-relaxed placeholder:text-gray-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              10. ข้อเสนอแนะ / ปรับปรุง
            </label>
            <textarea
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              rows={3}
              placeholder="ข้อเสนอแนะจากหัวหน้างาน, แนวทางปรับปรุงครั้งต่อไป..."
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none leading-relaxed placeholder:text-gray-300"
            />
          </div>
        </div>

        <button onClick={savePostLesson} disabled={savingPost}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
          {savingPost ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          บันทึกหลังสอน
        </button>

        {postSaved && (
          <p className="text-xs text-amber-700 font-semibold text-center">บันทึกเรียบร้อย ✓</p>
        )}
      </div>
    </div>
  )
}
