'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Teacher, Classroom, Course } from '@/lib/types'
import {
  ArrowLeft, Loader2, Plus, Pencil, Trash2, X, Check, UserCog, GraduationCap,
  BookOpen, AlertTriangle, ChevronDown, ChevronUp, KeyRound, Eye, EyeOff, ShieldCheck,
} from 'lucide-react'
import type { UserRole } from '@/lib/types'

const ROLE_OPTIONS: { value: UserRole; label: string; cls: string }[] = [
  { value: 'teacher',   label: 'ครูสอน',          cls: 'bg-teal-100 text-teal-700' },
  { value: 'principal', label: 'ผู้อำนวยการ (ผอ.)', cls: 'bg-blue-100 text-blue-700' },
  { value: 'admin',     label: 'ผู้ดูแลระบบ',      cls: 'bg-purple-100 text-purple-700' },
]
import { getSchoolId } from '@/lib/school'

type TeacherRow = Teacher & { roomIds: string[] }
interface SubjectInfo { subject: string; moduleCount: number }

export default function TeachersPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [moduleSubjects, setModuleSubjects] = useState<SubjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftSubjects, setDraftSubjects] = useState<Set<string>>(new Set())
  const [draftRooms, setDraftRooms] = useState<Set<string>>(new Set())
  const [draftRole, setDraftRole] = useState<UserRole>('teacher')
  const [editingPin, setEditingPin] = useState<string | null>(null)
  const [draftPin, setDraftPin] = useState('')
  const [revealPin, setRevealPin] = useState<string | null>(null)
  const [showSubjectMgmt, setShowSubjectMgmt] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const [{ data: ts }, { data: cs }, { data: crs }, { data: links }, { data: mods }] = await Promise.all([
      supabase.from('teachers').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('courses').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('teacher_classrooms').select('*'),
      supabase.from('curriculum_modules').select('subject').eq('school_id', schoolId),
    ])
    const linkMap = new Map<string, string[]>()
    ;(links ?? []).forEach((l: { teacher_id: string; classroom_id: string }) => {
      if (!linkMap.has(l.teacher_id)) linkMap.set(l.teacher_id, [])
      linkMap.get(l.teacher_id)!.push(l.classroom_id)
    })
    setTeachers(((ts ?? []) as Teacher[]).map(t => ({ ...t, roomIds: linkMap.get(t.id) ?? [] })))
    setClassrooms((cs ?? []) as Classroom[])
    setCourses((crs ?? []) as Course[])
    // build subject list from curriculum_modules
    const countMap = new Map<string, number>()
    ;(mods ?? []).forEach((m: { subject: string }) => {
      countMap.set(m.subject, (countMap.get(m.subject) ?? 0) + 1)
    })
    setModuleSubjects(
      Array.from(countMap.entries())
        .map(([subject, moduleCount]) => ({ subject, moduleCount }))
        .sort((a, b) => a.subject.localeCompare(b.subject))
    )
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function deleteSubject(subject: string) {
    setDeleting(true)
    await supabase.from('curriculum_modules').delete().eq('school_id', schoolId).eq('subject', subject)
    // remove from all teachers' subjects arrays
    const affected = teachers.filter(t => t.subjects?.includes(subject))
    for (const t of affected) {
      const newSubs = (t.subjects ?? []).filter(s => s !== subject)
      await supabase.from('teachers').update({ subjects: newSubs }).eq('id', t.id)
    }
    setConfirmDelete(null)
    setDeleting(false)
    load()
  }

  function openEdit(t?: TeacherRow) {
    setEditing(t ? t.id : 'new')
    setDraftName(t?.name ?? '')
    setDraftSubjects(new Set(t?.subjects ?? []))
    setDraftRooms(new Set(t?.roomIds ?? []))
    setDraftRole((t?.role ?? 'teacher') as UserRole)
  }

  async function savePin(teacherId: string) {
    if (!draftPin.trim()) return
    await supabase.from('teachers').update({ pin: draftPin.trim() }).eq('id', teacherId)
    setEditingPin(null)
    setDraftPin('')
    load()
  }

  function toggle(set: Set<string>, value: string, apply: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    apply(next)
  }

  async function save() {
    if (!draftName.trim() || !editing) return
    setSaving(true)
    let teacherId = editing
    if (editing === 'new') {
      const { data } = await supabase.from('teachers')
        .insert({ school_id: schoolId, name: draftName.trim(), subjects: Array.from(draftSubjects), role: draftRole })
        .select('id').single()
      teacherId = data?.id
    } else {
      await supabase.from('teachers')
        .update({ name: draftName.trim(), subjects: Array.from(draftSubjects), role: draftRole })
        .eq('id', editing)
      await supabase.from('teacher_classrooms').delete().eq('teacher_id', editing)
    }
    if (teacherId && teacherId !== 'new' && draftRooms.size > 0) {
      await supabase.from('teacher_classrooms').insert(
        Array.from(draftRooms).map(classroom_id => ({ teacher_id: teacherId, classroom_id }))
      )
    }
    setSaving(false)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('ลบครูคนนี้? (ข้อมูลแผน/เช็คอินเดิมของครูจะถูกลบด้วย)')) return
    await supabase.from('teachers').delete().eq('id', id)
    load()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-teal-500" size={32} /></div>
  }

  const roomName = (id: string) => classrooms.find(c => c.id === id)?.name ?? '?'
  const courseName = (key: string) => courses.find(c => c.subject_key === key)?.name ?? key

  return (
    <div className="space-y-4 pb-8">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog size={20} className="text-teal-600" /> จัดการครู
          </h2>
          <p className="text-sm text-gray-500 mt-1">ผูกครูกับห้องเรียนและวิชา — หน้าบันทึกคะแนน/การบ้านจะกรองให้อัตโนมัติ</p>
        </div>
        <button onClick={() => openEdit()}
          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 flex-shrink-0">
          <Plus size={14} /> เพิ่มครู
        </button>
      </div>

      {/* Edit form */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border border-teal-200 bg-teal-50/40 rounded-2xl p-4 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{editing === 'new' ? 'เพิ่มครูใหม่' : 'แก้ไขข้อมูลครู'}</p>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="ชื่อครู เช่น ครูสมศรี (ภาษาไทย ป.3)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300" />

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><GraduationCap size={13} /> ห้องที่สอน ({draftRooms.size})</p>
              <div className="flex flex-wrap gap-1.5">
                {classrooms.map(c => {
                  const on = draftRooms.has(c.id)
                  return (
                    <button key={c.id} onClick={() => toggle(draftRooms, c.id, setDraftRooms)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        on ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {c.name}
                    </button>
                  )
                })}
                {classrooms.length === 0 && <p className="text-xs text-gray-400">ยังไม่มีห้องเรียน — อัปโหลดรายชื่อนักเรียนก่อน</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><BookOpen size={13} /> วิชาที่สอน ({draftSubjects.size})</p>
              <div className="flex flex-wrap gap-1.5">
                {courses.map(c => {
                  const on = draftSubjects.has(c.subject_key)
                  return (
                    <button key={c.id} onClick={() => toggle(draftSubjects, c.subject_key, setDraftSubjects)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {c.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Role selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1"><ShieldCheck size={13} /> บทบาท</p>
              <div className="flex gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setDraftRole(opt.value)}
                    className={`flex-1 text-xs font-semibold py-2 px-2 rounded-lg border transition-colors ${
                      draftRole === opt.value ? `${opt.cls} border-transparent` : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={save} disabled={!draftName.trim() || saving}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} บันทึก
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teacher list */}
      <div className="space-y-2">
        {teachers.map(t => {
          const roleInfo = ROLE_OPTIONS.find(r => r.value === (t.role ?? 'teacher')) ?? ROLE_OPTIONS[0]
          const hasPin = !!t.pin
          const isPinEditing = editingPin === t.id
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleInfo.cls}`}>{roleInfo.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.roomIds.map(id => (
                      <span key={id} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">{roomName(id)}</span>
                    ))}
                    {(t.subjects ?? []).map(s => (
                      <span key={s} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">{courseName(s)}</span>
                    ))}
                    {t.roomIds.length === 0 && t.role === 'teacher' && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">⚠ ยังไม่ผูกห้อง</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-teal-600 p-1"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* PIN row */}
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <KeyRound size={13} className="text-gray-400 flex-shrink-0" />
                {hasPin ? (
                  <span className="text-xs text-gray-500 font-mono flex-1">
                    {revealPin === t.id ? t.pin : '●'.repeat(t.pin!.length)}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 flex-1">ยังไม่มี PIN</span>
                )}
                {hasPin && (
                  <button onClick={() => setRevealPin(revealPin === t.id ? null : t.id)}
                    className="text-gray-400 hover:text-gray-600 p-0.5">
                    {revealPin === t.id ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
                <button onClick={() => { setEditingPin(isPinEditing ? null : t.id); setDraftPin('') }}
                  className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-0.5 flex-shrink-0">
                  {isPinEditing ? <X size={12} /> : <KeyRound size={12} />}
                  {isPinEditing ? 'ยกเลิก' : hasPin ? 'รีเซต' : 'ตั้ง PIN'}
                </button>
              </div>

              {/* Inline PIN editor */}
              {isPinEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={draftPin}
                    onChange={e => setDraftPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN ตัวเลข 4–8 หลัก"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 font-mono"
                    autoFocus
                  />
                  <button onClick={() => savePin(t.id)} disabled={draftPin.length < 4}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold px-4 rounded-xl flex items-center gap-1">
                    <Check size={13} /> บันทึก
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {teachers.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-10">ยังไม่มีครูในระบบ — กดเพิ่มครูได้เลย</p>
        )}
      </div>

      {/* Subject management section */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden mt-4">
        <button
          onClick={() => setShowSubjectMgmt(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BookOpen size={16} className="text-orange-500" />
            จัดการรายวิชา ({moduleSubjects.length} วิชา)
          </span>
          {showSubjectMgmt ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showSubjectMgmt && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
              การลบวิชาจะลบ <strong>หน่วยการเรียนรู้ทั้งหมด</strong> ในวิชานั้นออกจากระบบอย่างถาวร และถอดวิชาออกจากครูที่ผูกไว้ด้วย
            </p>
            {moduleSubjects.map(({ subject, moduleCount }) => (
              <div key={subject} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{subject.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-400">{moduleCount} หน่วยการเรียนรู้</p>
                </div>
                {confirmDelete === subject ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">ยืนยันลบ?</span>
                    <button
                      onClick={() => deleteSubject(subject)}
                      disabled={deleting}
                      className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1"
                    >
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : null} ลบ
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200">ยกเลิก</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(subject)}
                    className="flex items-center gap-1 text-xs text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} /> ลบวิชานี้
                  </button>
                )}
              </div>
            ))}
            {moduleSubjects.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">ไม่มีรายวิชาในระบบ</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
