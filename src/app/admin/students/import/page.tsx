'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { parseStudentWorkbook, ParsedRoom } from '@/lib/student-import'
import {
  ArrowLeft, UploadCloud, Loader2, FileSpreadsheet, Users, CheckCircle2,
  UserPlus, RefreshCcw, AlertCircle,
} from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export default function ImportStudentsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [rooms, setRooms] = useState<ParsedRoom[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null)
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true); setError(''); setDone(null)
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parseStudentWorkbook(buf)
      setRooms(parsed)
      // load existing national_ids to compute add vs update
      const { data } = await supabase.from('students').select('national_id').eq('school_id', schoolId)
      setExistingIds(new Set((data ?? []).map(s => s.national_id).filter(Boolean) as string[]))
    } catch {
      setError('อ่านไฟล์ไม่สำเร็จ — ตรวจสอบว่าเป็นไฟล์ .xlsx รูปแบบรายชื่อนักเรียน')
    }
    setParsing(false)
  }

  const allStudents = rooms.flatMap(r => r.students.map(s => ({ ...s, room: r.room })))
  const totalNew = allStudents.filter(s => !s.national_id || !existingIds.has(s.national_id)).length
  const totalUpdate = allStudents.filter(s => s.national_id && existingIds.has(s.national_id)).length
  const noIdCount = allStudents.filter(s => !s.national_id).length

  async function save() {
    setSaving(true)
    // 1. upsert classrooms (unique per school+name)
    await supabase.from('classrooms').upsert(
      rooms.map(r => ({ school_id: schoolId, name: r.room, grade: r.grade, homeroom_teacher: r.teacher })),
      { onConflict: 'school_id,name' }
    )
    // 2. upsert students matched by national_id, insert the id-less ones
    const rows = allStudents.map(s => ({
      school_id: schoolId,
      national_id: s.national_id, student_number: s.student_number, name: s.name,
      class_name: s.room, birth_date: s.birth_date, status: s.status, gender: s.gender,
    }))
    const withId = rows.filter(r => r.national_id)
    const withoutId = rows.filter(r => !r.national_id)
    if (withId.length) await supabase.from('students').upsert(withId, { onConflict: 'national_id' })
    if (withoutId.length) await supabase.from('students').insert(withoutId)

    setSaving(false)
    setDone({ added: totalNew, updated: totalUpdate })
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/admin/manage" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> ระบบหลังบ้าน
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UploadCloud size={20} className="text-blue-600" /> อัปโหลดรายชื่อนักเรียน
        </h2>
        <p className="text-sm text-gray-500 mt-1">ระบบแยกห้องให้อัตโนมัติ · อัปโหลดซ้ำได้ (จับคู่ด้วยเลขบัตรประชาชน)</p>
      </div>

      {/* Upload box */}
      {!done && (
        <label className="block border-2 border-dashed border-blue-300 rounded-2xl px-4 py-8 text-center cursor-pointer hover:bg-blue-50 transition-colors">
          {parsing ? (
            <Loader2 size={28} className="mx-auto text-blue-500 animate-spin" />
          ) : (
            <FileSpreadsheet size={28} className="mx-auto text-blue-400" />
          )}
          <p className="text-sm font-semibold text-gray-700 mt-2">{fileName || 'เลือกไฟล์ .xlsx'}</p>
          <p className="text-xs text-gray-400 mt-0.5">รองรับไฟล์ส่งออกรายชื่อ (1 ชีท = 1 ห้อง)</p>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </label>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Success */}
      {done && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-green-50 border border-green-200 rounded-2xl px-4 py-5 text-center">
          <CheckCircle2 size={32} className="mx-auto text-green-500" />
          <p className="text-sm font-bold text-green-800 mt-2">นำเข้าสำเร็จ!</p>
          <p className="text-xs text-green-700 mt-1">เพิ่มใหม่ {done.added} คน · อัปเดต {done.updated} คน</p>
          <Link href="/admin/classrooms" className="inline-block mt-3 text-sm font-semibold text-green-700 underline">
            ไปจัดการห้องเรียน →
          </Link>
        </motion.div>
      )}

      {/* Preview */}
      {rooms.length > 0 && !done && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-200 rounded-xl py-2.5 text-center">
              <p className="text-xl font-bold text-gray-900">{rooms.length}</p>
              <p className="text-xs text-gray-500">ห้องเรียน</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl py-2.5 text-center">
              <p className="text-xl font-bold text-green-700 flex items-center justify-center gap-1"><UserPlus size={15} />{totalNew}</p>
              <p className="text-xs text-green-600">เพิ่มใหม่</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl py-2.5 text-center">
              <p className="text-xl font-bold text-blue-700 flex items-center justify-center gap-1"><RefreshCcw size={14} />{totalUpdate}</p>
              <p className="text-xs text-blue-600">อัปเดต</p>
            </div>
          </div>

          {noIdCount > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={13} /> มี {noIdCount} แถวที่ไม่มีเลขบัตร — จะเพิ่มเป็นรายการใหม่ทุกครั้งที่อัปโหลด
            </p>
          )}

          <div className="space-y-2">
            {rooms.map(r => (
              <div key={r.room} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{r.room}</p>
                    {r.teacher && <p className="text-xs text-gray-400">ครูประจำชั้น: {r.teacher}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-500 flex items-center gap-1">
                    <Users size={14} /> {r.students.length}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={save}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            ยืนยันนำเข้า {allStudents.length} คน
          </motion.button>
        </>
      )}
    </div>
  )
}
