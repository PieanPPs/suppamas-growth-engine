'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Course, Teacher } from '@/lib/types'
import {
  ArrowLeft, Loader2, Plus, Pencil, Trash2, X, Check,
  BookMarked, ChevronRight, UserCircle2,
} from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export default function CoursesPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // course id or 'new'
  const [draftName, setDraftName] = useState('')
  const [draftGrade, setDraftGrade] = useState('')
  const [draftCode, setDraftCode] = useState('')
  const [codeError, setCodeError] = useState('')

  async function load() {
    const [{ data: cs }, { data: ts }] = await Promise.all([
      supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('teachers').select('id, name, subjects, role').eq('school_id', schoolId).order('name'),
    ])
    setCourses((cs ?? []) as Course[])
    setTeachers((ts ?? []) as Teacher[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function normalizeCode(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, '_')
  }

  function openNew() {
    setEditing('new')
    setDraftName('')
    setDraftGrade('')
    setDraftCode('')
    setCodeError('')
  }

  function openEdit(c: Course) {
    setEditing(c.id)
    setDraftName(c.name)
    setDraftGrade(c.grade ?? '')
    setDraftCode(c.subject_key)
    setCodeError('')
  }

  // cascade a subject_key rename across every table that references it
  async function renameSubjectKey(oldKey: string, newKey: string) {
    const { data: mods } = await supabase
      .from('curriculum_modules')
      .select('id, module_code')
      .eq('school_id', schoolId)
      .eq('subject', oldKey)
    await Promise.all((mods ?? []).map(m => {
      const suffix = m.module_code?.includes('-U') ? m.module_code.slice(m.module_code.lastIndexOf('-U')) : ''
      return supabase.from('curriculum_modules')
        .update({ subject: newKey, module_code: `${newKey}${suffix}` })
        .eq('id', m.id)
    }))

    await Promise.all([
      supabase.from('indicators').update({ subject: newKey }).eq('school_id', schoolId).eq('subject', oldKey),
      supabase.from('tests').update({ subject: newKey }).eq('school_id', schoolId).eq('subject', oldKey),
      supabase.from('score_components').update({ subject: newKey }).eq('school_id', schoolId).eq('subject', oldKey),
      supabase.from('trait_ratings').update({ subject: newKey }).eq('school_id', schoolId).eq('subject', oldKey),
    ])

    const affectedTeachers = teachers.filter(t => (t.subjects ?? []).includes(oldKey))
    await Promise.all(affectedTeachers.map(t =>
      supabase.from('teachers').update({
        subjects: (t.subjects ?? []).map(s => s === oldKey ? newKey : s),
      }).eq('id', t.id)
    ))
  }

  async function save() {
    if (!draftName.trim() || !editing) return
    const code = normalizeCode(draftCode)
    if (!code) { setCodeError('กรอกรหัสวิชา'); return }
    const dup = courses.find(c => c.subject_key === code && c.id !== editing)
    if (dup) { setCodeError(`รหัสนี้ถูกใช้กับ "${dup.name}" แล้ว`); return }
    setCodeError('')
    setSaving(true)

    if (editing === 'new') {
      await supabase.from('courses').insert({
        school_id: schoolId,
        subject_key: code,
        name: draftName.trim(),
        grade: draftGrade.trim() || null,
      })
    } else {
      const original = courses.find(c => c.id === editing)
      if (original && original.subject_key !== code) {
        if (!confirm(`เปลี่ยนรหัสวิชาจาก "${original.subject_key}" เป็น "${code}"?\nระบบจะปรับข้อมูลที่เชื่อมกับวิชานี้ทั้งหมดให้ตรงกัน`)) {
          setSaving(false)
          return
        }
        await renameSubjectKey(original.subject_key, code)
      }
      await supabase.from('courses').update({
        subject_key: code,
        name: draftName.trim(),
        grade: draftGrade.trim() || null,
      }).eq('id', editing)
    }
    setSaving(false)
    setEditing(null)
    load()
  }

  async function remove(c: Course) {
    if (!confirm(`ลบวิชา "${c.name}"? จะลบหน่วยการเรียนรู้ทั้งหมดในวิชานี้ด้วย`)) return
    await supabase.from('curriculum_modules').delete().eq('school_id', schoolId).eq('subject', c.subject_key)
    await supabase.from('courses').delete().eq('id', c.id)
    // remove from all teachers
    const affected = teachers.filter(t => t.subjects?.includes(c.subject_key))
    for (const t of affected) {
      await supabase.from('teachers').update({
        subjects: (t.subjects ?? []).filter(s => s !== c.subject_key),
      }).eq('id', t.id)
    }
    load()
  }

  // teachers assigned to a course
  function assignedTeachers(subjectKey: string) {
    return teachers.filter(t => (t.subjects ?? []).includes(subjectKey))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookMarked size={20} className="text-emerald-600" /> จัดการรายวิชา
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            สร้างวิชาและสายชั้นที่สอน · ผูกครูกับวิชาได้ที่ <Link href="/admin/teachers" className="text-teal-600 hover:underline">จัดการครู</Link>
          </p>
        </div>
        <button onClick={openNew}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 flex-shrink-0">
          <Plus size={14} /> เพิ่มวิชา
        </button>
      </div>

      {/* Add/Edit form */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{editing === 'new' ? 'เพิ่มวิชาใหม่' : 'แก้ไขรายวิชา'}</p>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <input value={draftName} onChange={e => setDraftName(e.target.value)}
              placeholder="ชื่อวิชา เช่น ภาษาไทย ป.3 หรือ คณิตศาสตร์ ม.1"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            <div>
              <input value={draftCode} onChange={e => { setDraftCode(e.target.value); setCodeError('') }}
                placeholder="รหัสวิชา เช่น THAI_P3, MATH_P3"
                className={`w-full text-sm font-mono border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${codeError ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-emerald-300'}`} />
              {codeError && <p className="text-xs text-red-500 mt-1">{codeError}</p>}
              {editing !== 'new' && (
                <p className="text-[11px] text-amber-600 mt-1">เปลี่ยนรหัสจะปรับหน่วยการเรียนรู้/ตัวชี้วัด/แบบทดสอบที่ผูกไว้ให้ตรงกันอัตโนมัติ</p>
              )}
            </div>
            <input value={draftGrade} onChange={e => setDraftGrade(e.target.value)}
              placeholder="ระดับชั้น เช่น ป.3 หรือ ม.1 (ไม่บังคับ)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            <button onClick={save} disabled={!draftName.trim() || !draftCode.trim() || saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} บันทึก
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course list */}
      <div className="space-y-2">
        {courses.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">ยังไม่มีรายวิชา — กดเพิ่มวิชาเพื่อเริ่มต้น</p>
        )}
        {courses.map((c, i) => {
          const assigned = assignedTeachers(c.subject_key)
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    {c.grade && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">{c.grade}</span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">{c.subject_key}</p>

                  {/* Assigned teachers */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {assigned.length > 0 ? assigned.map(t => (
                      <span key={t.id} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <UserCircle2 size={9} /> {t.name}
                      </span>
                    )) : (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">ยังไม่มีครูที่รับผิดชอบ</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Go to curriculum structure */}
                  <Link href="/teacher/curriculum"
                    className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded-lg hover:bg-emerald-100 flex items-center gap-0.5 transition-colors">
                    โครงสร้าง <ChevronRight size={10} />
                  </Link>
                  <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-emerald-600 p-1"><Pencil size={14} /></button>
                  <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
        <strong>วิธีใช้:</strong> สร้างวิชาที่นี่ → ไปที่ <Link href="/admin/teachers" className="underline">จัดการครู</Link> เพื่อผูกครูกับวิชา → ครูจะเห็นเฉพาะวิชาของตนในหน้าโครงสร้างรายวิชาและแผนสอน
      </div>
    </div>
  )
}
