'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { CurriculumModule, PacingLog, PacingStatus, LessonPlan, LessonPlanStatus } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import {
  CheckCircle2, Clock, AlertTriangle, Loader2, Star, ExternalLink, Sparkles,
} from 'lucide-react'
import Link from 'next/link'

const PACING_STATUS: Record<PacingStatus, { label: string; bg: string; ring: string; icon: React.ReactNode }> = {
  Completed:   { label: 'สอนจบ',    bg: 'bg-green-500',  ring: 'ring-green-300',  icon: <CheckCircle2 size={16} /> },
  In_Progress: { label: 'กำลังสอน', bg: 'bg-yellow-400', ring: 'ring-yellow-300', icon: <Clock size={16} /> },
  Delayed:     { label: 'สอนช้า',   bg: 'bg-red-500',    ring: 'ring-red-300',    icon: <AlertTriangle size={16} /> },
}

const PLAN_STATUS_DOT: Record<LessonPlanStatus, { dot: string; label: string }> = {
  draft:     { dot: 'bg-gray-400',  label: 'ฉบับร่าง' },
  submitted: { dot: 'bg-blue-500',  label: 'รอตรวจ' },
  approved:  { dot: 'bg-green-500', label: 'อนุมัติ' },
  revision:  { dot: 'bg-red-500',   label: 'ขอแก้ไข' },
}

type LessonPlanSlim = Pick<LessonPlan, 'id' | 'topic' | 'status' | 'plan_number'>

export function LessonPlanPacingCard({
  module,
  lessonPlan,
  pacing,
  teacherId,
  exitSummary,
  onOpenExitTicket,
  onPacingChange,
  isCurrent,
}: {
  module: CurriculumModule
  lessonPlan: LessonPlanSlim
  pacing?: PacingLog
  teacherId: string | null
  exitSummary: { count: number; total: number; avg: number }
  onOpenExitTicket: () => void
  onPacingChange: (log: PacingLog) => void
  isCurrent: boolean
}) {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [savingStatus, setSavingStatus] = useState(false)

  const needsTeacher = !teacherId
  const planStatus = (lessonPlan.status ?? 'draft') as LessonPlanStatus
  const statusCfg = PLAN_STATUS_DOT[planStatus]
  const effectiveStatus = pacing?.status

  async function setStatus(status: PacingStatus) {
    if (!teacherId) return
    setSavingStatus(true)
    if (pacing) {
      await supabase.from('pacing_logs').update({ status }).eq('id', pacing.id)
      onPacingChange({ ...pacing, status })
    } else {
      const { data } = await supabase
        .from('pacing_logs')
        .insert({ school_id: schoolId, teacher_id: teacherId, module_id: module.id, status })
        .select()
        .single()
      if (data) onPacingChange(data as PacingLog)
    }
    setSavingStatus(false)
  }

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
          {isCurrent && <Sparkles size={13} />}
          {module.subject.replace('_', ' ')}
        </span>
        <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${isCurrent ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'}`}>
          ชั่วโมงที่ {lessonPlan.plan_number}
        </span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Module label + plan info */}
        <div>
          <p className="text-[11px] text-gray-400 mb-1">{module.title}</p>
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center mt-0.5">
              <span className="text-[10px] font-bold text-violet-600">#{lessonPlan.plan_number}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-snug">{lessonPlan.topic}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                <span className="text-[10px] text-gray-500">{statusCfg.label}</span>
                <Link
                  href={`/teacher/lesson-plans/${lessonPlan.id}`}
                  className="ml-1 text-[10px] text-violet-600 hover:text-violet-800 flex items-center gap-0.5 font-medium"
                >
                  ดูแผน <ExternalLink size={9} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Pacing status + exit ticket */}
        <div className="pt-2 border-t border-gray-100 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500">สถานะการสอน</span>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {(Object.entries(PACING_STATUS) as [PacingStatus, typeof PACING_STATUS[PacingStatus]][]).map(([s, cfg]) => {
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

          <button
            onClick={onOpenExitTicket}
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
