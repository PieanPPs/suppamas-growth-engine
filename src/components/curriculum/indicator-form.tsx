'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Indicator, IndicatorType } from '@/lib/types'
import { Loader2, X } from 'lucide-react'

export function IndicatorForm({
  subject,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  subject: string
  initial?: Indicator
  onSave: (data: Omit<Indicator, 'id'>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [standard, setStandard] = useState(initial?.standard ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [strand, setStrand] = useState(initial?.strand ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<IndicatorType>(initial?.type ?? 'interim')
  const [keyConcept, setKeyConcept] = useState(initial?.key_concept ?? '')
  const [process, setProcess] = useState(initial?.process ?? '')

  const valid = standard.trim() && code.trim() && description.trim()

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-2.5 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800">{initial ? 'แก้ไขตัวชี้วัด' : 'เพิ่มตัวชี้วัด'}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={standard} onChange={e => setStandard(e.target.value)} placeholder="มาตรฐาน (ค 1.1)"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="รหัส (ป.5/1)"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      <input value={strand} onChange={e => setStrand(e.target.value)} placeholder="สาระ (จำนวนและพีชคณิต)"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />

      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="คำอธิบายตัวชี้วัด..."
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />

      {/* type toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['interim', 'final'] as IndicatorType[]).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`text-sm font-semibold py-2 rounded-lg transition-colors ${
              type === t
                ? t === 'interim' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
                : 'bg-white border border-gray-200 text-gray-500'
            }`}>
            {t === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
          </button>
        ))}
      </div>

      <input value={keyConcept} onChange={e => setKeyConcept(e.target.value)} placeholder="สาระสำคัญ K (ไม่บังคับ)"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      <input value={process} onChange={e => setProcess(e.target.value)} placeholder="กระบวนการ/คำกริยา P เช่น เขียน, แปลง (ไม่บังคับ)"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />

      <button
        onClick={() => onSave({
          subject, standard: standard.trim(), code: code.trim(), strand: strand.trim() || null,
          description: description.trim(), type, key_concept: keyConcept.trim() || null,
          process: process.trim() || null, sequence_order: initial?.sequence_order ?? 0,
        })}
        disabled={!valid || saving}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {saving && <Loader2 size={15} className="animate-spin" />} บันทึกตัวชี้วัด
      </button>
    </motion.div>
  )
}
