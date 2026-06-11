'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Student, StudentAssessment, HomeworkSubmission } from '@/lib/types'
import { computeHeroScores } from '@/lib/gamification'
import { RoomFilter, readStoredRoom, storeRoom } from '@/components/room-filter'
import { Loader2, Trophy, Star, Heart, BookCheck, Smile } from 'lucide-react'

const MEDAL = ['🥇', '🥈', '🥉']
const PODIUM_BG = ['from-yellow-400 to-amber-500', 'from-gray-300 to-gray-400', 'from-orange-300 to-orange-400']

export default function HeroesPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [assessments, setAssessments] = useState<StudentAssessment[]>([])
  const [homework, setHomework] = useState<HomeworkSubmission[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: st }, { data: asm }, { data: hw }] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('student_assessments').select('*'),
        supabase.from('homework_submissions').select('*'),
      ])
      setStudents((st ?? []) as Student[])
      setAssessments((asm ?? []) as StudentAssessment[])
      setHomework((hw ?? []) as HomeworkSubmission[])
      setLoading(false)
    }
    load()
  }, [])

  const roomOptions = useMemo(
    () => Array.from(new Set(students.map(s => s.class_name).filter(Boolean))).sort(),
    [students]
  )

  useEffect(() => {
    if (roomOptions.length === 0) return
    setSelectedRoom(prev => (prev && roomOptions.includes(prev)) ? prev : readStoredRoom(roomOptions))
  }, [roomOptions.join(',')])

  function selectRoom(room: string | null) {
    setSelectedRoom(room)
    storeRoom(room)
  }

  const heroes = useMemo(() => {
    const pool = selectedRoom ? students.filter(s => s.class_name === selectedRoom) : students
    return computeHeroScores(pool, assessments, homework)
  }, [students, assessments, homework, selectedRoom])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  const top3 = heroes.slice(0, 3)
  const rest = heroes.slice(3)
  const podiumOrder = [1, 0, 2] // visual: 2nd, 1st, 3rd

  return (
    <div className="space-y-6 pb-8">
      <div className="text-center">
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}>
          <Trophy size={40} className="mx-auto text-amber-500" />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-gray-900 mt-1">Suppamas Hero</h2>
        <p className="text-sm text-gray-500">
          บอร์ดสะสมแต้มฮีโร่ {selectedRoom ? `ประจำห้อง ${selectedRoom}` : 'รวมทุกห้อง'}
        </p>
      </div>

      {/* เลือกห้อง */}
      <div className="flex justify-center">
        <RoomFilter rooms={roomOptions} value={selectedRoom} onChange={selectRoom} />
      </div>

      {/* Podium */}
      {top3.length === 3 && (
        <div className="grid grid-cols-3 gap-2 items-end">
          {podiumOrder.map(idx => {
            const h = top3[idx]
            if (!h) return <div key={idx} />
            const height = idx === 0 ? 'h-32' : idx === 1 ? 'h-24' : 'h-20'
            return (
              <motion.div
                key={h.student.id}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 * idx, type: 'spring' }}
                className="flex flex-col items-center"
              >
                <span className="text-3xl">{MEDAL[idx]}</span>
                <p className="text-xs font-bold text-gray-800 text-center truncate w-full px-1">{h.student.name}</p>
                <p className="text-lg font-extrabold text-amber-600">{h.total}</p>
                <div className={`w-full ${height} rounded-t-2xl bg-gradient-to-b ${PODIUM_BG[idx]} shadow-inner mt-1 flex items-start justify-center pt-2`}>
                  <span className="text-white font-extrabold text-2xl">{idx + 1}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><Star size={12} className="text-yellow-400" /> วิชาการ</span>
        <span className="flex items-center gap-1"><Smile size={12} className="text-blue-400" /> ทักษะสังคม</span>
        <span className="flex items-center gap-1"><Heart size={12} className="text-green-500" /> สมาธิ</span>
        <span className="flex items-center gap-1"><BookCheck size={12} className="text-indigo-500" /> การบ้าน</span>
      </div>

      {/* Rest of the ranking */}
      <div className="space-y-2">
        {rest.map((h, i) => (
          <motion.div
            key={h.student.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm"
          >
            <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 4}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{h.student.name}</p>
              <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                <span>★{h.academicPoints}</span>
                <span>😊{h.softSkillPoints}</span>
                <span>💚{h.focusPoints}</span>
                <span>📚{h.homeworkPoints}</span>
              </div>
            </div>
            <span className="text-lg font-extrabold text-amber-600">{h.total}</span>
          </motion.div>
        ))}
        {heroes.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">ยังไม่มีแต้มสะสม — เริ่มบันทึกคะแนนก่อน</p>
        )}
      </div>
    </div>
  )
}
