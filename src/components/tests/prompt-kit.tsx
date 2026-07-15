'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { buildExamPrompt, EXAM_QTYPES, EXAM_STYLES, ExamQType } from '@/lib/exam-import'
import { X, Copy, Check, Wand2 } from 'lucide-react'

type IndicatorInput = { code: string; description: string; standard?: string; type?: 'interim' | 'final' }
type DistMode = 'equal' | 'final' | 'interim' | 'custom'

const DIST_MODES: { key: DistMode; label: string; desc: string }[] = [
  { key: 'equal', label: 'เท่ากันทุกตัว', desc: 'แบ่งจำนวนข้อเท่า ๆ กันทุกตัวชี้วัด' },
  { key: 'final', label: 'เน้นปลายทาง', desc: 'ตัวชี้วัดปลายทางได้จำนวนข้อมากกว่าระหว่างทาง' },
  { key: 'interim', label: 'เน้นระหว่างทาง', desc: 'ตัวชี้วัดระหว่างทางได้จำนวนข้อมากกว่าปลายทาง' },
  { key: 'custom', label: 'กำหนดเอง', desc: 'ตั้งน้ำหนักของแต่ละตัวชี้วัดเอง' },
]

/** largest-remainder split, mirrors src/lib/exam-import.ts's distributeCounts so the live
 * preview here matches exactly what the prompt itself will instruct the AI to do. */
function distributeCounts(weights: number[], total: number): number[] {
  const safe = weights.map(w => Math.max(0, w))
  const sum = safe.reduce((a, b) => a + b, 0)
  if (safe.length === 0 || sum <= 0) return safe.map(() => 0)
  const raw = safe.map(w => (w / sum) * total)
  const counts = raw.map(Math.floor)
  let remaining = total - counts.reduce((a, b) => a + b, 0)
  const byFraction = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remaining && k < byFraction.length; k++) counts[byFraction[k].i]++
  return counts
}

export function PromptKit({
  subjectName,
  grade,
  topic,
  indicators,
  onClose,
}: {
  subjectName: string
  grade?: string | null
  topic?: string | null
  indicators: IndicatorInput[]
  onClose: () => void
}) {
  const [count, setCount] = useState(30)
  const [qtype, setQtype] = useState<ExamQType>('mc4')
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())
  const [distMode, setDistMode] = useState<DistMode>('equal')
  const [customWeights, setCustomWeights] = useState<Record<number, number>>({})
  const [copied, setCopied] = useState(false)

  const weights = useMemo(() => indicators.map((ind, idx) => {
    if (distMode === 'final') return ind.type === 'final' ? 2 : 1
    if (distMode === 'interim') return ind.type === 'interim' ? 2 : 1
    if (distMode === 'custom') return Math.max(0, customWeights[idx] ?? 1)
    return 1
  }), [indicators, distMode, customWeights])

  const perIndicatorCounts = useMemo(() => distributeCounts(weights, count), [weights, count])

  const weightedIndicators = useMemo(
    () => indicators.map((ind, idx) => ({ ...ind, weight: weights[idx] })),
    [indicators, weights]
  )

  const prompt = useMemo(
    () => buildExamPrompt({
      subjectName, grade, topic, count, indicators: weightedIndicators, qtype,
      styles: EXAM_STYLES.filter(s => selectedStyles.has(s.key)).map(s => s.text),
    }),
    [subjectName, grade, topic, count, weightedIndicators, qtype, selectedStyles]
  )

  function toggleStyle(key: string) {
    setSelectedStyles(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Wand2 size={16} className="text-violet-600" /> พรอมต์สร้างข้อสอบ (ใช้กับเว็บ AI ฟรี)
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 text-xs text-violet-700 leading-relaxed">
            <strong>3 ขั้นตอน:</strong> ① คัดลอกพรอมต์นี้ → ② วางใน ChatGPT / Gemini / Claude แล้วรอคำตอบ
            → ③ คัดลอกคำตอบทั้งหมดกลับมาวางที่ปุ่ม &quot;นำเข้าข้อสอบ&quot;
          </div>

          {/* ประเภทข้อสอบ */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">รูปแบบข้อสอบ</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EXAM_QTYPES.map(t => (
                <button key={t.key} type="button" onClick={() => setQtype(t.key)}
                  className={`text-left rounded-xl border px-2.5 py-2 transition-colors ${qtype === t.key ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className={`block text-xs font-semibold ${qtype === t.key ? 'text-violet-700' : 'text-gray-700'}`}>{t.label}</span>
                  <span className="block text-[10px] text-gray-400 leading-snug">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* สไตล์โจทย์ */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600">สไตล์โจทย์ <span className="text-gray-400 font-normal">(เลือกได้หลายแบบ — เพิ่มความหลากหลาย)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {EXAM_STYLES.map(s => (
                <button key={s.key} type="button" onClick={() => toggleStyle(s.key)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${selectedStyles.has(s.key) ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {selectedStyles.has(s.key) ? '✓ ' : ''}{s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-500">
            จำนวนข้อ
            <input type="number" min={1} max={100} value={count}
              onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 text-sm text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
            ข้อ · อิงตัวชี้วัด {indicators.length} ตัวที่ผูกกับข้อสอบนี้
          </label>
          {indicators.length === 0 && (
            <p className="text-xs text-amber-600">⚠️ ข้อสอบนี้ยังไม่ได้ติ๊กตัวชี้วัด — พรอมต์จะระบุแค่ชื่อวิชา (แม่นน้อยลง)</p>
          )}

          {indicators.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600">การกระจายจำนวนข้อต่อตัวชี้วัด</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DIST_MODES.map(m => (
                  <button key={m.key} type="button" onClick={() => setDistMode(m.key)}
                    className={`text-left rounded-xl border px-2.5 py-1.5 transition-colors ${distMode === m.key ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`block text-[11px] font-semibold ${distMode === m.key ? 'text-violet-700' : 'text-gray-700'}`}>{m.label}</span>
                    <span className="block text-[9.5px] text-gray-400 leading-snug">{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* พรีวิวจำนวนข้อจริงต่อตัวชี้วัด — ให้ครูเห็นผลลัพธ์ก่อนคัดลอกพรอมต์ */}
              <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/60">
                {indicators.map((ind, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ind.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {ind.type === 'interim' ? 'ระหว่างทาง' : ind.type === 'final' ? 'ปลายทาง' : '-'}
                    </span>
                    <span className="font-mono text-gray-500 flex-shrink-0">{ind.standard ? `${ind.standard} · ` : ''}{ind.code}</span>
                    {distMode === 'custom' ? (
                      <input type="number" min={0} max={count} value={customWeights[idx] ?? 1}
                        onChange={e => setCustomWeights(prev => ({ ...prev, [idx]: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-14 text-center border border-gray-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    ) : (
                      <span className="ml-auto font-bold text-violet-600 flex-shrink-0">{perIndicatorCounts[idx]} ข้อ</span>
                    )}
                    {distMode === 'custom' && (
                      <span className="ml-auto font-bold text-violet-600 flex-shrink-0">{perIndicatorCounts[idx]} ข้อ</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <textarea
            readOnly
            value={prompt}
            rows={10}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
          />
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={copy}
            className={`w-full text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${copied ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {copied ? <><Check size={15} /> คัดลอกแล้ว — ไปวางในเว็บ AI ได้เลย</> : <><Copy size={15} /> คัดลอกพรอมต์</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
