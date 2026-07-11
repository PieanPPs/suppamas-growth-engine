'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Student, Classroom } from '@/lib/types'
import {
  ArrowLeft, Loader2, ChevronDown, Shuffle, RotateCcw, Sparkles, Dices,
} from 'lucide-react'

const CONFETTI = ['🎉', '⭐', '🎊', '✨', '🌟', '💫']

export default function RandomPickerPage() {
  const supabase = createClient()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [room, setRoom] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  const [display, setDisplay] = useState<Student | null>(null)
  const [winner, setWinner] = useState<Student | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [noRepeat, setNoRepeat] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: cs }, { data: st }] = await Promise.all([
        supabase.from('classrooms').select('*').order('name'),
        supabase.from('students').select('*'),
      ])
      setClassrooms((cs ?? []) as Classroom[])
      setStudents((st ?? []) as Student[])
      if (cs?.[0]) setRoom(cs[0].name)
      setLoading(false)
    }
    load()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  const roomStudents = students.filter(s => s.class_name === room)
  const eligible = noRepeat ? roomStudents.filter(s => !picked.has(s.id)) : roomStudents

  function spin() {
    if (spinning) return
    if (eligible.length === 0) { setPicked(new Set()); return }
    setWinner(null); setSpinning(true)
    const pool = eligible
    let ticks = 0
    const totalTicks = 22 + Math.floor(Math.random() * 8)
    timer.current = setInterval(() => {
      setDisplay(pool[Math.floor(Math.random() * pool.length)])
      ticks++
      if (ticks >= totalTicks) {
        if (timer.current) clearInterval(timer.current)
        const win = pool[Math.floor(Math.random() * pool.length)]
        setDisplay(win); setWinner(win); setSpinning(false)
        if (noRepeat) setPicked(prev => new Set(prev).add(win.id))
      }
    }, 80)
  }

  function reset() { setPicked(new Set()); setWinner(null); setDisplay(null) }

  function changeRoom(r: string) { setRoom(r); reset() }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-pink-500" size={32} /></div>
  }

  return (
    <div className="space-y-5 pb-8">
      <Link href="/teacher/tools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> เครื่องมือช่วยครู
      </Link>

      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Dices size={20} className="text-pink-500" /> สุ่มรายชื่อนักเรียน
        </h2>
        <p className="text-sm text-gray-500 mt-1">สุ่มเรียกตอบ · จับฉลาก · เล่นเกมในห้อง</p>
      </div>

      {/* Room picker */}
      <div className="relative">
        <select value={room} onChange={e => changeRoom(e.target.value)}
          className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-4 py-3 pr-10 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
          {classrooms.map(c => <option key={c.id} value={c.name}>{c.name} ({students.filter(s => s.class_name === c.name).length} คน)</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Stage */}
      <div className="relative bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 rounded-3xl px-6 py-12 text-center shadow-lg overflow-hidden min-h-[220px] flex flex-col items-center justify-center">
        {/* confetti burst on win */}
        <AnimatePresence>
          {winner && CONFETTI.map((emoji, i) => (
            <motion.span key={i}
              initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -120 - Math.random() * 80, x: (Math.random() - 0.5) * 280, scale: 1.4, rotate: Math.random() * 360 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute text-2xl"
              style={{ left: '50%', top: '55%' }}
            >{emoji}</motion.span>
          ))}
        </AnimatePresence>

        {display ? (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={display.id + (winner ? '-win' : '-spin')}
              initial={{ opacity: 0, scale: spinning ? 0.85 : 0.5, y: spinning ? 8 : 0 }}
              animate={{ opacity: 1, scale: winner ? 1 : 0.95, y: 0 }}
              transition={winner ? { type: 'spring', stiffness: 260, damping: 14 } : { duration: 0.08 }}
              className="relative z-10"
            >
              <div className="text-5xl mb-2">{display.gender === 'male' ? '👦' : display.gender === 'female' ? '👧' : '🧒'}</div>
              <p className={`font-extrabold text-white ${winner ? 'text-2xl' : 'text-xl opacity-90'}`}>{display.name}</p>
              {winner && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                  className="text-sm text-white/90 mt-1 flex items-center justify-center gap-1">
                  <Sparkles size={14} /> คุณคือคนที่ถูกเลือก!
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="relative z-10 text-white/80">
            <Shuffle size={40} className="mx-auto mb-2" />
            <p className="text-sm">กดปุ่มสุ่มเพื่อเริ่ม</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={spin}
        disabled={spinning || roomStudents.length === 0}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-lg font-bold py-4 rounded-2xl shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {spinning ? <Loader2 size={22} className="animate-spin" /> : <Shuffle size={22} />}
        {spinning ? 'กำลังสุ่ม...' : eligible.length === 0 && noRepeat && picked.size > 0 ? 'เริ่มรอบใหม่' : 'สุ่มเลย!'}
      </motion.button>

      <div className="flex items-center justify-between">
        <button onClick={() => setNoRepeat(v => !v)}
          className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${noRepeat ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-gray-200 text-gray-400'}`}>
          {noRepeat ? '✓ ไม่สุ่มซ้ำ' : 'สุ่มซ้ำได้'}
        </button>
        <button onClick={reset} className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700">
          <RotateCcw size={13} /> รีเซ็ต ({picked.size})
        </button>
      </div>

      {/* Picked history */}
      {picked.size > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-1.5">สุ่มไปแล้ว ({picked.size}/{roomStudents.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {roomStudents.filter(s => picked.has(s.id)).map(s => (
              <span key={s.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{s.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
