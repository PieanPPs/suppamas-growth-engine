'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { IndicatorType } from '@/lib/types'
import { X, ClipboardPaste, Loader2, TableProperties } from 'lucide-react'

export interface ParsedIndicator {
  standard: string
  code: string
  description: string
  type: IndicatorType
  key_concept: string | null
  process: string | null
}

function parse(text: string): ParsedIndicator[] {
  const rows: ParsedIndicator[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    // pipe (จากพรอมต์ AI) → tab (จาก Excel/Sheets) → comma
    const cols = (
      line.includes('|') ? line.split('|')
      : line.includes('\t') ? line.split('\t')
      : line.split(',')
    ).map(c => c.trim())
    // skip header row
    if (/มาตรฐาน|รหัส|standard|code/i.test(cols[0]) && /รหัส|คำอธิบาย|code|desc/i.test(cols[1] ?? '')) continue
    const [standard, code, description, typeRaw, key_concept, process] = cols
    if (!standard || !code || !description) continue
    const type: IndicatorType = /ปลาย|final/i.test(typeRaw ?? '') ? 'final' : 'interim'
    rows.push({
      standard, code, description, type,
      key_concept: key_concept?.trim() || null,
      process: process?.trim() || null,
    })
  }
  return rows
}

export function ImportPaste({
  onImport,
  onClose,
}: {
  onImport: (rows: ParsedIndicator[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const parsed = parse(text)

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <ClipboardPaste size={16} className="text-indigo-600" /> วางตารางจาก Excel / Sheets
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-700">
            <p className="font-semibold mb-1 flex items-center gap-1"><TableProperties size={12} /> รูปแบบคอลัมน์ (จาก Excel หรือผลลัพธ์พรอมต์ AI)</p>
            <p className="font-mono text-[11px] leading-relaxed">มาตรฐาน · รหัส · คำอธิบาย · ประเภท · K · P</p>
            <p className="mt-1 text-[11px]">คั่นด้วย Tab (Excel) หรือ | (จาก AI) · ประเภท = "ระหว่างทาง" หรือ "ปลายทาง"</p>
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            placeholder={'ค 1.1\tป.5/1\tเขียนเศษส่วน...\tระหว่างทาง\tความสัมพันธ์...\tเขียน, แปลง\nค 1.1\tป.5/2\tแสดงวิธี...\tปลายทาง\t...\t...'}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />

          {parsed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">ตัวอย่างที่อ่านได้ ({parsed.length} ตัวชี้วัด)</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {parsed.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-mono text-gray-500">{r.standard} · {r.code}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${r.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {r.type === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => { setImporting(true); onImport(parsed) }}
            disabled={parsed.length === 0 || importing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <ClipboardPaste size={15} />}
            นำเข้า {parsed.length} ตัวชี้วัด
          </button>
        </div>
      </motion.div>
    </div>
  )
}
