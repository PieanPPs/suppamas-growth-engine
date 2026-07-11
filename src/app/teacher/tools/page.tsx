'use client'

// ศูนย์รวมเครื่องมือช่วยครูในห้องเรียน — ย้ายมาจากระบบหลังบ้าน (เดิม /tools/random อยู่ใต้เมนูแอดมิน
// ซึ่งครูไม่มีสิทธิ์เข้า) และเผื่อโครงไว้ให้เพิ่มเครื่องมือใหม่ได้เรื่อยๆ ตามที่โรงเรียนต้องการ

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Dices, Users2, TimerReset, Wrench, ChevronRight } from 'lucide-react'

const TOOLS = [
  {
    href: '/teacher/tools/random', icon: Dices, color: 'bg-pink-500',
    title: 'สุ่มรายชื่อนักเรียน', desc: 'สุ่มเรียกตอบ · จับฉลาก · มีอนิเมชันลุ้นๆ',
  },
  {
    href: '/teacher/tools/groups', icon: Users2, color: 'bg-indigo-500',
    title: 'จับกลุ่มแบบสุ่ม', desc: 'แบ่งกลุ่มทำกิจกรรมแบบคละ ไม่ต้องจับฉลากเอง',
  },
  {
    href: '/teacher/tools/timer', icon: TimerReset, color: 'bg-amber-500',
    title: 'จับเวลากิจกรรม', desc: 'นาฬิกานับถอยหลังตัวใหญ่ ฉายหน้าจอให้ทั้งห้องเห็น',
  },
]

export default function TeacherToolsPage() {
  return (
    <div className="space-y-5 pb-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench size={20} className="text-pink-500" /> เครื่องมือช่วยครู
        </h2>
        <p className="text-sm text-gray-500 mt-1">ตัวช่วยจัดกิจกรรมในห้องเรียน ใช้ได้ทันทีไม่ต้องเตรียมอะไร</p>
      </div>

      <div className="space-y-3">
        {TOOLS.map((t, i) => (
          <motion.div key={t.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link href={t.href}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3.5 shadow-sm hover:border-pink-300 transition-colors">
              <div className={`w-11 h-11 rounded-2xl ${t.color} flex items-center justify-center text-white flex-shrink-0`}>
                <t.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{t.title}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        อยากได้เครื่องมืออะไรเพิ่ม แจ้งผู้ดูแลระบบได้เลย
      </p>
    </div>
  )
}
