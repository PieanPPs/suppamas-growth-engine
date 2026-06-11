'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function WeekSelector({
  totalWeeks,
  currentWeek,
  selectedWeek,
  onSelect,
}: {
  totalWeeks: number
  currentWeek: number
  selectedWeek: number
  onSelect: (week: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // center the selected pill when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedWeek])

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const canPrev = selectedWeek > 1
  const canNext = selectedWeek < totalWeeks

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => canPrev && onSelect(selectedWeek - 1)}
        disabled={!canPrev}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50"
      >
        <ChevronLeft size={16} />
      </button>

      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 flex-1">
        {weeks.map(w => {
          const isSelected = w === selectedWeek
          const isCurrent = w === currentWeek
          return (
            <button
              key={w}
              ref={isSelected ? activeRef : undefined}
              onClick={() => onSelect(w)}
              className={`flex-shrink-0 min-w-[44px] px-2 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                isSelected
                  ? 'bg-blue-600 text-white shadow'
                  : isCurrent
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {w}
              {isCurrent && !isSelected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => canNext && onSelect(selectedWeek + 1)}
        disabled={!canNext}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-50"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
