'use client'

import { motion } from 'framer-motion'
import { SubjectPacing, PACING_LEVEL_META } from '@/lib/pacing'

export function SubjectStatus({ pacing, index }: { pacing: SubjectPacing; index: number }) {
  const meta = PACING_LEVEL_META[pacing.level]
  const subjectLabel = pacing.subject.replace('_', ' ')

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${meta.ring}`}
    >
      <span className="relative flex h-3 w-3">
        {pacing.level !== 'NoData' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${meta.dot}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">{subjectLabel}</p>
          <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{meta.advice}</p>
      </div>
    </motion.div>
  )
}
