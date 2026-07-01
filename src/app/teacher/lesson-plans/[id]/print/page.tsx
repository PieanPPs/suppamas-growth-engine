'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LessonPlan, CurriculumModule, School, Teacher } from '@/lib/types'
import { getSchoolId } from '@/lib/school'
import { loadDocxLib, fetchLogoForDocx, buildLessonPlanBlock } from '@/lib/lesson-plan-docx'
import { Loader2, FileText, Printer } from 'lucide-react'

function Section({ no, title, body }: { no: number; title: string; body?: string | null }) {
  return (
    <div className="mt-3">
      <p className="font-bold text-[16px]">{no}. {title}</p>
      <p className="text-[16px] whitespace-pre-line">{body || ' '}</p>
    </div>
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
  const [exporting, setExporting] = useState(false)

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

  const logoUrl = school?.logo_path
    ? supabase.storage.from('school-assets').getPublicUrl(school.logo_path).data.publicUrl
    : null

  async function exportWord() {
    if (!plan || exporting) return
    setExporting(true)
    try {
      const docx = await loadDocxLib()
      const { Document, Packer, convertInchesToTwip } = docx
      const logo = logoUrl ? await fetchLogoForDocx(logoUrl) : null

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.18),
              },
            },
          },
          children: buildLessonPlanBlock(docx, {
            plan,
            moduleTitle: mod?.title ?? null,
            teacherName: teacher?.name ?? null,
            schoolName: school?.name ?? 'โรงเรียน',
            directorName: school?.director_name ?? null,
            logo,
          }),
        }],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `แผนที่${plan.plan_number} ${plan.topic}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="animate-spin text-violet-500" size={32} />
    </div>
  )
  if (!plan) return <div className="text-center py-16 text-gray-400">ไม่พบแผนการสอน</div>

  const teachDate = plan.teach_dates?.length
    ? plan.teach_dates.map(d => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })).join(', ')
    : '..............................'

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      {/* Action buttons */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button onClick={exportWord} disabled={exporting}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md">
          <FileText size={15} /> {exporting ? 'กำลังสร้าง...' : 'Export Word'}
        </button>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md">
          <Printer size={15} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 text-gray-900 font-sarabun">
        {/* Logo + title */}
        {logoUrl && (
          <div className="flex justify-center mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="โลโก้โรงเรียน" className="h-16 w-auto object-contain" />
          </div>
        )}
        <p className="text-center text-[16px] font-bold">{school?.name ?? 'โรงเรียน'}</p>
        <p className="text-center text-[18px] font-bold mt-1">แผนการจัดการเรียนรู้</p>
        <p className="text-center text-[16px] font-bold mt-0.5">
          แผนการเรียนรู้ที่ {plan.plan_number}&nbsp;&nbsp;&nbsp;&nbsp;เรื่อง {plan.topic}
        </p>

        {/* Meta lines */}
        <p className="text-[16px] mt-3">
          รายวิชา&nbsp;&nbsp;&nbsp;&nbsp;{plan.subject ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;ชั้น&nbsp;&nbsp;&nbsp;&nbsp;{plan.grade ?? ''}
        </p>
        <p className="text-[16px]">
          หน่วยการเรียนรู้&nbsp;&nbsp;&nbsp;&nbsp;{mod ? mod.title : '..............................'}
        </p>
        <p className="text-[16px] pb-1.5 border-b border-gray-800">
          ครูผู้สอน&nbsp;&nbsp;&nbsp;&nbsp;{teacher?.name ?? '..............................'}&nbsp;&nbsp;&nbsp;&nbsp;วันที่สอน&nbsp;&nbsp;&nbsp;&nbsp;{teachDate}
        </p>

        {/* Sections */}
        <Section no={1} title="มาตรฐานการเรียนรู้" body={
          [
            plan.indicators_interim ? `1.1 ตัวชี้วัดระหว่างทาง\n${plan.indicators_interim}` : null,
            plan.indicators_final ? `1.2 ตัวชี้วัดปลายทาง\n${plan.indicators_final}` : null,
          ].filter(Boolean).join('\n\n')
        } />
        <Section no={2} title="จุดประสงค์การเรียนรู้" body={[plan.objectives_k, plan.objectives_p, plan.objectives_a].filter(Boolean).join('\n')} />
        <Section no={3} title="สาระสำคัญ" body={plan.key_content} />
        <Section no={4} title="สมรรถนะสำคัญของผู้เรียน" body={plan.competencies} />
        <Section no={5} title="คุณลักษณะอันพึงประสงค์" body={plan.desired_traits} />
        <Section no={6} title="กิจกรรมการเรียนรู้" body={plan.activities} />
        <Section no={7} title="การวัดและประเมินผล" body={plan.assessment} />
        <Section no={8} title="สื่อ / แหล่งการเรียนรู้" body={plan.materials} />
        <Section no={9} title="บันทึกหลังการจัดการเรียนรู้" body={plan.post_lesson_note} />
        <Section no={10} title="ข้อเสนอแนะ" body={plan.suggestion} />

        {/* Signature block */}
        <div className="mt-10 flex justify-around text-center text-[16px]">
          <div>
            <p className="mb-6">ลงชื่อ ................................................</p>
            <p>( {teacher?.name ?? '......................................'} )</p>
            <p className="text-[14px] text-gray-500">ครูผู้สอน</p>
          </div>
          <div>
            <p className="mb-6">ลงชื่อ ................................................</p>
            <p>( {school?.director_name ?? '......................................'} )</p>
            <p className="text-[14px] text-gray-500">ผู้อำนวยการ{school?.name ?? 'โรงเรียน'}</p>
          </div>
        </div>
      </div>
    </>
  )
}
