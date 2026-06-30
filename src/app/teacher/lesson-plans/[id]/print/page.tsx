'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, CurriculumModule, School, Teacher } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { Loader2 } from 'lucide-react'

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr>
      <td className="border border-gray-400 px-2 py-1 font-semibold text-sm w-1/4 align-top bg-gray-50">{label}</td>
      <td className="border border-gray-400 px-2 py-1 text-sm whitespace-pre-line">{value ?? ''}</td>
    </tr>
  )
}

function SectionHeader({ no, title }: { no: number; title: string }) {
  return (
    <tr>
      <td colSpan={2} className="border border-gray-400 px-2 py-1.5 font-bold text-sm bg-gray-100">
        {no}. {title}
      </td>
    </tr>
  )
}

export default function LessonPlanPrintPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const schoolId = getSchoolId()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [mod, setMod] = useState<CurriculumModule | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: sc }] = await Promise.all([
        supabase.from('lesson_plans').select('*').eq('id', id).single(),
        supabase.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      ])
      if (!p) { setLoading(false); return }
      const plan = p as LessonPlan
      setPlan(plan)
      setSchool(sc as School)
      if (plan.module_id) {
        const { data: m } = await supabase.from('curriculum_modules').select('*').eq('id', plan.module_id).single()
        if (m) setMod(m as CurriculumModule)
      }
      if (plan.teacher_id) {
        const { data: t } = await supabase.from('teachers').select('*').eq('id', plan.teacher_id).single()
        if (t) setTeacher(t as Teacher)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )
  if (!plan) return <div className="text-center py-16 text-gray-400">ไม่พบแผนการสอน</div>

  const teachDate = plan.teach_date
    ? new Date(plan.teach_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : '..............................'

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; size: A4; }
        }
        body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button onClick={() => window.print()}
          className="bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-violet-700">
          พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 text-gray-900">
        {/* Title */}
        <div className="text-center mb-4">
          <p className="text-lg font-bold">แผนการจัดการเรียนรู้</p>
          <p className="text-base font-semibold mt-0.5">
            แผนการเรียนรู้ที่ {plan.plan_number} เรื่อง {plan.topic}
          </p>
        </div>

        {/* Meta table */}
        <table className="w-full border-collapse mb-4 text-sm">
          <tbody>
            <tr>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">รายวิชา</td>
              <td className="border border-gray-400 px-2 py-1 w-1/4">{plan.subject ?? ''}</td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50 w-1/4">ชั้น</td>
              <td className="border border-gray-400 px-2 py-1 w-1/4">{plan.grade ?? ''}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">ครูผู้สอน</td>
              <td className="border border-gray-400 px-2 py-1">{teacher?.name ?? '..............................'}</td>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">วันที่สอน</td>
              <td className="border border-gray-400 px-2 py-1">{teachDate}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 font-semibold bg-gray-50">หน่วยการเรียนรู้</td>
              <td className="border border-gray-400 px-2 py-1" colSpan={3}>
                {mod ? `${mod.module_code} — ${mod.title}` : '..............................'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Main plan table */}
        <table className="w-full border-collapse text-sm">
          <tbody>
            <SectionHeader no={1} title="มาตรฐานการเรียนรู้" />
            <Row label="1.1 ตัวชี้วัดระหว่างทาง" value={plan.indicators_interim} />
            <Row label="1.2 ตัวชี้วัดปลายทาง" value={plan.indicators_final} />

            <SectionHeader no={2} title="จุดประสงค์การเรียนรู้" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {[plan.objectives_k, plan.objectives_p, plan.objectives_a].filter(Boolean).join('\n')}
              </td>
            </tr>

            <SectionHeader no={3} title="สาระสำคัญ" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {plan.key_content ?? ''}
              </td>
            </tr>

            <SectionHeader no={4} title="สมรรถนะสำคัญของผู้เรียน" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {plan.competencies ?? ''}
              </td>
            </tr>

            <SectionHeader no={5} title="คุณลักษณะอันพึงประสงค์" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {plan.desired_traits ?? ''}
              </td>
            </tr>

            <SectionHeader no={6} title="กิจกรรมการเรียนรู้" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-2 text-sm whitespace-pre-line leading-relaxed">
                {plan.activities ?? ''}
              </td>
            </tr>

            <SectionHeader no={7} title="การวัดและประเมินผล" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {plan.assessment ?? ''}
              </td>
            </tr>

            <SectionHeader no={8} title="สื่อ / แหล่งการเรียนรู้" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-1.5 text-sm whitespace-pre-line">
                {plan.materials ?? ''}
              </td>
            </tr>

            <SectionHeader no={9} title="บันทึกหลังการจัดการเรียนรู้" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-8 text-sm text-gray-300">
                {plan.post_lesson_note || '................................................................................................................'}
              </td>
            </tr>

            <SectionHeader no={10} title="ข้อเสนอแนะ" />
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-8 text-sm text-gray-300">
                {plan.suggestion || '................................................................................................................'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signature block */}
        <div className="mt-8 flex justify-around text-center text-sm">
          <div>
            <p className="mb-6">ลงชื่อ ................................................</p>
            <p>( {teacher?.name ?? '......................................'} )</p>
            <p className="text-gray-500">ครูผู้สอน</p>
          </div>
          <div>
            <p className="mb-6">ลงชื่อ ................................................</p>
            <p>( {school?.director_name ?? '......................................'} )</p>
            <p className="text-gray-500">ผู้อำนวยการ{school?.name ? school.name : 'โรงเรียน'}</p>
          </div>
        </div>
      </div>
    </>
  )
}
