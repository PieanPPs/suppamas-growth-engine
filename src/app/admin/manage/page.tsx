'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  UploadCloud, GraduationCap, Shuffle, Settings, ChevronRight, Wrench, Flag, UserCog, FileText,
} from 'lucide-react'

const sections = [
  {
    href: '/admin/impact', icon: Flag, color: 'bg-orange-500',
    title: 'Impact Dashboard', desc: 'หลักฐานก่อน-หลัง · รายงานผลการดำเนินงาน พิมพ์/PDF',
  },
  {
    href: '/admin/students/import', icon: UploadCloud, color: 'bg-blue-500',
    title: 'อัปโหลดรายชื่อนักเรียน', desc: 'นำเข้าไฟล์ Excel · แยกห้องอัตโนมัติ · อัปโหลดซ้ำได้',
  },
  {
    href: '/admin/classrooms', icon: GraduationCap, color: 'bg-indigo-500',
    title: 'จัดการห้องเรียน & นักเรียน', desc: 'ดู/เพิ่ม/แก้ไข/ย้ายห้อง รายคน',
  },
  {
    href: '/admin/teachers', icon: UserCog, color: 'bg-teal-500',
    title: 'จัดการครู', desc: 'เพิ่มครู · ผูกห้องเรียนและวิชาที่สอน',
  },
  {
    href: '/teacher/pp6/print', icon: FileText, color: 'bg-violet-500',
    title: 'ปพ.6 รายงานรายบุคคล', desc: 'พิมพ์รายงานนักเรียนรายคนทั้งห้อง — เกรด เวลาเรียน พฤติกรรม',
  },
  {
    href: '/tools/random', icon: Shuffle, color: 'bg-pink-500',
    title: 'สุ่มรายชื่อนักเรียน', desc: 'เครื่องมือช่วยครู · สุ่มเรียกตอบ มีอนิเมชัน',
  },
  {
    href: '/admin/settings', icon: Settings, color: 'bg-gray-500',
    title: 'ตั้งค่าระบบ', desc: 'ปีการศึกษา · ข้อมูลโรงเรียน · อื่นๆ',
  },
]

export default function ManagePage() {
  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench size={20} className="text-blue-600" /> ระบบหลังบ้าน
        </h2>
        <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลนักเรียน ห้องเรียน และเครื่องมือต่างๆ</p>
      </div>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <motion.div key={s.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link href={s.href}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3.5 shadow-sm hover:border-blue-300 transition-colors">
              <div className={`w-11 h-11 rounded-2xl ${s.color} flex items-center justify-center text-white flex-shrink-0`}>
                <s.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
