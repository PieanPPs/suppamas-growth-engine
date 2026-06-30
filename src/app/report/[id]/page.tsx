'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Student, StudentAssessment, CurriculumModule, HomeworkSubmission, HomeworkTask, HomeworkStatus } from '@/lib/types'
import { StudentRadar } from '@/components/student-radar'
import {
  buildStudentTagScores, buildFocusBreakdown, average, happinessMessage,
  TagScore, FocusBreakdown,
} from '@/lib/analytics'
import { Loader2, Star, Heart, ClipboardList, CheckCircle2, Clock, XCircle, CircleDashed } from 'lucide-react'

type QuestItem = { title: string; status: HomeworkStatus | null }

export default function HappinessReportPage() {
  const params = useParams()
  const studentId = params.id as string
  const supabase = createClient()

  const [student, setStudent] = useState<Student | null>(null)
  const [tagScores, setTagScores] = useState<TagScore[]>([])
  const [focus, setFocus] = useState<FocusBreakdown>({ green: 0, yellow: 0, red: 0, total: 0 })
  const [avgAcademic, setAvgAcademic] = useState(0)
  const [avgSoft, setAvgSoft] = useState(0)
  const [homework, setHomework] = useState({ onTime: 0, late: 0, missing: 0 })
  const [quests, setQuests] = useState<QuestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: modules }, { data: assessments }, { data: hw }, { data: tasks }] = await Promise.all([
        supabase.from('students').select('*').eq('id', studentId).single(),
        supabase.from('curriculum_modules').select('*'),
        supabase.from('student_assessments').select('*').eq('student_id', studentId),
        supabase.from('homework_submissions').select('*').eq('student_id', studentId),
        supabase.from('homework_tasks').select('*'),
      ])

      if (!s) { setNotFound(true); setLoading(false); return }

      setStudent(s)
      const moduleMap = new Map<string, CurriculumModule>((modules ?? []).map(m => [m.id, m]))
      const list = (assessments ?? []) as StudentAssessment[]
      const hwList = (hw ?? []) as HomeworkSubmission[]

      setTagScores(buildStudentTagScores(list, moduleMap))
      setFocus(buildFocusBreakdown(list))
      setAvgAcademic(average(list.map(a => a.academic_score)))
      setAvgSoft(average(list.map(a => a.soft_skill_score)))
      setHomework({
        onTime: hwList.filter(h => h.status === 'On_Time').length,
        late: hwList.filter(h => h.status === 'Late').length,
        missing: hwList.filter(h => h.status === 'Missing').length,
      })

      // Digital Quest Board: tasks (latest 4) + this child's status
      const statusByModule = new Map<string, HomeworkStatus>(hwList.map(h => [h.module_id, h.status]))
      const questList: QuestItem[] = ((tasks ?? []) as HomeworkTask[])
        .slice(-4)
        .map(t => ({ title: t.title, status: statusByModule.get(t.module_id) ?? null }))
      setQuests(questList)

      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-green-500" size={32} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p>ไม่พบรายงานของนักเรียนคนนี้</p>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="max-w-md mx-auto space-y-5 py-4">
      {/* Header */}
      <div className="text-center bg-gradient-to-b from-green-500 to-green-600 rounded-3xl px-6 py-8 text-white shadow-lg">
        <Heart size={28} className="mx-auto mb-2 fill-white" />
        <p className="text-xs opacity-90">รายงานความสุขประจำสัปดาห์</p>
        <h1 className="text-2xl font-bold mt-1">{student?.name}</h1>
        <p className="text-sm opacity-90 mt-0.5">{student?.class_name} · โรงเรียนอนุสรณ์ศุภมาศ</p>
        <p className="text-xs opacity-75 mt-2">{today}</p>
      </div>

      {/* Encouragement message */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-center">
        <p className="text-sm text-amber-800 font-medium leading-relaxed">
          {happinessMessage(avgAcademic, focus.total)}
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star size={18} className="fill-yellow-400 text-yellow-400" />
            <span className="text-3xl font-bold text-gray-900">{avgAcademic.toFixed(1)}</span>
          </div>
          <p className="text-xs text-gray-500">การเรียนรู้ (เต็ม 2)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star size={18} className="fill-blue-400 text-blue-400" />
            <span className="text-3xl font-bold text-gray-900">{avgSoft.toFixed(1)}</span>
          </div>
          <p className="text-xs text-gray-500">ทักษะสังคม (เต็ม 2)</p>
        </div>
      </div>

      {/* Radar — strengths */}
      <div className="bg-white border border-gray-200 rounded-2xl px-3 py-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 text-center mb-2">
          จุดเด่นในการเรียนรู้ของลูก
        </h2>
        <StudentRadar data={tagScores} color="#22c55e" />
      </div>

      {/* Focus */}
      {focus.total > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">สมาธิและความตั้งใจ</h2>
          <div className="flex h-3 rounded-full overflow-hidden mb-2">
            <div className="bg-green-500" style={{ width: `${(focus.green / focus.total) * 100}%` }} />
            <div className="bg-yellow-400" style={{ width: `${(focus.yellow / focus.total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(focus.red / focus.total) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>🟢 ตั้งใจดี {focus.green}</span>
            <span>🟡 พอใช้ {focus.yellow}</span>
            <span>🔴 ต้องดูแล {focus.red}</span>
          </div>
        </div>
      )}

      {/* Digital Quest Board */}
      {quests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <ClipboardList size={15} className="text-amber-500" /> ภารกิจประจำสัปดาห์
          </h2>
          <div className="space-y-2">
            {quests.map((q, i) => {
              const meta = q.status === 'On_Time' ? { c: 'text-green-600', icon: <CheckCircle2 size={15} />, t: 'ส่งแล้ว' }
                : q.status === 'Late' ? { c: 'text-yellow-600', icon: <Clock size={15} />, t: 'ส่งช้า' }
                : q.status === 'Missing' ? { c: 'text-red-500', icon: <XCircle size={15} />, t: 'ยังไม่ส่ง' }
                : { c: 'text-gray-300', icon: <CircleDashed size={15} />, t: 'รอส่ง' }
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={meta.c}>{meta.icon}</span>
                  <p className="text-sm text-gray-700 flex-1">{q.title}</p>
                  <span className={`text-xs font-medium ${meta.c}`}>{meta.t}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Homework discipline */}
      {(homework.onTime + homework.late + homework.missing) > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">วินัยการส่งภาระงาน/ชิ้นงาน</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-green-600">{homework.onTime}</p>
              <p className="text-xs text-gray-500">ตรงเวลา</p>
            </div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{homework.late}</p>
              <p className="text-xs text-gray-500">ส่งช้า</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-500">{homework.missing}</p>
              <p className="text-xs text-gray-500">ไม่ส่ง</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pt-2 pb-6">
        🌱 Suppamas Growth Engine<br />
        ด้วยความห่วงใยจากคุณครูทุกท่าน
      </p>
    </div>
  )
}
