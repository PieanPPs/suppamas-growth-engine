'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Classroom, Student } from '@/lib/types'
import {
  ArrowLeft, Loader2, Users, ChevronDown, Plus, Pencil, Trash2, X, Check,
  GraduationCap, UserPlus, QrCode,
} from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export default function ClassroomsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [addingRoom, setAddingRoom] = useState(false)
  const [draft, setDraft] = useState({ name: '', number: '', gender: '' })
  const [roomDraft, setRoomDraft] = useState({ name: '', grade: '' })

  async function load() {
    const [{ data: cs }, { data: st }] = await Promise.all([
      supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
      supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
    ])
    setClassrooms((cs ?? []) as Classroom[])
    setStudents((st ?? []) as Student[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const studentsIn = (room: string) => students.filter(s => s.class_name === room)

  async function addRoom() {
    if (!roomDraft.name.trim()) return
    await supabase.from('classrooms').insert({
      school_id: schoolId,
      name: roomDraft.name.trim(),
      grade: roomDraft.name.includes('/') ? roomDraft.name.split('/')[0] : (roomDraft.grade || null),
    })
    setAddingRoom(false); setRoomDraft({ name: '', grade: '' })
    load()
  }

  async function addStudent(room: string) {
    if (!draft.name.trim()) return
    await supabase.from('students').insert({
      school_id: schoolId,
      name: draft.name.trim(), class_name: room, student_number: draft.number || null,
      gender: draft.gender || null,
    })
    setAddingTo(null); setDraft({ name: '', number: '', gender: '' })
    load()
  }

  async function saveStudent() {
    if (!editingStudent) return
    await supabase.from('students').update({
      name: editingStudent.name, class_name: editingStudent.class_name,
      student_number: editingStudent.student_number, gender: editingStudent.gender,
    }).eq('id', editingStudent.id)
    setEditingStudent(null)
    load()
  }

  async function deleteStudent(id: string) {
    if (!confirm('ลบนักเรียนคนนี้?')) return
    await supabase.from('students').delete().eq('id', id)
    load()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="space-y-4 pb-8">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={20} className="text-blue-600" /> จัดการห้องเรียน
          </h2>
          <p className="text-sm text-gray-500 mt-1">{classrooms.length} ห้อง · {students.length} คน</p>
        </div>
        <button onClick={() => setAddingRoom(v => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1">
          <Plus size={14} /> เพิ่มห้อง
        </button>
      </div>

      <AnimatePresence>
        {addingRoom && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white border border-gray-200 rounded-2xl p-3 flex gap-2 overflow-hidden">
            <input value={roomDraft.name} onChange={e => setRoomDraft(d => ({ ...d, name: e.target.value }))} placeholder="ชื่อห้อง (ป.3/4)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={addRoom} disabled={!roomDraft.name.trim()}
              className="px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">เพิ่ม</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Classroom list */}
      <div className="space-y-2">
        {classrooms.map(c => {
          const list = studentsIn(c.name)
          const open = expanded === c.id
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setExpanded(open ? null : c.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800">{c.name}</p>
                  {c.homeroom_teacher && <p className="text-xs text-gray-400">{c.homeroom_teacher}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-500 flex items-center gap-1"><Users size={14} /> {list.length}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-1.5">
                      {list.length > 0 && (
                        <Link href={`/admin/classrooms/qr-print?room=${encodeURIComponent(c.name)}`}
                          className="w-full border border-purple-200 bg-purple-50 text-purple-700 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-purple-100">
                          <QrCode size={14} /> พิมพ์ใบ QR ผู้ปกครองทั้งห้อง ({list.length} คน)
                        </Link>
                      )}
                      {list.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                          <span className="w-5 text-center text-xs text-gray-400">{i + 1}</span>
                          <span className="text-base">{s.gender === 'male' ? '👦' : s.gender === 'female' ? '👧' : '🧒'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{s.name}</p>
                            {s.student_number && <p className="text-[10px] text-gray-400">เลขที่ {s.student_number}</p>}
                          </div>
                          <button onClick={() => setEditingStudent(s)} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={13} /></button>
                          <button onClick={() => deleteStudent(s.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                        </div>
                      ))}

                      {addingTo === c.name ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 space-y-2">
                          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="ชื่อ - นามสกุล"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          <div className="flex gap-2">
                            <input value={draft.number} onChange={e => setDraft(d => ({ ...d, number: e.target.value }))} placeholder="เลขที่"
                              className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                            <select value={draft.gender} onChange={e => setDraft(d => ({ ...d, gender: e.target.value }))}
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                              <option value="">เพศ</option><option value="male">ชาย</option><option value="female">หญิง</option>
                            </select>
                            <button onClick={() => addStudent(c.name)} disabled={!draft.name.trim()} className="px-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"><Check size={16} /></button>
                            <button onClick={() => setAddingTo(null)} className="px-2 text-gray-400"><X size={16} /></button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingTo(c.name); setDraft({ name: '', number: '', gender: '' }) }}
                          className="w-full border border-dashed border-blue-300 text-blue-600 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-blue-50">
                          <UserPlus size={14} /> เพิ่มนักเรียนในห้องนี้
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
        {classrooms.length === 0 && (
          <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
            <p className="text-sm">ยังไม่มีห้องเรียน</p>
            <Link href="/admin/students/import" className="text-xs text-blue-600 font-semibold mt-1 inline-block">อัปโหลดรายชื่อนักเรียน →</Link>
          </div>
        )}
      </div>

      {/* Edit student modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingStudent(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
              <p className="text-sm font-bold text-gray-800">แก้ไขนักเรียน</p>
              <input value={editingStudent.name} onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <div className="flex gap-2">
                <input value={editingStudent.student_number ?? ''} onChange={e => setEditingStudent({ ...editingStudent, student_number: e.target.value })} placeholder="เลขที่"
                  className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <select value={editingStudent.gender ?? ''} onChange={e => setEditingStudent({ ...editingStudent, gender: e.target.value as 'male' | 'female' })}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">เพศ</option><option value="male">ชาย</option><option value="female">หญิง</option>
                </select>
              </div>
              <label className="text-xs text-gray-500">ย้ายห้อง
                <select value={editingStudent.class_name} onChange={e => setEditingStudent({ ...editingStudent, class_name: e.target.value })}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {classrooms.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={saveStudent} className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl">บันทึก</button>
                <button onClick={() => setEditingStudent(null)} className="px-4 text-gray-500 text-sm">ยกเลิก</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
