'use client'

// นาฬิกาจับเวลากิจกรรมในห้องเรียน — ตัวเลขใหญ่สำหรับฉายขึ้นจอ ไม่พึ่งฐานข้อมูลเลย

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TimerReset, Play, Pause, RotateCcw } from 'lucide-react'

const PRESETS = [1, 3, 5, 10, 15, 20] // นาที

export default function ClassTimerPage() {
  const [totalSec, setTotalSec] = useState(5 * 60)
  const [remaining, setRemaining] = useState(5 * 60)
  const [running, setRunning] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) { if (timer.current) clearInterval(timer.current); return }
    timer.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          setRunning(false)
          // เสียงเตือนสั้นๆ ตอนหมดเวลา (ถ้าเบราว์เซอร์อนุญาต)
          try {
            const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            const ctx = new Ctx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
            osc.start(); osc.stop(ctx.currentTime + 1.2)
          } catch { /* ไม่มีเสียงก็ไม่เป็นไร */ }
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [running])

  function setMinutes(min: number) {
    setRunning(false)
    setTotalSec(min * 60)
    setRemaining(min * 60)
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const pct = totalSec > 0 ? remaining / totalSec : 0
  const timeUp = remaining === 0

  return (
    <div className="space-y-5 pb-8">
      <Link href="/teacher/tools" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> เครื่องมือช่วยครู
      </Link>

      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <TimerReset size={20} className="text-amber-500" /> จับเวลากิจกรรม
        </h2>
        <p className="text-sm text-gray-500 mt-1">เลือกเวลา กดเริ่ม แล้วฉายขึ้นจอให้ทั้งห้องเห็น</p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.map(m => (
          <button key={m} onClick={() => setMinutes(m)}
            className={`text-sm font-bold py-2 rounded-xl border transition-colors ${
              totalSec === m * 60 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
            }`}>
            {m}′
          </button>
        ))}
      </div>

      {/* Big display */}
      <div className={`rounded-3xl px-6 py-12 text-center transition-colors ${
        timeUp ? 'bg-red-500' : pct <= 0.2 ? 'bg-amber-500' : 'bg-gray-900'
      }`}>
        <p className={`font-mono font-extrabold leading-none text-white ${timeUp ? 'animate-pulse' : ''}`}
          style={{ fontSize: 'clamp(4rem, 22vw, 9rem)' }}>
          {mm}:{ss}
        </p>
        {timeUp && <p className="text-white/90 font-bold text-xl mt-3">⏰ หมดเวลา!</p>}
        {/* progress bar */}
        {!timeUp && (
          <div className="mt-6 h-2 bg-white/20 rounded-full overflow-hidden max-w-md mx-auto">
            <div className="h-full bg-white/80 rounded-full transition-all duration-1000" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={() => setRunning(r => !r)} disabled={remaining === 0}
          className={`flex-1 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-white disabled:opacity-40 active:scale-[0.99] transition-all ${
            running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
          }`}>
          {running ? <><Pause size={18} /> หยุดชั่วคราว</> : <><Play size={18} /> เริ่มจับเวลา</>}
        </button>
        <button onClick={() => { setRunning(false); setRemaining(totalSec) }}
          className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl flex items-center justify-center">
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  )
}
