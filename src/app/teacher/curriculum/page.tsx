'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Course, Indicator, CurriculumModule, ModuleIndicator } from '@/lib/types'
import { AcademicSettings } from '@/lib/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { IndicatorForm } from '@/components/curriculum/indicator-form'
import { UnitForm, UnitDraft } from '@/components/curriculum/unit-form'
import { LibraryPicker } from '@/components/curriculum/library-picker'
import { ImportPaste, ParsedIndicator } from '@/components/curriculum/import-paste'
import { IndicatorPromptKit } from '@/components/curriculum/indicator-prompt-kit'
import { IndicatorLibraryItem } from '@/lib/types'
import {
  Loader2, Plus, ChevronDown, Pencil, Trash2, Layers, Target, BookPlus, CalendarDays,
  Library, ClipboardPaste, Wand2,
} from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export default function CurriculumPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])
  const [subject, setSubject] = useState<string>('')
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [modules, setModules] = useState<CurriculumModule[]>([])
  const [links, setLinks] = useState<ModuleIndicator[]>([])
  const [totalWeeks, setTotalWeeks] = useState(20)

  // form state
  const [indFormOpen, setIndFormOpen] = useState(false)
  const [editingInd, setEditingInd] = useState<Indicator | undefined>()
  const [unitFormOpen, setUnitFormOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<CurriculumModule | undefined>()
  const [saving, setSaving] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [promptKitOpen, setPromptKitOpen] = useState(false)
  const [addingCourse, setAddingCourse] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseGrade, setNewCourseGrade] = useState('')

  const reloadCourseData = useCallback(async (subj: string) => {
    const [{ data: inds }, { data: mods }, { data: lk }] = await Promise.all([
      supabase.from('indicators').select('*').eq('school_id', schoolId).eq('subject', subj).order('standard').order('sequence_order'),
      supabase.from('curriculum_modules').select('*').eq('school_id', schoolId).eq('subject', subj).order('planned_week', { nullsFirst: false }),
      supabase.from('module_indicators').select('*'),
    ])
    setIndicators((inds ?? []) as Indicator[])
    setModules((mods ?? []) as CurriculumModule[])
    setLinks((lk ?? []) as ModuleIndicator[])
  }, [supabase])

  useEffect(() => {
    async function init() {
      const [{ data: cs }, { data: settings }] = await Promise.all([
        supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('academic_settings').select('total_weeks').eq('school_id', schoolId).single(),
      ])
      setCourses((cs ?? []) as Course[])
      setTotalWeeks((settings as AcademicSettings)?.total_weeks ?? 20)
      const first = cs?.[0]?.subject_key ?? ''
      setSubject(first)
      if (first) await reloadCourseData(first)
      setLoading(false)
    }
    init()
  }, [reloadCourseData, supabase])

  async function switchCourse(subj: string) {
    setSubject(subj)
    setIndFormOpen(false); setUnitFormOpen(false); setEditingInd(undefined); setEditingUnit(undefined)
    await reloadCourseData(subj)
  }

  async function addCourse() {
    if (!newCourseName.trim()) return
    const key = `course_${Date.now()}`
    setSaving(true)
    const { data } = await supabase.from('courses')
      .insert({ school_id: schoolId, subject_key: key, name: newCourseName.trim(), grade: newCourseGrade.trim() || null })
      .select().single()
    setSaving(false)
    setAddingCourse(false); setNewCourseName(''); setNewCourseGrade('')
    if (data) {
      setCourses(prev => [...prev, data as Course])
      switchCourse((data as Course).subject_key)
    }
  }

  // ---- indicator CRUD ----
  async function saveIndicator(data: Omit<Indicator, 'id'>) {
    setSaving(true)
    if (editingInd) {
      await supabase.from('indicators').update(data).eq('id', editingInd.id)
    } else {
      await supabase.from('indicators').insert({ school_id: schoolId, ...data, sequence_order: indicators.length + 1 })
    }
    await reloadCourseData(subject)
    setSaving(false); setIndFormOpen(false); setEditingInd(undefined)
  }
  async function deleteIndicator(id: string) {
    if (!confirm('ลบตัวชี้วัดนี้?')) return
    await supabase.from('indicators').delete().eq('id', id)
    await reloadCourseData(subject)
  }

  // bulk add from central library (A) — copies into this course, skips existing
  async function addFromLibrary(libItems: IndicatorLibraryItem[]) {
    const base = indicators.length
    const rows = libItems.map((it, idx) => ({
      school_id: schoolId, subject, strand: it.strand, standard: it.standard, code: it.code,
      description: it.description, type: it.type, key_concept: it.key_concept,
      process: it.process, sequence_order: base + idx + 1,
    }))
    if (rows.length) await supabase.from('indicators').upsert(rows, { onConflict: 'school_id,subject,code', ignoreDuplicates: true })
    await reloadCourseData(subject)
    setLibraryOpen(false)
  }

  // bulk import from pasted Excel/Sheets (B)
  async function importPasted(parsed: ParsedIndicator[]) {
    const base = indicators.length
    const rows = parsed.map((r, idx) => ({
      school_id: schoolId, subject, strand: null, standard: r.standard, code: r.code,
      description: r.description, type: r.type, key_concept: r.key_concept,
      process: r.process, sequence_order: base + idx + 1,
    }))
    if (rows.length) await supabase.from('indicators').upsert(rows, { onConflict: 'school_id,subject,code', ignoreDuplicates: true })
    await reloadCourseData(subject)
    setImportOpen(false)
  }

  // ---- unit CRUD ----
  async function saveUnit(draft: UnitDraft) {
    setSaving(true)
    const tags = draft.indicatorIds
      .map(id => indicators.find(i => i.id === id)?.code)
      .filter(Boolean) as string[]

    let moduleId = editingUnit?.id
    if (editingUnit) {
      await supabase.from('curriculum_modules').update({
        title: draft.title, planned_week: draft.planned_week, sequence_order: draft.planned_week,
        expected_duration_weeks: draft.expected_duration_weeks, academic_tags: tags,
      }).eq('id', editingUnit.id)
      await supabase.from('module_indicators').delete().eq('module_id', editingUnit.id)
    } else {
      const unitNo = Math.max(0, ...modules.map(m => m.unit_no ?? 0)) + 1
      const { data } = await supabase.from('curriculum_modules').insert({
        school_id: schoolId, subject, module_code: `${subject}-U${unitNo}`, title: draft.title,
        planned_week: draft.planned_week, sequence_order: draft.planned_week,
        expected_duration_weeks: draft.expected_duration_weeks, academic_tags: tags, unit_no: unitNo,
      }).select().single()
      moduleId = (data as CurriculumModule)?.id
    }
    if (moduleId && draft.indicatorIds.length) {
      await supabase.from('module_indicators').insert(
        draft.indicatorIds.map(indicator_id => ({ module_id: moduleId, indicator_id }))
      )
    }
    await reloadCourseData(subject)
    setSaving(false); setUnitFormOpen(false); setEditingUnit(undefined)
  }
  async function deleteUnit(id: string) {
    if (!confirm('ลบหน่วยการเรียนรู้นี้?')) return
    await supabase.from('curriculum_modules').delete().eq('id', id)
    await reloadCourseData(subject)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  const interimCount = indicators.filter(i => i.type === 'interim').length
  const finalCount = indicators.filter(i => i.type === 'final').length

  // group indicators by standard
  const byStandard = indicators.reduce<Record<string, Indicator[]>>((acc, i) => {
    (acc[i.standard] ??= []).push(i); return acc
  }, {})

  // indicators linked to a module
  const indicatorsForModule = (moduleId: string) =>
    links.filter(l => l.module_id === moduleId)
      .map(l => indicators.find(i => i.id === l.indicator_id))
      .filter(Boolean) as Indicator[]

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BookPlus size={20} className="text-blue-600" /> โครงสร้างรายวิชา
        </h2>
        <p className="text-sm text-gray-500 mt-1">วิเคราะห์หลักสูตร → สร้างตัวชี้วัด → จัดหน่วยการเรียนรู้รายสัปดาห์</p>
      </div>

      {/* Course picker */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select value={subject} onChange={e => switchCourse(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3 pr-10 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            {courses.map(c => <option key={c.id} value={c.subject_key}>{c.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button onClick={() => setAddingCourse(v => !v)}
          className="flex-shrink-0 px-3 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:bg-gray-50">
          <Plus size={18} />
        </button>
      </div>

      <AnimatePresence>
        {addingCourse && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2 overflow-hidden">
            <input value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="ชื่อรายวิชา (เช่น วิทยาการคำนวณ ป.5)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex gap-2">
              <input value={newCourseGrade} onChange={e => setNewCourseGrade(e.target.value)} placeholder="ระดับชั้น (ป.5)"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={addCourse} disabled={saving || !newCourseName.trim()}
                className="px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">เพิ่ม</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coverage chips */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white border border-gray-200 rounded-xl py-2.5">
          <p className="text-xl font-bold text-gray-900">{indicators.length}</p>
          <p className="text-xs text-gray-500">ตัวชี้วัดรวม</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl py-2.5">
          <p className="text-xl font-bold text-blue-700">{interimCount}</p>
          <p className="text-xs text-blue-600">ระหว่างทาง</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl py-2.5">
          <p className="text-xl font-bold text-purple-700">{finalCount}</p>
          <p className="text-xs text-purple-600">ปลายทาง</p>
        </div>
      </div>

      <Tabs defaultValue="indicators" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="indicators"><Target size={14} className="mr-1" /> ตัวชี้วัด</TabsTrigger>
          <TabsTrigger value="units"><Layers size={14} className="mr-1" /> หน่วยการเรียนรู้</TabsTrigger>
        </TabsList>

        {/* ---- Indicators tab ---- */}
        <TabsContent value="indicators" className="space-y-3 mt-3">
          {!indFormOpen && (
            <div className="space-y-2">
              {/* fast, low-effort options first */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setLibraryOpen(true)}
                  className="border border-blue-200 bg-blue-50 text-blue-700 rounded-2xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-100">
                  <Library size={14} /> คลังกลาง
                </button>
                <button onClick={() => setPromptKitOpen(true)}
                  className="border border-violet-200 bg-violet-50 text-violet-700 rounded-2xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-violet-100">
                  <Wand2 size={14} /> พรอมต์ AI
                </button>
                <button onClick={() => setImportOpen(true)}
                  className="border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-2xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-indigo-100">
                  <ClipboardPaste size={14} /> วางผลลัพธ์
                </button>
              </div>
              <button onClick={() => { setEditingInd(undefined); setIndFormOpen(true) }}
                className="w-full border border-dashed border-gray-300 text-gray-500 rounded-2xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50">
                <Plus size={14} /> หรือพิมพ์เองทีละตัว
              </button>
            </div>
          )}
          <AnimatePresence>
            {indFormOpen && (
              <IndicatorForm subject={subject} initial={editingInd} saving={saving}
                onSave={saveIndicator} onCancel={() => { setIndFormOpen(false); setEditingInd(undefined) }} />
            )}
          </AnimatePresence>

          {Object.entries(byStandard).map(([standard, inds]) => (
            <div key={standard}>
              <h4 className="text-xs font-bold text-gray-400 mb-1.5">มาตรฐาน {standard}</h4>
              <div className="space-y-2">
                {inds.map(ind => (
                  <div key={ind.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold text-gray-600">{ind.code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ind.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {ind.type === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mt-1">{ind.description}</p>
                        {(ind.key_concept || ind.process) && (
                          <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                            {ind.key_concept && <p><span className="font-semibold">K:</span> {ind.key_concept}</p>}
                            {ind.process && <p><span className="font-semibold">P:</span> {ind.process}</p>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditingInd(ind); setIndFormOpen(true) }} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                        <button onClick={() => deleteIndicator(ind.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {indicators.length === 0 && !indFormOpen && (
            <p className="text-center text-sm text-gray-400 py-8">ยังไม่มีตัวชี้วัด — เริ่มวิเคราะห์หลักสูตรได้เลย</p>
          )}
        </TabsContent>

        {/* ---- Units tab ---- */}
        <TabsContent value="units" className="space-y-3 mt-3">
          {!unitFormOpen && (
            <button onClick={() => { setEditingUnit(undefined); setUnitFormOpen(true) }}
              className="w-full border border-dashed border-indigo-300 text-indigo-600 rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-indigo-50">
              <Plus size={16} /> เพิ่มหน่วยการเรียนรู้
            </button>
          )}
          <AnimatePresence>
            {unitFormOpen && (
              <UnitForm
                indicators={indicators}
                totalWeeks={totalWeeks}
                initial={editingUnit ? {
                  title: editingUnit.title,
                  planned_week: editingUnit.planned_week ?? 1,
                  expected_duration_weeks: editingUnit.expected_duration_weeks,
                  indicatorIds: indicatorsForModule(editingUnit.id).map(i => i.id),
                } : undefined}
                saving={saving}
                onSave={saveUnit}
                onCancel={() => { setUnitFormOpen(false); setEditingUnit(undefined) }}
              />
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {modules.map(m => {
              const inds = indicatorsForModule(m.id)
              const span = Math.max(1, m.expected_duration_weeks)
              return (
                <div key={m.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CalendarDays size={11} /> สัปดาห์ {m.planned_week ?? '—'}{span > 1 ? `–${(m.planned_week ?? 0) + span - 1}` : ''}
                        </span>
                        <span className="text-xs font-mono text-gray-400">{m.module_code}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mt-1">{m.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {inds.map(ind => (
                          <span key={ind.id} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${ind.type === 'interim' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {ind.code}
                          </span>
                        ))}
                        {inds.length === 0 && <span className="text-[10px] text-gray-300">ยังไม่ผูกตัวชี้วัด</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingUnit(m); setUnitFormOpen(true) }} className="text-gray-400 hover:text-indigo-600 p-1"><Pencil size={14} /></button>
                      <button onClick={() => deleteUnit(m.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {modules.length === 0 && !unitFormOpen && (
            <p className="text-center text-sm text-gray-400 py-8">ยังไม่มีหน่วยการเรียนรู้ — สร้างโครงสร้างรายวิชาได้เลย</p>
          )}
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {libraryOpen && (
          <LibraryPicker
            existingCodes={new Set(indicators.map(i => i.code))}
            onAdd={addFromLibrary}
            onClose={() => setLibraryOpen(false)}
          />
        )}
        {importOpen && (
          <ImportPaste onImport={importPasted} onClose={() => setImportOpen(false)} />
        )}
        {promptKitOpen && (
          <IndicatorPromptKit
            courseName={courses.find(c => c.subject_key === subject)?.name ?? subject}
            grade={courses.find(c => c.subject_key === subject)?.grade}
            onClose={() => setPromptKitOpen(false)}
            onOpenImport={() => { setPromptKitOpen(false); setImportOpen(true) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
