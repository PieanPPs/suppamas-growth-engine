'use client'

// ใบ QR ผู้ปกครองรายห้อง — พิมพ์แจกครั้งเดียว ผู้ปกครองสแกนดูรายงานพัฒนาการ
// ของลูก (/report/[id]) ได้ตลอดปี ไม่ต้องพึ่ง LINE/กระดาษรายงานรายเทอม
// QR สร้างในเครื่องทั้งหมด (qrcode.react) — ลิงก์นักเรียนไม่ถูกส่งไป service ภายนอก

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { Student, School } from '@/lib/types'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export default function ParentQrPrintPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [loading, setLoading] = useState(true)
  const [room, setRoom] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [school, setSchool] = useState<School | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search)
      const rm = params.get('room') ?? ''
      setRoom(rm)
      setOrigin(window.location.origin)

      const [{ data: stds }, { data: sch }] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId)
          .eq('class_name', rm).order('student_number'),
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      ])
      setStudents((stds ?? []) as Student[])
      setSchool(sch as School | null)
      setLoading(false)
    }
    load()
  }, [])

  const logoUrl = school?.logo_path
    ? supabase.storage.from('school-assets').getPublicUrl(school.logo_path).data.publicUrl
    : null

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* screen-only controls */}
      <div className="print:hidden flex items-center justify-between py-4 px-4">
        <Link href="/admin/classrooms" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> จัดการห้องเรียน
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800">ใบ QR ผู้ปกครอง — {room || 'ไม่ระบุห้อง'}</p>
          <p className="text-xs text-gray-400">{students.length} คน · ตัดแจกคนละใบ แปะสมุดจดการบ้านได้</p>
        </div>
        <button onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
          <Printer size={15} /> พิมพ์
        </button>
      </div>

      {students.length === 0 && (
        <p className="print:hidden text-center text-sm text-gray-400 py-16">ไม่พบนักเรียนในห้องนี้</p>
      )}

      {/* print grid: 2 columns of cut-out cards */}
      <div className="grid grid-cols-2 gap-3 px-4 print:px-0 print:gap-2 pb-8 print:pb-0">
        {students.map(s => (
          <div key={s.id}
            className="border border-dashed border-gray-400 rounded-lg p-3 flex gap-3 items-center break-inside-avoid">
            <QRCodeSVG value={`${origin}/report/${s.id}`} size={88} level="M" marginSize={0} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                )}
                <p className="text-[10px] text-gray-500 truncate">{school?.name ?? ''}</p>
              </div>
              <p className="text-sm font-bold text-gray-900 mt-1 leading-snug">{s.name}</p>
              <p className="text-[11px] text-gray-500">
                {room}{s.student_number ? ` · เลขที่ ${s.student_number}` : ''}
              </p>
              <p className="text-[10px] text-gray-600 mt-1 leading-tight">
                สแกนด้วยกล้องมือถือ ดูพัฒนาการ คะแนน และการบ้านของลูกได้ตลอดปี
              </p>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          nav, header, aside { display: none !important; }
          body { background: white; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
