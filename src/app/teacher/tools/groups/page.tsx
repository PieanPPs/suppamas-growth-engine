'use client'

// จับกลุ่มนักเรียนแบบสุ่ม (สำหรับกิจกรรมในห้อง) — คนละเรื่องกับ /teacher/students/groups
// ซึ่งจัดกลุ่มตามความสามารถจากคะแนนจริง อันนี้คือสุ่มคละล้วนๆ ให้ครูใช้แบ่งกลุ่มงานเร็วๆ

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Student, Classroom } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { ArrowLeft, Loader2, ChevronDown, Users2, Shuffle } from 'lucide-react'

const GROUP_COLORS = [
  'bg-pink-50 border-pink-200 text-pink-700',
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-green-50 border-green-200 text-green-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-violet-50 border-violet-200 text-violet-700',
  'bg-teal-50 border-teal-200 text-teal-700',
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function RandomGroupsPage() {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [room, setRoom] = useState('')
  const [groupCount, setGroupCount] = useState(4)
  const [groups, setGroups] = useState<Student[][]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cs }, { data: st }] = await Promise.all([
        supabase.from('classrooms').select('*').eq('school_id', schoolId).order('name'),
        supabase.from('students').select('*').eq('school_id', schoolId).order('student_number'),
      ])
      setClassrooms((cs ?? []) as Classroom[])
      setStudents((st ?? []) as Student[])
      if (cs?.[0]) setRoom(cs[0].name)
      setLoading(false)
    }
    load()
  }, [])

  const roomStudents = useMemo(() => students.filter(s => s.class_name === room), [students, room])
  const maxGroups = Math.max(2, roomStudents.length)

  function makeGroups() {
    const n = Math.min(Math.max(2, groupCount), maxGroups)
    const shuffled = shuffle(roomStudents)
    const result: Student[][] = Array.from({ length: n }, () => [])
    shuffled.forEach((s, i) => result[i % n].push(s))
    setGroups(result)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/teacher/tools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> เครื่องมือช่วยครู
      </Link>

      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Users2 size={20} className="text-indigo-500" /> จับกลุ่มแบบสุ่ม
        </h2>
        <p className="text-sm text-gray-500 mt-1">แบ่งกลุ่มทำกิจกรรมแบบคละ กดปุ่มเดียวได้กลุ่มเลย</p>
      </div>

      {/* Room picker */}
      <div className="relative">
        <select value={room} onChange={e => { setRoom(e.target.value); setGroups([]) }}
          className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3 pr-10 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          {classrooms.map(c => (
            <option key={c.id} value={c.name}>{c.name} ({students.filter(s => s.class_name === c.name).length} คน)</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Group count */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">จำนวนกลุ่ม</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setGroupCount(c => Math.max(2, c - 1))}
            className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg hover:bg-gray-200">−</button>
          <span className="text-lg font-bold text-gray-900 w-8 text-center">{groupCount}</span>
          <button onClick={() => setGroupCount(c => Math.min(maxGroups, c + 1))}
            className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg hover:bg-gray-200">+</button>
        </div>
      </div>

      <button onClick={makeGroups} disabled={roomStudents.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99] transition-all">
        <Shuffle size={18} /> {groups.length > 0 ? 'สุ่มใหม่' : 'จับกลุ่มเลย!'}
      </button>

      {/* Results */}
      {groups.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {groups.map((g, i) => (
            <motion.div key={`${i}-${g[0]?.id ?? i}`}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border px-3 py-2.5 ${GROUP_COLORS[i % GROUP_COLORS.length]}`}>
              <p className="text-xs font-bold mb-1.5">กลุ่มที่ {i + 1} ({g.length} คน)</p>
              <div className="space-y-0.5">
                {g.map(s => (
                  <p key={s.id} className="text-[11px] leading-snug truncate">{s.name}</p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
