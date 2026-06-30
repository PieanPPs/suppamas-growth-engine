'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, CurriculumModule } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { Loader2, ChevronLeft, Printer, CalendarDays, Check, Pencil } from 'lucide-react'
import Link from 'next/link'

function Section({ title, content }: { title: string; content: string | null }) {
  if (!content) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{content}</p>
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
  const [editingDate, setEditingDate] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('lesson_plans').select('*').eq('id', id).single()
      if (!p) { setLoading(false); return }
      setPlan(p as LessonPlan)
      setDateInput(p.teach_date ?? '')
      if (p.module_id) {
        const { data: m } = await supabase.from('curriculum_modules').select('*').eq('id', p.module_id).single()
        if (m) setMod(m as CurriculumModule)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function saveDate() {
    if (!plan) return
    setSaving(true)
    await supabase.from('lesson_plans').update({ teach_date: dateInput || null }).eq('id', plan.id)
    setPlan(p => p ? { ...p, teach_date: dateInput || null } : p)
    setSaving(false)
    setEditingDate(false)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )
  if (!plan) return (
    <div className="text-center py-16 text-gray-400">ไม่พบแผนการสอน</div>
  )

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/teacher/lesson-plans" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <Link href={`/teacher/lesson-plans/${id}/print`}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg">
          <Printer size={13} /> พิมพ์แผน
        </Link>
      </div>

      {/* Title block */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-semibold">
            แผนที่ {plan.plan_number}
          </span>
          {plan.subject && (
            <span className="text-[10px] bg-white text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-semibold">
              {plan.subject}
            </span>
          )}
        </div>
        <h2 className="text-base font-bold text-gray-900">{plan.topic}</h2>
        {mod && <p className="text-xs text-gray-500 mt-0.5">{mod.module_code} — {mod.title}</p>}
      </div>

      {/* Date editor */}
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
            <button onClick={saveDate} disabled={saving}
              className="bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} บันทึก
            </button>
            <button onClick={() => { setEditingDate(false); setDateInput(plan.teach_date ?? '') }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2">ยกเลิก</button>
          </div>
        ) : (
          <p className={`text-sm mt-1 ${plan.teach_date ? 'text-teal-700 font-semibold' : 'text-amber-500'}`}>
            {plan.teach_date ? plan.teach_date : 'ยังไม่ได้ระบุ — กดแก้ไข'}
          </p>
        )}
        {savedFlash && <p className="text-xs text-green-600 mt-1">บันทึกแล้ว ✓</p>}
      </div>

      {/* Plan sections */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 space-y-4 divide-y divide-gray-100">
        <div className="space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase">1. มาตรฐาน / ตัวชี้วัด</p>
          <Section title="ตัวชี้วัดระหว่างทาง" content={plan.indicators_interim} />
          <Section title="ตัวชี้วัดปลายทาง" content={plan.indicators_final} />
        </div>

        <div className="pt-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase">2. จุดประสงค์การเรียนรู้</p>
          <Section title="ด้านความรู้ (K)" content={plan.objectives_k} />
          <Section title="ด้านทักษะ (P)" content={plan.objectives_p} />
          <Section title="ด้านเจตคติ (A)" content={plan.objectives_a} />
        </div>

        <div className="pt-4 space-y-4">
          <Section title="3. สาระสำคัญ" content={plan.key_content} />
        </div>

        <div className="pt-4 space-y-4">
          <Section title="4. สมรรถนะสำคัญ" content={plan.competencies} />
          <Section title="5. คุณลักษณะอันพึงประสงค์" content={plan.desired_traits} />
        </div>

        <div className="pt-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase">6. กิจกรรมการเรียนรู้</p>
          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{plan.activities}</p>
        </div>

        <div className="pt-4 space-y-4">
          <Section title="7. การวัดและประเมินผล" content={plan.assessment} />
          <Section title="8. สื่อ / แหล่งการเรียนรู้" content={plan.materials} />
        </div>
      </div>
    </div>
  )
}
