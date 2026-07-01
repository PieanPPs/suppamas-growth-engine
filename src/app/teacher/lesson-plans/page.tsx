'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, LessonPlanStatus, CurriculumModule, School, Teacher } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { getSession } from '@/lib/auth'
import { loadDocxLib, fetchLogoForDocx, buildLessonPlanBlock } from '@/lib/lesson-plan-docx'
import {
  Loader2, Plus, BookPlus, ChevronRight, CalendarDays, BookOpen, Trash2, FileStack, X, FileText,
} from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_DOT: Record<LessonPlanStatus, { dot: string; label: string; text: string }> = {
  draft:     { dot: 'bg-gray-400',   label: 'ฉบับร่าง', text: 'text-gray-500' },
  submitted: { dot: 'bg-blue-500',   label: 'รอตรวจ',   text: 'text-blue-600' },
  approved:  { dot: 'bg-green-500',  label: 'อนุมัติ',  text: 'text-green-700' },
  revision:  { dot: 'bg-red-500',    label: 'ขอแก้ไข',  text: 'text-red-600' },
}

type GroupedModule = {
  moduleId: string | null
  mod: CurriculumModule | null
  plans: LessonPlan[]
}

export default function LessonPlansPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const session = getSession()
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [modules, setModules] = useState<Map<string, CurriculumModule>>(new Map())
  const [teachers, setTeachers] = useState<Map<string, Teacher>>(new Map())
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      const teacherId = session?.role === 'teacher' && session.userId ? session.userId : null
      let q = supabase.from('lesson_plans').select('*').eq('school_id', schoolId)
        .order('module_id').order('plan_number')
      if (teacherId) q = q.eq('teacher_id', teacherId)

      const [{ data: ps }, { data: mods }, { data: ts }, { data: sc }] = await Promise.all([
        q,
        supabase.from('curriculum_modules').select('*').eq('school_id', schoolId),
        supabase.from('teachers').select('*').eq('school_id', schoolId),
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      ])
      setPlans((ps ?? []) as LessonPlan[])
      setModules(new Map(((mods ?? []) as CurriculumModule[]).map(m => [m.id, m])))
      setTeachers(new Map(((ts ?? []) as Teacher[]).map(t => [t.id, t])))
      setSchool(sc as School | null)
      setLoading(false)
    }
    load()
  }, [])

  async function deletePlan(id: string) {
    setDeleting(true)
    await supabase.from('lesson_plans').delete().eq('id', id)
    setPlans(ps => ps.filter(p => p.id !== id))
    setConfirmDelete(null)
    setDeleting(false)
  }

  function toggleSelectMode() {
    setSelectMode(v => !v)
    setSelectedIds(new Set())
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function exportSelected() {
    if (selectedIds.size === 0 || exporting) return
    setExporting(true)
    try {
      const docx = await loadDocxLib()
      const { Document, Packer, Paragraph, PageBreak, convertInchesToTwip } = docx
      const logoUrl = school?.logo_path
        ? supabase.storage.from('school-assets').getPublicUrl(school.logo_path).data.publicUrl
        : null
      const logo = logoUrl ? await fetchLogoForDocx(logoUrl) : null

      const selectedPlans = plans.filter(p => selectedIds.has(p.id))
      const children = selectedPlans.flatMap((plan, i) => [
        ...(i > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
        ...buildLessonPlanBlock(docx, {
          plan,
          moduleTitle: plan.module_id ? modules.get(plan.module_id)?.title ?? null : null,
          teacherName: plan.teacher_id ? teachers.get(plan.teacher_id)?.name ?? null : null,
          schoolName: school?.name ?? 'โรงเรียน',
          directorName: school?.director_name ?? null,
          logo,
        }),
      ])

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.18),
              },
            },
          },
          children,
        }],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `แผนการสอน ${selectedPlans.length} แผน.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Group by module
  const grouped: GroupedModule[] = []
  const seen = new Map<string | null, number>()
  plans.forEach(plan => {
    const key = plan.module_id ?? '__none__'
    if (!seen.has(plan.module_id)) {
      seen.set(plan.module_id, grouped.length)
      grouped.push({
        moduleId: plan.module_id,
        mod: plan.module_id ? modules.get(plan.module_id) ?? null : null,
        plans: [],
      })
    }
    grouped[seen.get(plan.module_id)!].plans.push(plan)
  })

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-violet-600" /> แผนการสอน
          </h2>
          <p className="text-sm text-gray-500 mt-1">จัดกลุ่มตามหน่วยการเรียนรู้ · พิมพ์ส่งได้เลย</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {plans.length > 0 && (
            <button onClick={toggleSelectMode}
              className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 ${selectMode ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {selectMode ? <><X size={14} /> ยกเลิก</> : <><FileStack size={14} /> เลือกหลายแผน</>}
            </button>
          )}
          <Link href="/teacher/lesson-plans/generate"
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
            <Plus size={14} /> สร้างแผนใหม่
          </Link>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookPlus size={40} className="text-gray-300 mx-auto" />
          <p className="text-sm text-gray-400">ยังไม่มีแผนการสอน</p>
          <Link href="/teacher/lesson-plans/generate"
            className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
            <Plus size={14} /> สร้างแผนแรก
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.moduleId ?? '__none__'} className="space-y-2">
              {/* Module header */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {group.mod?.title ?? 'ไม่มีหน่วยการเรียนรู้'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {group.plans.length} แผนรายชั่วโมง
                    {group.mod?.expected_duration_weeks
                      ? ` · หน่วยนี้ประมาณ ${group.mod.expected_duration_weeks} สัปดาห์`
                      : ''}
                  </p>
                </div>
                {group.moduleId && (
                  <Link href={`/teacher/lesson-plans/generate?module=${group.moduleId}`}
                    className="text-[11px] font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-0.5">
                    <Plus size={11} /> เพิ่มชั่วโมง
                  </Link>
                )}
              </div>

              {/* Plans in this module */}
              <AnimatePresence>
                {group.plans.map((plan) => {
                  const status = (plan.status ?? 'draft') as LessonPlanStatus
                  const cfg = STATUS_DOT[status]
                  const isConfirming = confirmDelete === plan.id
                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                    >
                      <div
                        onClick={selectMode ? () => toggleSelected(plan.id) : undefined}
                        className={`bg-white border rounded-2xl px-4 py-3 transition-colors ${selectMode ? 'cursor-pointer ' + (selectedIds.has(plan.id) ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 hover:border-violet-200') : 'border-gray-200 hover:border-violet-200'}`}>
                        <div className="flex items-start gap-2">
                          {/* Plan number badge / select checkbox */}
                          {selectMode ? (
                            <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 border-2 ${selectedIds.has(plan.id) ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
                              {selectedIds.has(plan.id) && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mt-0.5">
                              <span className="text-[11px] font-bold text-violet-600">#{plan.plan_number}</span>
                            </div>
                          )}

                          {/* Content */}
                          {selectMode ? (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold flex items-center gap-1`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  <span className={cfg.text}>{cfg.label}</span>
                                </span>
                                {plan.subject && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                    {plan.subject}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-gray-800 mt-0.5">{plan.topic}</p>
                            </div>
                          ) : (
                            <Link href={`/teacher/lesson-plans/${plan.id}`} className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold flex items-center gap-1`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  <span className={cfg.text}>{cfg.label}</span>
                                </span>
                                {plan.subject && (
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                    {plan.subject}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-gray-800 mt-0.5">{plan.topic}</p>
                              {plan.teach_dates?.length ? (
                                <p className="text-xs text-teal-600 flex items-center gap-1 mt-0.5">
                                  <CalendarDays size={10} /> {plan.teach_dates.join(', ')}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-500 mt-0.5">ยังไม่ได้ระบุวันที่สอน</p>
                              )}
                            </Link>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {selectMode ? null : !isConfirming ? (
                              <>
                                <Link href={`/teacher/lesson-plans/${plan.id}`}
                                  className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500">
                                  <ChevronRight size={15} />
                                </Link>
                                <button onClick={() => setConfirmDelete(plan.id)}
                                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deletePlan(plan.id)} disabled={deleting}
                                  className="text-xs font-semibold bg-red-500 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                                  {deleting ? <Loader2 size={11} className="animate-spin" /> : 'ลบ'}
                                </button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="text-xs font-semibold text-gray-500 px-2 py-1.5 hover:text-gray-700">
                                  ยกเลิก
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Floating export bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="max-w-2xl mx-auto">
            <button onClick={exportSelected} disabled={exporting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg text-sm transition-all flex items-center justify-center gap-2">
              {exporting
                ? <><Loader2 size={18} className="animate-spin" /> กำลังสร้างไฟล์...</>
                : <><FileText size={18} /> Export Word ({selectedIds.size} แผน)</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
