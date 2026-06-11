'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { IndicatorLibraryItem } from '@/lib/types'
import { Loader2, X, Library, ChevronDown, CheckCheck } from 'lucide-react'

export function LibraryPicker({
  existingCodes,
  onAdd,
  onClose,
}: {
  existingCodes: Set<string>
  onAdd: (items: IndicatorLibraryItem[]) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<IndicatorLibraryItem[]>([])
  const [subjects, setSubjects] = useState<{ key: string; label: string }[]>([])
  const [subjectKey, setSubjectKey] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('indicator_library').select('*').order('sequence_order')
      const all = (data ?? []) as IndicatorLibraryItem[]
      setItems(all)
      const subjMap = new Map<string, string>()
      all.forEach(i => subjMap.set(i.subject_key, i.subject_label))
      const subjList = Array.from(subjMap.entries()).map(([key, label]) => ({ key, label }))
      setSubjects(subjList)
      setSubjectKey(subjList[0]?.key ?? '')
      setLoading(false)
    }
    load()
  }, [])

  const visible = items.filter(i => i.subject_key === subjectKey)
  const selectableCodes = visible.filter(i => !existingCodes.has(i.code)).map(i => i.id)
  const allSelected = selectableCodes.length > 0 && selectableCodes.every(id => selected.has(id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) selectableCodes.forEach(id => next.delete(id))
      else selectableCodes.forEach(id => next.add(id))
      return next
    })
  }

  function confirm() {
    setAdding(true)
    onAdd(items.filter(i => selected.has(i.id)))
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Library size={16} className="text-blue-600" /> คลังตัวชี้วัดกลาง
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16 px-6">
            ยังไม่มีข้อมูลในคลัง — รัน <code className="text-xs">supabase-system5-library.sql</code> ก่อน
          </p>
        ) : (
          <>
            <div className="p-4 space-y-3 border-b border-gray-100">
              <div className="relative">
                <select value={subjectKey} onChange={e => setSubjectKey(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {subjects.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <button onClick={toggleAll} className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                <CheckCheck size={13} /> {allSelected ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดที่ยังไม่มี'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {visible.map(ind => {
                const already = existingCodes.has(ind.code)
                const on = selected.has(ind.id)
                return (
                  <button key={ind.id} disabled={already} onClick={() => toggle(ind.id)}
                    className={`w-full text-left flex items-start gap-2 rounded-xl px-3 py-2.5 border transition-colors ${
                      already ? 'border-gray-100 bg-gray-50 opacity-60'
                        : on ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <span className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] ${
                      already ? 'bg-gray-300 border-gray-300 text-white' : on ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                    }`}>{already ? '✓' : on ? '✓' : ''}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-gray-500">{ind.standard} · {ind.code}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${ind.type === 'interim' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                          {ind.type === 'interim' ? 'ระหว่างทาง' : 'ปลายทาง'}
                        </span>
                        {already && <span className="text-[9px] text-gray-400">เพิ่มแล้ว</span>}
                      </span>
                      <span className="block text-xs text-gray-700 leading-snug mt-0.5">{ind.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button onClick={confirm} disabled={selected.size === 0 || adding}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
                {adding ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                เพิ่ม {selected.size} ตัวชี้วัดที่เลือก
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
