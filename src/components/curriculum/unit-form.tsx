'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Indicator } from '@/lib/types'
import { Loader2, X } from 'lucide-react'

export interface UnitDraft {
  title: string
  planned_week: number
  expected_duration_weeks: number
  indicatorIds: string[]
}

export function UnitForm({
  indicators,
  totalWeeks,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  indicators: Indicator[]
  totalWeeks: number
  initial?: UnitDraft & { title: string }
  onSave: (draft: UnitDraft) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [week, setWeek] = useState(initial?.planned_week ?? 1)
  const [duration, setDuration] = useState(initial?.expected_duration_weeks ?? 1)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.indicatorIds ?? []))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="border border-indigo-200 bg-indigo-50/40 rounded-2xl p-4 space-y-3 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">{initial ? 'แก้ไขหน่วยการเรียนรู้' : 'เพิ่มหน่วยการเรียนรู้'}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ชื่อหน่วยการเรียนรู้..."
        className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          สัปดาห์ที่
          <select value={week} onChange={e => setWeek(Number(e.target.value))}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>สัปดาห์ {w}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          จำนวนสัปดาห์
          <select value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
            {[1, 2, 3, 4].map(d => <option key={d} value={d}>{d} สัปดาห์</option>)}
          </select>
        </label>
      </div>

      {/* indicator picker */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">ตัวชี้วัดที่หน่วยนี้ครอบคลุม ({selected.size})</p>
        {indicators.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">ยังไม่มีตัวชี้วัด — เพิ่มที่แท็บ "ตัวชี้วัด" ก่อน</p>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {indicators.map(ind => {
              const on = selected.has(ind.id)
              return (
                <button key={ind.id} onClick={() => toggle(ind.id)}
                  className={`w-full text-left flex items-start gap-2 rounded-lg px-2.5 py-2 border transition-colors ${
                    on ? 'border-indigo-300 bg-indigo-100/60' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <span className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] ${
                    on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'
                  }`}>{on ? '✓' : ''}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-gray-500">{ind.code}</span>
                      <span className={`text-[9px] px-1 py-0.5 rounded ${ind.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {ind.type === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-700 leading-snug">{ind.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => onSave({ title: title.trim(), planned_week: week, expected_duration_weeks: duration, indicatorIds: Array.from(selected) })}
        disabled={!title.trim() || saving}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {saving && <Loader2 size={15} className="animate-spin" />} บันทึกหน่วยการเรียนรู้
      </button>
    </motion.div>
  )
}
