'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Student, StudentAssessment } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { average } from '@/lib/analytics'
import { fetchAllPaged, latestAssessmentPerPlan } from '@/lib/db'
import { RoomFilter } from '@/components/room-filter'
import { Loader2, ChevronRight, User, Users2 } from 'lucide-react'

type StudentRow = Student & { avgScore: number; count: number }

export default function StudentsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<StudentRow[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: students }, assessments] = await Promise.all([
        supabase.from('students').select('*').order('name'),
        fetchAllPaged<StudentAssessment>(() => supabase.from('student_assessments').select('*').order('id')),
      ])

      const byStudent = new Map<string, StudentAssessment[]>()
      latestAssessmentPerPlan(assessments).forEach(a => {
        if (!byStudent.has(a.student_id)) byStudent.set(a.student_id, [])
        byStudent.get(a.student_id)!.push(a)
      })

      setRows(
        (students ?? []).map(s => {
          const list = byStudent.get(s.id) ?? []
          return {
            ...s,
            avgScore: average(list.map(a => a.academic_score)),
            count: list.length,
          }
        })
      )
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">รายงานรายบุคคล</h2>
          <p className="text-sm text-gray-500 mt-1">เลือกนักเรียนเพื่อดูจุดแข็ง–จุดอ่อน</p>
        </div>
        <Link href="/admin/students/groups"
          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Users2 size={14} /> จัดกลุ่มตามความสามารถ
        </Link>
      </div>

      {/* เลือกห้อง */}
      <RoomFilter
        rooms={Array.from(new Set(rows.map(r => r.class_name).filter(Boolean))).sort()}
        value={selectedRoom}
        onChange={setSelectedRoom}
      />

      <div className="space-y-2">
        {(selectedRoom ? rows.filter(r => r.class_name === selectedRoom) : rows).map(s => (
          <Link key={s.id} href={`/admin/students/${s.id}`}>
            <Card className="border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
              <CardContent className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.class_name} · ประเมินแล้ว {s.count} ครั้ง</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${
                    s.count === 0 ? 'text-gray-300' :
                    s.avgScore >= 1.5 ? 'text-green-600' :
                    s.avgScore >= 1.0 ? 'text-yellow-600' : 'text-red-500'
                  }`}>
                    {s.count > 0 ? s.avgScore.toFixed(1) : '—'}
                  </span>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูลนักเรียน</p>
        )}
      </div>
    </div>
  )
}
