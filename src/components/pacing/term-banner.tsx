'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AcademicSettings } from '@/lib/types'
import { currentAcademicWeek } from '@/lib/pacing'
import { CalendarDays, Pencil, Check, X } from 'lucide-react'
import { getSchoolId } from '@/lib/school'

export function TermBanner({
  settings,
  onUpdate,
}: {
  settings: AcademicSettings
  onUpdate: (s: AcademicSettings) => void
}) {
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(settings.term_start_date)
  const [saving, setSaving] = useState(false)

  const week = currentAcademicWeek(settings.term_start_date)
  const pct = Math.min(100, Math.round((week / settings.total_weeks) * 100))

  async function save() {
    setSaving(true)
    await supabase
      .from('academic_settings')
      .upsert({ school_id: schoolId, term_name: settings.term_name, term_start_date: date, total_weeks: settings.total_weeks }, { onConflict: 'school_id' })
    onUpdate({ ...settings, term_start_date: date })
    setSaving(false)
    setEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white px-5 py-5 shadow-lg"
    >
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute -right-2 top-10 w-20 h-20 rounded-full bg-white/10" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium opacity-90">
            <CalendarDays size={14} />
            {settings.term_name}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 px-2 py-1 rounded-lg transition-colors"
            >
              <Pencil size={11} /> ตั้งวันเปิดเทอม
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-white/95 text-gray-800 text-sm rounded-lg px-3 py-1.5 outline-none"
            />
            <button onClick={save} disabled={saving} className="bg-green-400 hover:bg-green-500 rounded-lg p-1.5 transition-colors">
              <Check size={16} />
            </button>
            <button onClick={() => { setEditing(false); setDate(settings.term_start_date) }} className="bg-white/20 hover:bg-white/30 rounded-lg p-1.5 transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-baseline gap-2">
            <motion.span
              key={week}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="text-4xl font-extrabold"
            >
              สัปดาห์ที่ {week > 0 ? week : '—'}
            </motion.span>
            <span className="text-sm opacity-80">/ {settings.total_weeks}</span>
          </div>
        )}

        {/* progress */}
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        {week === 0 && (
          <p className="text-xs opacity-80 mt-2">⏳ ยังไม่ถึงวันเปิดเทอม — กดตั้งวันเปิดเทอมให้ตรงกับปฏิทินจริง</p>
        )}
      </div>
    </motion.div>
  )
}
