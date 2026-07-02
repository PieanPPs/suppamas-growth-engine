'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { parseExamText } from '@/lib/exam-import'
import { X, ClipboardPaste, Loader2, AlertTriangle, FileText } from 'lucide-react'

export function ImportItems({
  existingCount,
  onImport,
  onClose,
}: {
  existingCount: number
  onImport: (items: ReturnType<typeof parseExamText>['items']) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const { items, warnings } = useMemo(() => parseExamText(text), [text])

  async function apply() {
    setSaving(true)
    await onImport(items)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <ClipboardPaste size={16} className="text-blue-600" /> นำเข้าข้อสอบ (วางจากเว็บ AI)
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {existingCount > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              ⚠️ ข้อสอบนี้มีอยู่ {existingCount} ข้อ — การนำเข้าใหม่จะ<strong>แทนที่ทั้งหมด</strong>
            </p>
          )}
          <p className="text-xs text-gray-500">
            วางคำตอบทั้งหมดจากเว็บ AI ที่ใช้พรอมต์ของเรา (หรือข้อสอบเก่าที่ขอให้ AI ช่วยแปลงเป็นฟอร์แมตเดียวกัน)
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={9}
            placeholder={'ข้อ: 1\nตัวชี้วัด: ป.5/3\nคำถาม: ...\nก: ...\nข: ...\nค: ...\nง: ...\nเฉลย: ข\n---'}
            className="w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                <FileText size={13} /> อ่านได้ {items.length} ข้อ
              </p>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {items.map(it => (
                  <div key={it.item_no} className="flex items-start gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="font-bold text-gray-500 flex-shrink-0">{it.item_no}.</span>
                    <span className="text-gray-700 flex-1 truncate">{it.question}</span>
                    {it.indicator_code && <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1 rounded flex-shrink-0">{it.indicator_code}</span>}
                    <span className={`text-[10px] font-bold flex-shrink-0 max-w-[30%] truncate ${it.answer ? 'text-green-600' : 'text-red-500'}`}>
                      {it.answer ? `เฉลย ${it.answer}` : 'ไม่มีเฉลย'}
                    </span>
                  </div>
                ))}
              </div>
              {warnings.length > 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5 flex items-start gap-1">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> {warnings.join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={apply} disabled={items.length === 0 || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ClipboardPaste size={15} />}
            นำเข้า {items.length} ข้อ
          </button>
        </div>
      </motion.div>
    </div>
  )
}
