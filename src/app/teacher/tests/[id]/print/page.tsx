'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Test, TestItem, Course } from '@/lib/types'
import { Loader2, Printer, ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import type { Paragraph, Table as DocxTable } from 'docx'

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
  const [exporting, setExporting] = useState(false)

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

  // answer key grouped by indicator
  const byIndicator = new Map<string, TestItem[]>()
  items.forEach(it => {
    const key = it.indicator_code ?? 'ไม่ระบุตัวชี้วัด'
    if (!byIndicator.has(key)) byIndicator.set(key, [])
    byIndicator.get(key)!.push(it)
  })

  async function exportWord() {
    if (!test || exporting) return
    setExporting(true)
    try {
      const {
        AlignmentType, BorderStyle, Document,
        PageBreak, Packer, Paragraph, Table,
        TableCell, TableRow, TextRun, WidthType,
        convertInchesToTwip,
      } = await import('docx')

      const FONT = 'TH Sarabun New'
      const sz = (pt: number) => pt * 2 // docx uses half-points

      const NIL = { style: BorderStyle.NIL } as const
      const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' } as const
      // table-level borders control the outer frame; cell-level borders produce inner grid lines
      const NO_BORDERS = { top: NIL, bottom: NIL, left: NIL, right: NIL }
      const TABLE_FRAME = { top: THIN, bottom: THIN, left: THIN, right: THIN }
      const CELL_THIN = { top: THIN, bottom: THIN, left: THIN, right: THIN }

      const run = (text: string, opts: { size?: number; bold?: boolean } = {}) =>
        new TextRun({ text, font: FONT, size: sz(opts.size ?? 14), bold: opts.bold })

      const line = (text: string, opts: { size?: number; bold?: boolean; center?: boolean; indent?: number } = {}) =>
        new Paragraph({
          alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
          indent: opts.indent ? { left: opts.indent } : undefined,
          children: [run(text, opts)],
        })

      const blank = () => new Paragraph({ children: [] })

      // --- questions ---
      const questionNodes = items.flatMap(it => {
        const hasChoices = it.choice_a || it.choice_b || it.choice_c || it.choice_d
        const nodes: (Paragraph | DocxTable)[] = [line(`${it.item_no}. ${it.question}`)]
        if (hasChoices) {
          const choiceRows = []
          if (it.choice_a || it.choice_b) {
            choiceRows.push(new TableRow({
              children: [
                new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line(`ก. ${it.choice_a ?? ''}`, { indent: 360 })] }),
                new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line(`ข. ${it.choice_b ?? ''}`)] }),
              ]
            }))
          }
          if (it.choice_c || it.choice_d) {
            choiceRows.push(new TableRow({
              children: [
                new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line(`ค. ${it.choice_c ?? ''}`, { indent: 360 })] }),
                new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line(`ง. ${it.choice_d ?? ''}`)] }),
              ]
            }))
          }
          nodes.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            rows: choiceRows,
          }))
        }
        nodes.push(blank())
        return nodes
      })

      // --- answer key grid (10 per row) ---
      const chunks: TestItem[][] = []
      for (let i = 0; i < items.length; i += 10) chunks.push(items.slice(i, i + 10))
      const answerRows = chunks.flatMap(chunk => [
        new TableRow({
          children: chunk.map(it => new TableCell({
            borders: CELL_THIN,
            children: [line(String(it.item_no), { center: true, size: 11 })],
          }))
        }),
        new TableRow({
          children: chunk.map(it => new TableCell({
            borders: CELL_THIN,
            children: [line(it.answer ?? '—', { center: true, bold: true })],
          }))
        }),
      ])

      // --- indicator table ---
      const indicatorRows = [
        new TableRow({
          children: [
            new TableCell({ borders: CELL_THIN, width: { size: 35, type: WidthType.PERCENTAGE }, children: [line('ตัวชี้วัด', { bold: true })] }),
            new TableCell({ borders: CELL_THIN, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line('ข้อที่', { bold: true })] }),
            new TableCell({ borders: CELL_THIN, width: { size: 15, type: WidthType.PERCENTAGE }, children: [line('จำนวน', { bold: true, center: true })] }),
          ]
        }),
        ...Array.from(byIndicator.entries()).map(([code, list]) =>
          new TableRow({
            children: [
              new TableCell({ borders: CELL_THIN, width: { size: 35, type: WidthType.PERCENTAGE }, children: [line(code)] }),
              new TableCell({ borders: CELL_THIN, width: { size: 50, type: WidthType.PERCENTAGE }, children: [line(list.map(i => i.item_no).join(', '))] }),
              new TableCell({ borders: CELL_THIN, width: { size: 15, type: WidthType.PERCENTAGE }, children: [line(String(list.length), { center: true })] }),
            ]
          })
        )
      ]

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.18), // ~3cm left margin
              }
            }
          },
          children: ([
            line('โรงเรียนอนุสรณ์ศุภมาศ', { size: 16, bold: true, center: true }),
            line(`${TYPE_LABEL[test.type] ?? 'แบบทดสอบ'} · ${course?.name ?? test.subject}`, { center: true }),
            line(test.title, { bold: true, center: true }),
            line(`จำนวน ${items.length} ข้อ · คะแนนเต็ม ${test.max_score} คะแนน${test.test_date ? ` · วันที่สอบ ${test.test_date}` : ''}`, { size: 12, center: true }),
            blank(),
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
              children: [],
            }),
            blank(),
            new Paragraph({
              children: [
                run('ชื่อ-สกุล ........................................................'),
                run('     ชั้น ..............'),
                run('     เลขที่ ..............'),
              ]
            }),
            blank(),
            line('คำชี้แจง: ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว แล้วกากบาท (✗) ลงในกระดาษคำตอบ', { size: 13 }),
            blank(),
            ...questionNodes,
            // --- Answer key (new page) ---
            new Paragraph({ children: [new PageBreak()] }),
            line(`เฉลย — ${test.title} (สำหรับครู)`, { bold: true, center: true }),
            blank(),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_THIN, rows: answerRows }),
            blank(),
            line('แยกตามตัวชี้วัด (ใช้วิเคราะห์จุดอ่อนหลังตรวจ)', { bold: true }),
            blank(),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: CELL_THIN, rows: indicatorRows }),
            blank(),
            line('สร้างโดย Suppamas Growth Engine · ไฟจราจรแห่งการเรียนรู้', { size: 10, center: true }),
          ] as (Paragraph | DocxTable)[]),
        }]
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${test.title}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-500" size={32} /></div>
  }
  if (!test) {
    return <p className="text-center py-24 text-gray-400">ไม่พบแบบทดสอบ</p>
  }

  return (
    <div className="max-w-[210mm] mx-auto">
      <div className="print:hidden flex items-center justify-between mb-4">
        <Link href="/teacher/tests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> แบบทดสอบ
        </Link>
        <div className="flex gap-2">
          <button
            onClick={exportWord}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl"
          >
            <FileText size={14} /> {exporting ? 'กำลังสร้าง...' : 'Export Word'}
          </button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
            <Printer size={14} /> พิมพ์ / บันทึก PDF
          </button>
        </div>
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
