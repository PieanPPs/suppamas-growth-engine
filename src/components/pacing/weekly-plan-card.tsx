'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CurriculumModule, PacingLog, PacingStatus, PlanSubmission, HomeworkTask } from '@/lib/types'
import { weekOfLesson } from '@/lib/pacing'
import { getSchoolId } from '@/lib/school'
import {
  CheckCircle2, Clock, AlertTriangle, Loader2, Link2, Upload, FileText,
  ExternalLink, Layers, ClipboardList, Star, ChevronRight, Sparkles, Save,
} from 'lucide-react'

const STATUS: Record<PacingStatus, { label: string; bg: string; ring: string; icon: React.ReactNode }> = {
  Completed:   { label: 'สอนจบ',    bg: 'bg-green-500',  ring: 'ring-green-300',  icon: <CheckCircle2 size={16} /> },
  In_Progress: { label: 'กำลังสอน', bg: 'bg-yellow-400', ring: 'ring-yellow-300', icon: <Clock size={16} /> },
  Delayed:     { label: 'สอนช้า',   bg: 'bg-red-500',    ring: 'ring-red-300',    icon: <AlertTriangle size={16} /> },
}

const ROUTINE_FIELDS: { key: 'routine_hook' | 'routine_core' | 'routine_active' | 'routine_exit'; label: string; mins: number; hint: string }[] = [
  { key: 'routine_hook',   label: 'Hook',   mins: 10, hint: 'Brain gym / ดึงสมาธิที่โต๊ะ' },
  { key: 'routine_core',   label: 'Core',   mins: 15, hint: 'บรรยายเข้มข้น กระชับ' },
  { key: 'routine_active', label: 'Active', mins: 20, hint: 'เกม/กิจกรรมคู่หู + Quest Log' },
  { key: 'routine_exit',   label: 'Exit',   mins: 5,  hint: 'Exit Ticket วัดความเข้าใจ' },
]

export function WeeklyPlanCard({
  module,
  selectedWeek,
  currentWeek,
  teacherId,
  plan: initialPlan,
  pacing: initialPacing,
  homeworkTask,
  exitSummary,
  onOpenExitTicket,
}: {
  module: CurriculumModule
  selectedWeek: number
  currentWeek: number
  teacherId: string | null
  plan?: PlanSubmission
  pacing?: PacingLog
  homeworkTask?: HomeworkTask
  exitSummary: { count: number; total: number; avg: number }
  onOpenExitTicket: (moduleId: string) => void
}) {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [plan, setPlan] = useState<PlanSubmission | undefined>(initialPlan)
  const [pacing, setPacing] = useState<PacingLog | undefined>(initialPacing)

  const span = Math.max(1, module.expected_duration_weeks)
  const lessonWeek = weekOfLesson(module, selectedWeek)
  const isCurrent = selectedWeek === currentWeek
  const isContinuation = span > 1 && lessonWeek != null && lessonWeek > 1

  // form state
  const [planName, setPlanName] = useState(plan?.plan_name ?? '')
  const [summary, setSummary] = useState(plan?.summary_note ?? '')
  const [link, setLink] = useState(plan?.material_link ?? '')
  const [homework, setHomework] = useState(homeworkTask?.title ?? '')
  const [routine, setRoutine] = useState({
    routine_hook: plan?.routine_hook ?? '',
    routine_core: plan?.routine_core ?? '',
    routine_active: plan?.routine_active ?? '',
    routine_exit: plan?.routine_exit ?? '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [showRoutine, setShowRoutine] = useState(
    !!(plan?.routine_hook || plan?.routine_core || plan?.routine_active || plan?.routine_exit)
  )
  // sync form fields when plan loads asynchronously from parent
  const syncedRef = useRef(false)
  useEffect(() => {
    if (initialPlan && !syncedRef.current) {
      syncedRef.current = true
      setPlanName(initialPlan.plan_name ?? '')
      setSummary(initialPlan.summary_note ?? '')
      setLink(initialPlan.material_link ?? '')
      setRoutine({
        routine_hook: initialPlan.routine_hook ?? '',
        routine_core: initialPlan.routine_core ?? '',
        routine_active: initialPlan.routine_active ?? '',
        routine_exit: initialPlan.routine_exit ?? '',
      })
    }
  }, [initialPlan])

  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const needsTeacher = !teacherId

  async function saveAll() {
    if (!teacherId) return
    setSaving(true)
    let filePath = plan?.file_path ?? null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${teacherId}/${module.id}.${ext}`
      const { error } = await supabase.storage.from('lesson-plans').upload(path, file, { upsert: true })
      if (!error) filePath = path
    }

    const { data } = await supabase
      .from('plan_submissions')
      .upsert(
        {
          school_id: schoolId,
          teacher_id: teacherId,
          module_id: module.id,
          plan_name: planName || null,
          summary_note: summary || null,
          material_link: link || null,
          file_path: filePath,
          ...routine,
        },
        { onConflict: 'teacher_id,module_id' }
      )
      .select()
      .single()
    if (data) setPlan(data as PlanSubmission)

    // homework quest (one per module)
    if (homework.trim()) {
      await supabase
        .from('homework_tasks')
        .upsert({ school_id: schoolId, module_id: module.id, title: homework.trim() }, { onConflict: 'module_id' })
    }

    setSaving(false)
    setFile(null)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  async function setStatus(status: PacingStatus) {
    if (!teacherId) return
    setSavingStatus(true)
    if (pacing) {
      await supabase.from('pacing_logs').update({ status }).eq('id', pacing.id)
      setPacing({ ...pacing, status })
    } else {
      const { data } = await supabase
        .from('pacing_logs')
        .insert({ school_id: schoolId, teacher_id: teacherId, module_id: module.id, status })
        .select()
        .single()
      if (data) setPacing(data as PacingLog)
    }
    setSavingStatus(false)
  }

  const fileUrl = plan?.file_path
    ? supabase.storage.from('lesson-plans').getPublicUrl(plan.file_path).data.publicUrl
    : null
  const effectiveStatus = pacing?.status ?? (span > 1 && lessonWeek === 1 ? 'In_Progress' : undefined)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isCurrent ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
    >
      {/* header ribbon */}
      <div className={`px-4 py-2 flex items-center justify-between text-xs font-semibold ${isCurrent ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : 'bg-gray-50 text-gray-500'}`}>
        <span className="flex items-center gap-1.5">
          {isCurrent && <Sparkles size={13} />} {module.subject.replace('_', ' ')}
        </span>
        {span > 1 && lessonWeek && (
          <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${isCurrent ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
            <Layers size={11} /> สัปดาห์ {lessonWeek}/{span} ของบท
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">{module.module_code}</span>
            <div className="flex flex-wrap gap-1">
              {module.academic_tags.map(t => (
                <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">{module.title}</p>
        </div>

        {isContinuation && (
          <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
            <Layers size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-700">บทเรียนต่อเนื่อง — ระบบดึงแผนเดิมจากสัปดาห์ที่แล้วมาให้ แก้ไขเพิ่มได้</p>
          </div>
        )}

        {/* plan name */}
        <input
          value={planName}
          onChange={e => setPlanName(e.target.value)}
          placeholder="ชื่อแผนการสอน..."
          className="w-full text-sm font-medium border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />

        {/* summary + routine */}
        <div>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={2}
            placeholder="สรุปแผนสั้นๆ / แนวทาง NT Routine 10-15-20-5"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={() => setShowRoutine(v => !v)}
            className="mt-1.5 text-xs text-blue-600 flex items-center gap-1 hover:text-blue-800"
          >
            <ChevronRight size={13} className={`transition-transform ${showRoutine ? 'rotate-90' : ''}`} />
            {showRoutine ? 'ซ่อน' : 'ขยาย'} Routine 10-15-20-5 แยกช่วง
          </button>
          <AnimatePresence>
            {showRoutine && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 mt-2 overflow-hidden"
              >
                {ROUTINE_FIELDS.map(f => (
                  <div key={f.key} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-14 text-center text-[11px] font-bold text-gray-500 bg-gray-100 rounded-lg py-2">
                      {f.mins}′<br /><span className="text-[9px] font-medium">{f.label}</span>
                    </span>
                    <input
                      value={routine[f.key]}
                      onChange={e => setRoutine(r => ({ ...r, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* material link */}
        <div className="relative">
          <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="ลิงก์สื่อการสอน AI"
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* file */}
        <label className="flex items-center gap-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl px-3 py-2 cursor-pointer hover:border-blue-300 transition-colors">
          <Upload size={15} className="text-gray-400" />
          <span className="truncate flex-1">{file ? file.name : 'แนบไฟล์แผน'}</span>
          {fileUrl && !file && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 flex items-center gap-0.5 text-xs">
              <FileText size={12} /> ไฟล์เดิม
            </a>
          )}
          <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>

        {/* homework */}
        <div className="relative">
          <ClipboardList size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
          <input
            value={homework}
            onChange={e => setHomework(e.target.value)}
            placeholder="ระบุการบ้าน (ถ้ามี)"
            className="w-full text-sm border border-amber-200 bg-amber-50/40 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* save */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={saveAll}
          disabled={saving || needsTeacher}
          className={`w-full text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${savedFlash ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saving ? <Loader2 size={15} className="animate-spin" />
            : savedFlash ? <><CheckCircle2 size={15} /> บันทึกแล้ว</>
            : <><Save size={15} /> บันทึกแผน</>}
        </motion.button>
        {needsTeacher && <p className="text-xs text-amber-600 -mt-1">⚠️ เลือกชื่อครูด้านบนก่อนบันทึก</p>}

        {/* ---- status + exit ticket ---- */}
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500">สถานะการสอน</span>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {(Object.entries(STATUS) as [PacingStatus, typeof STATUS[PacingStatus]][]).map(([s, cfg]) => {
                const selected = effectiveStatus === s
                return (
                  <motion.button
                    key={s}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setStatus(s)}
                    disabled={savingStatus || needsTeacher}
                    className={`rounded-xl py-2 flex flex-col items-center gap-1 text-xs font-semibold transition-all disabled:opacity-50 ${selected ? `${cfg.bg} text-white ring-2 ${cfg.ring}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {savingStatus ? <Loader2 size={15} className="animate-spin" /> : cfg.icon}
                    {cfg.label}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* exit ticket summary + link */}
          <button
            onClick={() => onOpenExitTicket(module.id)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs text-gray-600">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              Exit Ticket:{' '}
              {exitSummary.count > 0 ? (
                <span className="font-semibold text-gray-800">
                  ประเมิน {exitSummary.count}/{exitSummary.total} · เฉลี่ย {exitSummary.avg.toFixed(1)}★
                </span>
              ) : (
                <span className="text-gray-400">ยังไม่ได้ประเมิน</span>
              )}
            </span>
            <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
              บันทึกคะแนน <ExternalLink size={11} />
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
