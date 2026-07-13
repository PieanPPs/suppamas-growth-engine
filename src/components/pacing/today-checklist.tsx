'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, PartyPopper, ListChecks } from 'lucide-react'

export interface ChecklistModuleItem {
  moduleId: string
  subject: string
  title: string
  doneToday: boolean
}

export interface ChecklistRoomItem {
  room: string
  doneToday: boolean
}

export function TodayChecklist({
  modules,
  rooms,
}: {
  modules: ChecklistModuleItem[]
  rooms: ChecklistRoomItem[]
}) {
  const pendingModules = modules.filter(m => !m.doneToday)
  const pendingRooms = rooms.filter(r => !r.doneToday)
  const totalPending = pendingModules.length + pendingRooms.length

  if (modules.length === 0 && rooms.length === 0) return null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border px-4 py-3 ${totalPending === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
    >
      <p className={`text-sm font-bold flex items-center gap-1.5 ${totalPending === 0 ? 'text-green-800' : 'text-amber-800'}`}>
        {totalPending === 0 ? <PartyPopper size={15} /> : <ListChecks size={15} />}
        {totalPending === 0 ? 'วันนี้ทำครบแล้ว เยี่ยมมาก!' : `วันนี้ยังไม่ได้ทำ ${totalPending} รายการ`}
      </p>

      {totalPending > 0 && (
        <div className="mt-2 space-y-1.5">
          {pendingModules.map(m => (
            <Link key={m.moduleId} href={`/teacher/assessment?module=${m.moduleId}`}
              className="flex items-center justify-between bg-white/70 hover:bg-white rounded-xl px-3 py-2 transition-colors">
              <span className="flex items-center gap-2 text-xs text-gray-700">
                <Circle size={13} className="text-amber-400 flex-shrink-0" />
                ยังไม่บันทึกคะแนน — <span className="font-semibold">{m.subject.replace('_', ' ')}</span> ({m.title})
              </span>
              <span className="text-[11px] text-amber-700 font-semibold flex-shrink-0">ไปบันทึก →</span>
            </Link>
          ))}
          {pendingRooms.map(r => (
            <Link key={r.room} href="/teacher/assessment"
              className="flex items-center justify-between bg-white/70 hover:bg-white rounded-xl px-3 py-2 transition-colors">
              <span className="flex items-center gap-2 text-xs text-gray-700">
                <Circle size={13} className="text-amber-400 flex-shrink-0" />
                ยังไม่พบการเช็คชื่อวันนี้ — <span className="font-semibold">{r.room}</span>
                <span className="text-gray-400">(ถ้ามาครบแล้วข้ามได้เลย)</span>
              </span>
              <span className="text-[11px] text-amber-700 font-semibold flex-shrink-0">ไปเช็คชื่อ →</span>
            </Link>
          ))}
        </div>
      )}

      {totalPending === 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {modules.map(m => (
            <span key={m.moduleId} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/70 text-green-700 px-2 py-1 rounded-full">
              <CheckCircle2 size={11} /> {m.subject.replace('_', ' ')}
            </span>
          ))}
          {rooms.map(r => (
            <span key={r.room} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/70 text-green-700 px-2 py-1 rounded-full">
              <CheckCircle2 size={11} /> {r.room}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
