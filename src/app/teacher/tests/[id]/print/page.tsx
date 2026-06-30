'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Test, TestItem, Course } from '@/lib/types'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  quiz: 'สอบเก็บคะแนน', midterm: 'สอบกลางภาค', final: 'สอบปลายภาค', mock_nt: 'ข้อสอบ Pre-NT',
}

export default function PrintExamPage() {
  const params = useParams()
  const testId = params.id as string
  const supabase = createClient()
  const [test, setTest] = useState<Test | null>(null)
  const [items, setItems] = useState<TestItem[]>([])
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: it }] = await Promise.all([
        supabase.from('tests').select('*').eq('id', testId).single(),
        supabase.from('test_items').select('*').eq('test_id', testId).order('item_no'),
      ])
      setTest(t)
      setItems(it ?? [])
      if (t) {
        const { data: c } = await supabase.from('courses').select('*').eq('subject_key', t.subject).single()
        setCourse(c)
      }
      setLoading(false)
    }
    load()
  }, [testId])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
  }
  if (!test) {
    return <p className="text-center py-24 text-gray-400">ไม่พบแบบทดสอบ</p>
  }

  // answer key grouped by indicator
  const byIndicator = new Map<string, TestItem[]>()
  items.forEach(it => {
    const key = it.indicator_code ?? 'ไม่ระบุตัวชี้วัด'
    if (!byIndicator.has(key)) byIndicator.set(key, [])
    byIndicator.get(key)!.push(it)
  })

  return (
    <div className="max-w-[210mm] mx-auto font-sarabun">
      <div className="print:hidden flex items-center justify-between mb-4">
        <Link href="/teacher/tests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> แบบทดสอบ
        </Link>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
          <Printer size={14} /> พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 print:border-0 rounded-2xl print:rounded-none px-8 py-8 print:px-0 print:py-0">
        {/* ===== exam header ===== */}
        <header className="text-center border-b-2 border-gray-800 pb-3">
          <p className="text-sm font-bold text-gray-900">โรงเรียนอนุสรณ์ศุภมาศ</p>
          <p className="text-[13px] text-gray-800 mt-0.5">{TYPE_LABEL[test.type] ?? 'แบบทดสอบ'} · {course?.name ?? test.subject}</p>
          <p className="text-[13px] font-semibold text-gray-900 mt-0.5">{test.title}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            จำนวน {items.length} ข้อ · คะแนนเต็ม {test.max_score} คะแนน{test.test_date ? ` · วันที่สอบ ${test.test_date}` : ''}
          </p>
        </header>

        <div className="flex justify-between text-[12px] text-gray-700 mt-3 mb-4">
          <span>ชื่อ-สกุล ........................................................</span>
          <span>ชั้น ..............</span>
          <span>เลขที่ ..............</span>
        </div>
        <p className="text-[11px] text-gray-600 mb-4">คำชี้แจง: ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วกากบาท (✗) ลงในกระดาษคำตอบ</p>

        {/* ===== questions ===== */}
        <ol className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="text-[12px] text-gray-900 break-inside-avoid">
              <p className="font-medium">{it.item_no}. {it.question}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1 pl-5 text-gray-800">
                {it.choice_a != null && <p>ก. {it.choice_a}</p>}
                {it.choice_b != null && <p>ข. {it.choice_b}</p>}
                {it.choice_c != null && <p>ค. {it.choice_c}</p>}
                {it.choice_d != null && <p>ง. {it.choice_d}</p>}
              </div>
            </li>
          ))}
        </ol>

        {/* ===== answer key (new page) ===== */}
        <section className="break-before-page mt-10 print:mt-0 pt-6 border-t-2 border-dashed border-gray-300 print:border-0">
          <h2 className="text-sm font-bold text-gray-900 text-center">เฉลย — {test.title} (สำหรับครู)</h2>

          <div className="grid grid-cols-10 gap-1 mt-4">
            {items.map(it => (
              <div key={it.id} className="border border-gray-300 rounded text-center py-1">
                <p className="text-[9px] text-gray-400">{it.item_no}</p>
                <p className="text-[12px] font-bold text-gray-900">{it.answer ?? '—'}</p>
              </div>
            ))}
          </div>

          <h3 className="text-[12px] font-bold text-gray-800 mt-5 mb-2">แยกตามตัวชี้วัด (ใช้วิเคราะห์จุดอ่อนหลังตรวจ)</h3>
          <table className="w-full text-[11px] border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-1 text-left">ตัวชี้วัด</th>
                <th className="border border-gray-300 px-2 py-1 text-left">ข้อที่</th>
                <th className="border border-gray-300 px-2 py-1">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byIndicator.entries()).map(([code, list]) => (
                <tr key={code}>
                  <td className="border border-gray-300 px-2 py-1 font-mono">{code}</td>
                  <td className="border border-gray-300 px-2 py-1">{list.map(i => i.item_no).join(', ')}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{list.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-3 text-center">สร้างโดย Suppamas Growth Engine · ไฟจราจรแห่งการเรียนรู้ 🚦</p>
        </section>
      </div>
    </div>
  )
}
