'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getSchoolId } from '@/lib/school'
import { LessonPlan, AssessmentMethod, AssessmentPlanRow } from '@/lib/types'
import { ASSESSMENT_METHODS, buildAssessmentPlanPrompt } from '@/lib/assessment-plan'
import { ClipboardCheck, Wand2, Check, Loader2, X, Copy } from 'lucide-react'

type LinkedTest = { id: string; title: string; test_date: string | null }

export function AssessmentPlanCard({ plan }: { plan: LessonPlan }) {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [methods, setMethods] = useState<Set<AssessmentMethod>>(new Set())
  const [targetIndicators, setTargetIndicators] = useState('')
  const [criteria, setCriteria] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // tracking — actual data recorded against this lesson_plan_id so far
  const [exitCount, setExitCount] = useState(0)
  const [homeworkCount, setHomeworkCount] = useState(0)
  const [linkedTests, setLinkedTests] = useState<LinkedTest[]>([])
  const [gradedTestCount, setGradedTestCount] = useState(0)

  const defaultIndicators = useMemo(
    () => [plan.indicators_interim, plan.indicators_final].filter(Boolean).join('\n'),
    [plan.indicators_interim, plan.indicators_final]
  )

  useEffect(() => {
    async function load() {
      const [{ data: row }, exitRes, hwRes, testsRes] = await Promise.all([
        supabase.from('assessment_plans').select('*').eq('lesson_plan_id', plan.id).maybeSingle(),
        supabase.from('student_assessments').select('id', { count: 'exact', head: true }).eq('lesson_plan_id', plan.id),
        supabase.from('homework_tasks').select('id', { count: 'exact', head: true }).eq('lesson_plan_id', plan.id),
        supabase.from('tests').select('id, title, test_date').eq('lesson_plan_id', plan.id),
      ])
      const r = row as AssessmentPlanRow | null
      if (r) {
        setMethods(new Set(r.methods))
        setTargetIndicators(r.target_indicators ?? defaultIndicators)
        setCriteria(r.criteria ?? '')
      } else {
        setTargetIndicators(defaultIndicators)
      }
      setExitCount(exitRes.count ?? 0)
      setHomeworkCount(hwRes.count ?? 0)
      const tests = (testsRes.data ?? []) as LinkedTest[]
      setLinkedTests(tests)
      if (tests.length) {
        const { count } = await supabase.from('test_scores').select('id', { count: 'exact', head: true })
          .in('test_id', tests.map(t => t.id))
        setGradedTestCount(count ?? 0)
      } else {
        setGradedTestCount(0)
      }
      setLoading(false)
    }
    load()
  }, [plan.id])

  function toggleMethod(key: AssessmentMethod) {
    setMethods(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    const payload = {
      school_id: schoolId,
      lesson_plan_id: plan.id,
      methods: Array.from(methods),
      target_indicators: targetIndicators.trim() || null,
      criteria: criteria.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('assessment_plans').upsert(payload, { onConflict: 'lesson_plan_id' })
    setSaving(false)
    if (error) { alert(`บันทึกแผนการประเมินไม่สำเร็จ: ${error.message}`); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const prompt = useMemo(() => buildAssessmentPlanPrompt({
    topic: plan.topic,
    subject: plan.subject,
    grade: plan.grade,
    indicators: targetIndicators,
    methodLabels: ASSESSMENT_METHODS.filter(m => methods.has(m.key)).map(m => m.label),
  }), [plan.topic, plan.subject, plan.grade, targetIndicators, methods])

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function statusFor(method: AssessmentMethod) {
    if (method === 'exit_ticket' || method === 'observation') {
      return exitCount > 0
        ? { ok: true, text: `บันทึกแล้ว ${exitCount} รายการ` }
        : { ok: false, text: 'ยังไม่มีข้อมูลบันทึก' }
    }
    if (method === 'homework') {
      return homeworkCount > 0
        ? { ok: true, text: `มอบหมายแล้ว ${homeworkCount} ชิ้น` }
        : { ok: false, text: 'ยังไม่ได้มอบหมายชิ้นงาน' }
    }
    // quiz
    if (linkedTests.length === 0) return { ok: false, text: 'ยังไม่ได้ผูกแบบทดสอบ (ผูกได้ตอนสร้างข้อสอบในหน้าแบบทดสอบ)' }
    return gradedTestCount > 0
      ? { ok: true, text: `ผูกแล้ว ${linkedTests.length} ชุด · ตรวจแล้ว ${gradedTestCount} คน-ครั้ง` }
      : { ok: false, text: `ผูกแล้ว ${linkedTests.length} ชุด · ยังไม่ได้ตรวจให้คะแนน` }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-6 flex justify-center">
        <Loader2 size={18} className="animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-teal-900">แผนการประเมินผู้เรียน</p>
          <p className="text-xs text-teal-600">ออกแบบวิธีวัด + เกณฑ์ผ่านของแผนนี้ ระบบติดตามให้ว่ามีข้อมูลจริงเกิดขึ้นหรือยัง</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-teal-700">วิธีประเมินที่จะใช้</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ASSESSMENT_METHODS.map(m => {
            const on = methods.has(m.key)
            const status = statusFor(m.key)
            return (
              <button key={m.key} type="button" onClick={() => toggleMethod(m.key)}
                className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${on ? 'border-teal-400 bg-white' : 'border-teal-100 bg-teal-50/50 hover:bg-white'}`}>
                <span className={`block text-xs font-semibold ${on ? 'text-teal-800' : 'text-gray-500'}`}>{m.label}</span>
                {on && (
                  <span className={`block text-[10px] mt-0.5 font-medium ${status.ok ? 'text-green-600' : 'text-amber-600'}`}>
                    {status.ok ? '✓ ' : '⚠ '}{status.text}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-teal-700">ตัวชี้วัดที่ตั้งใจวัด</label>
        <textarea value={targetIndicators} onChange={e => setTargetIndicators(e.target.value)} rows={2}
          className="w-full text-sm border border-teal-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-teal-700">เกณฑ์ผ่าน / วิธีให้คะแนน</label>
        <textarea value={criteria} onChange={e => setCriteria(e.target.value)} rows={3}
          placeholder="เช่น ตอบถูก 3/4 ข้อขึ้นไป = ผ่านดี, 2/4 = ผ่าน, ต่ำกว่านั้น = ควรปรับปรุง"
          className="w-full text-sm border border-teal-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setPromptOpen(true)}
          className="flex items-center justify-center gap-1.5 bg-white border border-teal-300 text-teal-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-teal-100">
          <Wand2 size={13} /> ให้ AI ช่วยร่าง
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} บันทึกแผนการประเมิน
        </button>
      </div>
      {saved && <p className="text-xs text-green-700 font-semibold text-center">บันทึกแล้ว ✓</p>}

      <AnimatePresence>
        {promptOpen && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Wand2 size={16} className="text-teal-600" /> พรอมต์ร่างแผนการประเมิน (ใช้กับเว็บ AI ฟรี)
                </p>
                <button onClick={() => setPromptOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto">
                <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 text-xs text-teal-700 leading-relaxed">
                  <strong>3 ขั้นตอน:</strong> ① คัดลอกพรอมต์นี้ → ② วางใน ChatGPT / Gemini / Claude
                  → ③ นำคำตอบมาวางในช่อง &quot;เกณฑ์ผ่าน&quot; ด้านบนแล้วกดบันทึก
                </div>
                <textarea readOnly value={prompt} rows={11}
                  className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700" />
              </div>
              <div className="p-4 border-t border-gray-100">
                <button onClick={copyPrompt}
                  className={`w-full text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${copied ? 'bg-green-500' : 'bg-teal-600 hover:bg-teal-700'}`}>
                  {copied ? <><Check size={15} /> คัดลอกแล้ว — ไปวางในเว็บ AI ได้เลย</> : <><Copy size={15} /> คัดลอกพรอมต์</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
