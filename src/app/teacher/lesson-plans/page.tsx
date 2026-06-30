'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, CurriculumModule } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { Loader2, Plus, BookPlus, ChevronRight, CalendarDays, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LessonPlansPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const session = getSession()
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [modules, setModules] = useState<Map<string, CurriculumModule>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const teacherId = session?.role === 'teacher' && session.userId ? session.userId : null
      let q = supabase.from('lesson_plans').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
      if (teacherId) q = q.eq('teacher_id', teacherId)

      const [{ data: ps }, { data: mods }] = await Promise.all([
        q,
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId),
      ])
      setPlans((ps ?? []) as LessonPlan[])
      setModules(new Map(((mods ?? []) as CurriculumModule[]).map(m => [m.id, m])))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-violet-600" /> แผนการสอน
          </h2>
          <p className="text-sm text-gray-500 mt-1">สร้างด้วย AI · แก้วันที่ · พิมพ์ส่งได้เลย</p>
        </div>
        <Link href="/teacher/lesson-plans/generate"
          className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 flex-shrink-0">
          <Plus size={14} /> สร้างแผนใหม่
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookPlus size={40} className="text-gray-300 mx-auto" />
          <p className="text-sm text-gray-400">ยังไม่มีแผนการสอน</p>
          <Link href="/teacher/lesson-plans/generate"
            className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> สร้างแผนแรกด้วย AI
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan, i) => {
            const mod = plan.module_id ? modules.get(plan.module_id) : null
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={`/teacher/lesson-plans/${plan.id}`}
                  className="block bg-white border border-gray-200 rounded-2xl px-4 py-3 hover:border-violet-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold">
                          แผนที่ {plan.plan_number}
                        </span>
                        {plan.subject && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                            {plan.subject}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mt-1">{plan.topic}</p>
                      {mod && (
                        <p className="text-xs text-gray-400 mt-0.5">{mod.module_code} — {mod.title}</p>
                      )}
                      {plan.teach_date && (
                        <p className="text-xs text-teal-600 flex items-center gap-1 mt-1">
                          <CalendarDays size={10} /> {plan.teach_date}
                        </p>
                      )}
                      {!plan.teach_date && (
                        <p className="text-xs text-amber-500 mt-1">ยังไม่ได้ระบุวันที่สอน</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
