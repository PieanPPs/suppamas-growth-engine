'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
} from 'recharts'
import { TagScore } from '@/lib/analytics'

export function StudentRadar({
  data,
  color = '#3b82f6',
  compare,
  label = 'รายคาบ',
  compareLabel = 'สอบจริง',
  compareColor = '#9333ea',
}: {
  data: TagScore[]
  color?: string
  /** optional second series on the same 0-2 axis (e.g. summative test results) */
  compare?: TagScore[]
  label?: string
  compareLabel?: string
  compareColor?: string
}) {
  const hasCompare = !!compare && compare.length > 0

  // merge both series by tag (union of axes)
  const tags = Array.from(new Set([
    ...data.map(d => d.tag),
    ...(compare ?? []).map(d => d.tag),
  ])).sort()
  const merged = tags.map(tag => ({
    tag,
    primary: data.find(d => d.tag === tag)?.avgScore ?? null,
    secondary: compare?.find(d => d.tag === tag)?.avgScore ?? null,
  }))

  if (merged.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-400">
        ยังไม่มีข้อมูลคะแนนเพียงพอสำหรับสร้างกราฟ
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={merged} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11, fill: '#6b7280' }} />
          <PolarRadiusAxis domain={[0, 2]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickCount={3} />
          <Radar
            name={label}
            dataKey="primary"
            stroke={color}
            fill={color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
          {hasCompare && (
            <Radar
              name={compareLabel}
              dataKey="secondary"
              stroke={compareColor}
              fill={compareColor}
              fillOpacity={0.15}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          )}
          {hasCompare && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 text-center">
        คะแนนเต็ม = 2.0 ต่อมาตรฐาน{hasCompare ? ' · สอบจริงเทียบสเกลเดียวกัน (% × 2)' : ''}
      </p>
    </div>
  )
}
